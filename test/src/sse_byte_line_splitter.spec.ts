import { TextEncoder as NodeTextEncoder } from 'util';
import { splitSSELines } from '../../src/Core/SSE/SSEByteLineSplitter';

const _TextEncoder: typeof NodeTextEncoder =
    typeof TextEncoder !== 'undefined'
        ? (TextEncoder as unknown as typeof NodeTextEncoder)
        : NodeTextEncoder;

async function collectLines(bytes: Uint8Array, chunkSize = 256): Promise<string[]> {
    async function* chunks(): AsyncGenerator<Uint8Array> {
        for (let i = 0; i < bytes.length; i += chunkSize) {
            yield bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        }
    }
    const out: string[] = [];
    for await (const line of splitSSELines(chunks())) out.push(line);
    return out;
}

function toBytes(s: string): Uint8Array {
    return new _TextEncoder().encode(s);
}

describe('SSEByteLineSplitter', () => {
    test('lfOnly_yieldsSingleEmptyLine', async () => {
        expect(await collectLines(toBytes('\n'))).toEqual(['']);
    });

    test('crOnly_yieldsSingleEmptyLine', async () => {
        expect(await collectLines(toBytes('\r'))).toEqual(['']);
    });

    test('crlf_yieldsSingleEmptyLine', async () => {
        expect(await collectLines(toBytes('\r\n'))).toEqual(['']);
    });

    test('singleLine_lf', async () => {
        expect(await collectLines(toBytes('hello\n'))).toEqual(['hello']);
    });

    test('singleLine_cr', async () => {
        expect(await collectLines(toBytes('hello\r'))).toEqual(['hello']);
    });

    test('singleLine_crlf', async () => {
        expect(await collectLines(toBytes('hello\r\n'))).toEqual(['hello']);
    });

    test('unterminatedTail_isDiscarded', async () => {
        expect(await collectLines(toBytes('hello'))).toEqual([]);
    });

    test('terminatedThenUnterminated_yieldsOnlyTerminated', async () => {
        expect(await collectLines(toBytes('a\nbcd'))).toEqual(['a']);
    });

    test('mixedLineEndings_inSingleStream', async () => {
        expect(await collectLines(toBytes('a\nb\r\nc\rd\n'))).toEqual(['a', 'b', 'c', 'd']);
    });

    test('consecutiveLF_yieldsMultipleBlankLines', async () => {
        expect(await collectLines(toBytes('\n\n\n'))).toEqual(['', '', '']);
    });

    test('consecutiveCRLF_yieldsMultipleBlankLines', async () => {
        expect(await collectLines(toBytes('\r\n\r\n'))).toEqual(['', '']);
    });

    test('blankLineBetweenContent', async () => {
        expect(await collectLines(toBytes('a\n\nb\n'))).toEqual(['a', '', 'b']);
    });

    test('sseEventBlock_endsWithBlankLine', async () => {
        expect(await collectLines(toBytes('event: sync\ndata: {}\n\n'))).toEqual([
            'event: sync',
            'data: {}',
            '',
        ]);
    });

    test('crFollowedByText_treatsCRAsTerminator', async () => {
        expect(await collectLines(toBytes('a\rb\n'))).toEqual(['a', 'b']);
    });

    test('crFollowedByCR_eachIsTerminator', async () => {
        expect(await collectLines(toBytes('a\r\rb\n'))).toEqual(['a', '', 'b']);
    });

    test('lfFollowedByCR_eachIsTerminator', async () => {
        expect(await collectLines(toBytes('a\n\rb\n'))).toEqual(['a', '', 'b']);
    });

    test('unicodeContent_preserved', async () => {
        expect(await collectLines(toBytes('안녕하세요\n'))).toEqual(['안녕하세요']);
    });

    test('emojiContent_preserved', async () => {
        expect(await collectLines(toBytes('hi 🚀\n'))).toEqual(['hi 🚀']);
    });

    test('chunkBoundarySplit_doesNotBreakLines', async () => {
        expect(await collectLines(toBytes('event: sync\ndata: {}\n\n'), 1)).toEqual([
            'event: sync',
            'data: {}',
            '',
        ]);
    });

    test('crlfSplitAcrossChunks_yieldsSingleBlankLine', async () => {
        async function* chunks(): AsyncGenerator<Uint8Array> {
            yield toBytes('\r');
            yield toBytes('\n');
        }
        const out: string[] = [];
        for await (const line of splitSSELines(chunks())) out.push(line);
        expect(out).toEqual(['']);
    });

    test('realisticSSEEventStream', async () => {
        const stream =
            'event: connected\n' +
            'data: {"projectId":"abc"}\n' +
            '\n' +
            'id: 42\n' +
            'event: sync\n' +
            'data: {}\n' +
            '\n' +
            ': heartbeat\n' +
            '\n';
        expect(await collectLines(toBytes(stream))).toEqual([
            'event: connected',
            'data: {"projectId":"abc"}',
            '',
            'id: 42',
            'event: sync',
            'data: {}',
            '',
            ': heartbeat',
            '',
        ]);
    });
});
