import { decodeSSEMessage } from '../../src/Core/SSE/SSEMessage';

describe('decodeSSEMessage', () => {
    test('connected_decodesToConnected', () => {
        expect(decodeSSEMessage('connected', '{}').kind).toBe('connected');
    });

    test('sync_decodesToSync', () => {
        expect(decodeSSEMessage('sync', '{}').kind).toBe('sync');
    });

    test('ttlExpired_decodesToTtlExpired', () => {
        expect(decodeSSEMessage('ttl-expired', '{}').kind).toBe('ttl-expired');
    });

    test('unknownType_decodesToUnknown', () => {
        const m = decodeSSEMessage('foo-bar', '{}');
        expect(m.kind).toBe('unknown');
        expect((m as { rawType: string }).rawType).toBe('foo-bar');
    });

    test('serverEvent_withNameAndParams_decodesToEvent', () => {
        const m = decodeSSEMessage(
            'server-event',
            '{"name":"order_completed","eventParams":{"x":1}}',
        );
        expect(m.kind).toBe('event');
        if (m.kind === 'event') {
            expect(m.name).toBe('order_completed');
            expect(m.eventParams).toEqual({ x: 1 });
        }
    });

    test('serverEvent_withNameButNoParams_decodesToEventWithNullParams', () => {
        const m = decodeSSEMessage('server-event', '{"name":"order_completed"}');
        expect(m.kind).toBe('event');
        if (m.kind === 'event') expect(m.eventParams).toBeNull();
    });

    test('serverEvent_withBlankName_decodesToMalformed', () => {
        expect(decodeSSEMessage('server-event', '{"name":"   "}').kind).toBe('malformed');
    });

    test('serverEvent_withoutName_decodesToMalformed', () => {
        expect(decodeSSEMessage('server-event', '{"eventParams":{}}').kind).toBe('malformed');
    });

    test('serverEvent_withInvalidJson_decodesToMalformed', () => {
        expect(decodeSSEMessage('server-event', 'not json').kind).toBe('malformed');
    });

    test('shutdown_withReconnectInMs_decodes', () => {
        const m = decodeSSEMessage('shutdown', '{"reconnectInMs":1500}');
        expect(m.kind).toBe('shutdown');
        if (m.kind === 'shutdown') expect(m.reconnectInMs).toBe(1500);
    });

    test('shutdown_withoutPayload_defaultsToZero', () => {
        const m = decodeSSEMessage('shutdown', '{}');
        if (m.kind === 'shutdown') expect(m.reconnectInMs).toBe(0);
    });

    test('shutdown_withNegativeMs_clampsToZero', () => {
        const m = decodeSSEMessage('shutdown', '{"reconnectInMs":-1000}');
        if (m.kind === 'shutdown') expect(m.reconnectInMs).toBe(0);
    });

    test('shutdown_withInvalidJson_defaultsToZero', () => {
        const m = decodeSSEMessage('shutdown', 'not json');
        if (m.kind === 'shutdown') expect(m.reconnectInMs).toBe(0);
    });
});
