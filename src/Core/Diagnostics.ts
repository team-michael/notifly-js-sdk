// Local User Timing only. Names are bounded and contain no user or project values.
let sequence = 0;
export function beginPerformance(name: string): (success: boolean) => void {
    if (typeof performance === 'undefined' || !performance.mark || !performance.measure) return () => undefined;
    const start = 'notifly.' + name + '.start.' + sequence++;
    try {
        performance.mark(start);
    } catch {
        return () => undefined;
    }
    let ended = false;
    return (success) => {
        if (ended) return;
        ended = true;
        const measure = 'notifly.' + name + (success ? '.success' : '.failure');
        try {
            performance.clearMeasures(measure);
            performance.measure(measure, start);
        } catch {
            /* Diagnostics must not affect SDK behavior. */
        } finally {
            performance.clearMarks(start);
        }
    };
}
