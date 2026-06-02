import { SSELineParser } from '../../src/Core/SSE/SSELineParser';

const NULL_CHAR = String.fromCharCode(0x0000);
const BOM = String.fromCharCode(0xfeff);

describe('SSELineParser', () => {
    test('singleEvent_withTypeAndData_dispatchOnEmptyLine', () => {
        const p = new SSELineParser();
        expect(p.feed('event: sync')).toBeNull();
        expect(p.feed('data: {"ts":1}')).toBeNull();
        expect(p.feed('')).toEqual({ id: null, type: 'sync', data: '{"ts":1}' });
    });

    test('dataOnly_typeDefaultsToMessage', () => {
        const p = new SSELineParser();
        expect(p.feed('data: hello')).toBeNull();
        expect(p.feed('')).toEqual({ id: null, type: 'message', data: 'hello' });
    });

    test('emptyData_doesNotDispatch', () => {
        const p = new SSELineParser();
        expect(p.feed('event: sync')).toBeNull();
        expect(p.feed('')).toBeNull();
    });

    test('lineWithNoColon_treatedAsFieldNameWithEmptyValue', () => {
        const p = new SSELineParser();
        expect(p.feed('data')).toBeNull();
        expect(p.feed('')).toEqual({ id: null, type: 'message', data: '' });
    });

    test('multipleDataLines_joinedWithNewline', () => {
        const p = new SSELineParser();
        p.feed('data: line1');
        p.feed('data: line2');
        p.feed('data:line3');
        expect(p.feed('')).toEqual({
            id: null,
            type: 'message',
            data: 'line1\nline2\nline3',
        });
    });

    test('commentLine_ignoredAndDoesNotDispatch', () => {
        const p = new SSELineParser();
        expect(p.feed(': heartbeat')).toBeNull();
        expect(p.feed(':')).toBeNull();
        p.feed('data: hi');
        expect(p.feed('')).toEqual({ id: null, type: 'message', data: 'hi' });
    });

    test('idField_setsLastEventIdAndIsAttachedToDispatchedEvent', () => {
        const p = new SSELineParser();
        p.feed('id: 42');
        p.feed('data: x');
        const event = p.feed('');
        expect(event?.id).toBe('42');
        expect(p.lastEventId).toBe('42');
    });

    test('idBufferPersists_acrossEventsWhenNotResent', () => {
        const p = new SSELineParser();
        p.feed('id: 7');
        p.feed('data: a');
        const first = p.feed('');
        expect(first?.id).toBe('7');
        p.feed('data: b');
        const second = p.feed('');
        expect(second?.id).toBe('7');
        expect(p.lastEventId).toBe('7');
    });

    test('idEmptyValue_resetsBufferToEmptyString', () => {
        const p = new SSELineParser();
        p.feed('id: 5');
        p.feed('data: a');
        p.feed('');
        expect(p.lastEventId).toBe('5');

        p.feed('id:');
        p.feed('data: b');
        const event = p.feed('');
        expect(event?.id).toBe('');
        expect(p.lastEventId).toBe('');
    });

    test('idWithNullByte_isIgnored', () => {
        const p = new SSELineParser();
        p.feed('id: ok');
        p.feed('data: a');
        p.feed('');
        expect(p.lastEventId).toBe('ok');

        p.feed(`id: bad${NULL_CHAR}value`);
        p.feed('data: b');
        const event = p.feed('');
        expect(event?.id).toBe('ok');
        expect(p.lastEventId).toBe('ok');
    });

    test('retryField_isIgnored', () => {
        const p = new SSELineParser();
        expect(p.feed('retry: 5000')).toBeNull();
        p.feed('data: x');
        expect(p.feed('')).toEqual({ id: null, type: 'message', data: 'x' });
    });

    test('unknownField_isIgnored', () => {
        const p = new SSELineParser();
        expect(p.feed('custom: whatever')).toBeNull();
        p.feed('data: x');
        expect(p.feed('')).toEqual({ id: null, type: 'message', data: 'x' });
    });

    test('trailingCarriageReturn_isStripped', () => {
        const p = new SSELineParser();
        p.feed('event: sync\r');
        p.feed('data: payload\r');
        expect(p.feed('\r')).toEqual({ id: null, type: 'sync', data: 'payload' });
    });

    test('bomAtStart_isStripped', () => {
        const p = new SSELineParser();
        p.feed(`${BOM}event: sync`);
        p.feed('data: x');
        expect(p.feed('')).toEqual({ id: null, type: 'sync', data: 'x' });
    });

    test('bom_onlyStrippedFromFirstLine_preservedInDataValueAfter', () => {
        const p = new SSELineParser();
        p.feed(`${BOM}event: msg`);
        p.feed(`data: ${BOM}value`);
        expect(p.feed('')?.data).toBe(`${BOM}value`);
    });

    test('singleLeadingSpace_isStripped', () => {
        const p = new SSELineParser();
        p.feed('data: x');
        expect(p.feed('')?.data).toBe('x');
    });

    test('multipleLeadingSpaces_onlyOneStripped', () => {
        const p = new SSELineParser();
        p.feed('data:  x');
        expect(p.feed('')?.data).toBe(' x');
    });

    test('noLeadingSpace_valuePreserved', () => {
        const p = new SSELineParser();
        p.feed('data:x');
        expect(p.feed('')?.data).toBe('x');
    });

    test('emptyEventField_treatedAsDefaultMessageType', () => {
        const p = new SSELineParser();
        p.feed('event:');
        p.feed('data: x');
        expect(p.feed('')?.type).toBe('message');
    });
});
