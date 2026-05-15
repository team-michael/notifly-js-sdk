import { SSEEvent } from './SSEEvent';

const DEFAULT_TYPE = 'message';
const NULL_CHAR = String.fromCharCode(0x0000);
const BOM_CHAR = String.fromCharCode(0xfeff);

export class SSELineParser {
    private eventType: string | null = null;
    private dataLines: string[] = [];
    private isFirstLine = true;
    private lastEventIdInternal: string | null = null;

    get lastEventId(): string | null {
        return this.lastEventIdInternal;
    }

    feed(rawLine: string): SSEEvent | null {
        const line = this.stripLineEnding(rawLine);
        if (line.length === 0) return this.dispatch();
        if (line.startsWith(':')) return null;

        const [field, value] = this.splitFieldValue(line);
        switch (field) {
            case 'id':
                if (!value.includes(NULL_CHAR)) this.lastEventIdInternal = value;
                break;
            case 'event':
                this.eventType = value;
                break;
            case 'data':
                this.dataLines.push(value);
                break;
            case 'retry':
                break;
            default:
                break;
        }
        return null;
    }

    private dispatch(): SSEEvent | null {
        const type =
            this.eventType && this.eventType.length > 0 ? this.eventType : DEFAULT_TYPE;
        const data = this.dataLines.length === 0 ? null : this.dataLines.join('\n');
        this.eventType = null;
        this.dataLines = [];
        if (data === null) return null;
        return { id: this.lastEventIdInternal, type, data };
    }

    private stripLineEnding(s: string): string {
        let result = s;
        if (result.endsWith('\r')) {
            result = result.slice(0, -1);
        }
        if (this.isFirstLine) {
            if (result.length > 0 && result.charAt(0) === BOM_CHAR) {
                result = result.slice(1);
            }
            this.isFirstLine = false;
        }
        return result;
    }

    private splitFieldValue(line: string): [string, string] {
        const colon = line.indexOf(':');
        if (colon < 0) return [line, ''];
        const field = line.substring(0, colon);
        let valueStart = colon + 1;
        if (valueStart < line.length && line.charAt(valueStart) === ' ') {
            valueStart += 1;
        }
        return [field, line.substring(valueStart)];
    }
}
