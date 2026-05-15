import { splitSSELines } from './SSEByteLineSplitter';

function noop(): void {
    return undefined;
}

export interface StreamResponse {
    statusCode: number;
    contentType: string | null;
    lines: AsyncIterable<string>;
    close: () => void;
}

export interface StreamLineProvider {
    open(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<StreamResponse>;
}

async function* readChunks(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<Uint8Array> {
    try {
        while (true) {
            const result = await reader.read();
            if (result.done) return;
            if (result.value) yield result.value;
        }
    } finally {
        try {
            reader.releaseLock();
        } catch (e) {
            void e;
        }
    }
}

export class FetchStreamLineProvider implements StreamLineProvider {
    async open(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<StreamResponse> {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal,
            cache: 'no-store',
            credentials: 'omit',
        });

        const body = response.body;

        if (!body) {
            throw new Error('SSE response has no body');
        }

        const reader = body.getReader();
        return {
            statusCode: response.status,
            contentType: response.headers.get('content-type'),
            lines: splitSSELines(readChunks(reader)),
            close: () => {
                try {
                    reader.cancel().catch(noop);
                } catch (e) {
                    void e;
                }
            },
        };
    }
}
