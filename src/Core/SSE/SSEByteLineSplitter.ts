const LF = 0x0a;
const CR = 0x0d;
const INITIAL_BUFFER_CAPACITY = 256;
export const MAX_LINE_BYTES = 1 * 1024 * 1024;

class GrowableByteBuffer {
    private buf: Uint8Array;
    private size_ = 0;

    constructor(initialCapacity: number) {
        this.buf = new Uint8Array(initialCapacity);
    }

    get size(): number {
        return this.size_;
    }

    append(byte: number): void {
        if (this.size_ === this.buf.length) {
            const grown = new Uint8Array(this.buf.length * 2);
            grown.set(this.buf);
            this.buf = grown;
        }
        this.buf[this.size_++] = byte;
    }

    reset(): void {
        this.size_ = 0;
    }

    toUtf8String(decoder: TextDecoder): string {
        if (this.size_ === 0) return '';
        return decoder.decode(this.buf.subarray(0, this.size_));
    }
}

export async function* splitSSELines(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
    const decoder = new TextDecoder('utf-8');
    const buffer = new GrowableByteBuffer(INITIAL_BUFFER_CAPACITY);
    let prevWasCR = false;

    for await (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) {
            const byte = chunk[i];
            if (byte === LF) {
                if (prevWasCR) {
                    prevWasCR = false;
                    continue;
                }
                yield buffer.toUtf8String(decoder);
                buffer.reset();
            } else if (byte === CR) {
                yield buffer.toUtf8String(decoder);
                buffer.reset();
                prevWasCR = true;
            } else {
                prevWasCR = false;
                if (buffer.size >= MAX_LINE_BYTES) {
                    throw new Error(`SSE line exceeded ${MAX_LINE_BYTES} bytes without terminator`);
                }
                buffer.append(byte);
            }
        }
    }
}
