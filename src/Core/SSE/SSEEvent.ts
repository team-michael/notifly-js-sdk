export interface SSEEvent {
    id: string | null;
    type: string;
    data: string;
}
