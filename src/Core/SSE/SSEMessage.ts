export type SSEMessage =
    | { kind: 'connected' }
    | { kind: 'sync' }
    | { kind: 'event'; name: string; eventParams: Record<string, unknown> | null }
    | { kind: 'shutdown'; reconnectInMs: number }
    | { kind: 'ttl-expired' }
    | { kind: 'unknown'; rawType: string }
    | { kind: 'malformed'; rawType: string };

export function decodeSSEMessage(type: string, data: string): SSEMessage {
    switch (type) {
        case 'connected':
            return { kind: 'connected' };
        case 'sync':
            return { kind: 'sync' };
        case 'server-event':
            return decodeServerEvent(data, type);
        case 'shutdown':
            return decodeShutdown(data);
        case 'ttl-expired':
            return { kind: 'ttl-expired' };
        default:
            return { kind: 'unknown', rawType: type };
    }
}

function decodeServerEvent(data: string, type: string): SSEMessage {
    const json = parseJson(data);
    if (!json) return { kind: 'malformed', rawType: type };
    const rawName = json['name'];
    if (typeof rawName !== 'string') return { kind: 'malformed', rawType: type };
    const name = rawName.trim();
    if (name.length === 0) return { kind: 'malformed', rawType: type };
    const params = isPlainObject(json['eventParams']) ? json['eventParams'] : null;
    return { kind: 'event', name, eventParams: params };
}

function decodeShutdown(data: string): SSEMessage {
    const json = parseJson(data);
    const raw = json ? json['reconnectInMs'] : undefined;
    const ms = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 0;
    return { kind: 'shutdown', reconnectInMs: Math.max(ms, 0) };
}

function parseJson(data: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(data);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
