export const STORAGE_PROTOCOL = '__notifly_storage_capability';
export type WorkerCompatibility = 'compatible' | 'not-registered' | 'blocked';

export async function checkWorkerCompatibility(
    expectedPath?: string,
    hasPreviousWorker = false
): Promise<WorkerCompatibility> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'not-registered';
    const expected = new URL(expectedPath ?? '/notifly-service-worker.js', location.href).href;
    const defaultUrl = new URL('/notifly-service-worker.js', location.href).href;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const selected = await Promise.all(
        registrations.map(async (reg) => {
            if (
                [reg.active, reg.waiting, reg.installing].some(
                    (worker) => worker && (worker.scriptURL === expected || worker.scriptURL === defaultUrl)
                )
            )
                return reg;
            if (!hasPreviousWorker) return null;
            // Old versions did not retain their custom script path. An existing push registration
            // cannot safely be declared unrelated merely because today's configuration changed.
            try {
                return reg.pushManager && !(await reg.pushManager.getSubscription()) ? null : reg;
            } catch {
                return reg;
            }
        })
    );
    const candidates = selected.filter((reg): reg is ServiceWorkerRegistration => reg !== null);
    if (!candidates.length) return 'not-registered';
    const results = await Promise.all(
        candidates.map((reg) => {
            if (!reg.active || typeof MessageChannel === 'undefined') return Promise.resolve(false);
            return new Promise<boolean>((resolve) => {
                const channel = new MessageChannel();
                const done = (value: boolean) => {
                    clearTimeout(timer);
                    channel.port1.close();
                    channel.port2.close();
                    resolve(value);
                };
                const timer = setTimeout(() => done(false), 1000);
                channel.port1.onmessage = (event) => {
                    const data = event.data;
                    done(
                        data?.type === STORAGE_PROTOCOL &&
                            data.protocolVersion === 1 &&
                            Array.isArray(data.schemaVersions) &&
                            data.schemaVersions.includes(1) &&
                            Array.isArray(data.cryptoVersions) &&
                            data.cryptoVersions.includes(1)
                    );
                };
                try {
                    reg.active!.postMessage({ type: STORAGE_PROTOCOL }, [channel.port2]);
                } catch {
                    done(false);
                }
            });
        })
    );
    return results.every(Boolean) ? 'compatible' : 'blocked';
}
