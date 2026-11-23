import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const projectId = '0123456789abcdef0123456789abcdef';
const options = { projectId, username: 'test-user', password: 'test-password' };
async function setup(context: BrowserContext, delay = 0, workerPath?: string, failState = false) {
    const calls: { states: number; events: any[] } = { states: 0, events: [] };
    // WebKit can bypass route interception for a service-worker-controlled document.
    // Stub page fetch at its source and abort any unhandled external traffic.
    await context.route('https://**/*', (route) => route.abort());
    await context.exposeBinding('__fixtureFetch', async (_source, url: string, options: any = {}) => {
        if (url.includes('/user-state/')) {
            calls.states++;
            if (delay) await new Promise((r) => setTimeout(r, delay));
            return {
                status: failState ? 500 : 200,
                body: {
                    userData: { user_properties: { private_value: 'secret-state' } },
                    campaignData: [],
                    eventIntermediateCountsData: [],
                },
            };
        } else if (url.includes('sdk-configurations'))
            return {
                status: 200,
                body: {
                    data: {
                        session_duration: 1800,
                        use_web_push: !!workerPath,
                        ...(workerPath
                            ? {
                                  web_push_options: {
                                      vapid_public_key: 'AQID',
                                      service_worker_path: workerPath,
                                      ask_permission: false,
                                  },
                              }
                            : {}),
                    },
                },
            };
        else if (url.includes('authorize')) return { status: 200, body: { data: 'test-token' } };
        else {
            const body = options.body ? JSON.parse(options.body) : null;
            if (body?.records) for (const record of body.records) calls.events.push(JSON.parse(record.data));
            return { status: 200, body: {} };
        }
    });
    await context.addInitScript(() => {
        const original = window.fetch.bind(window);
        window.fetch = async (input, options) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (!url.startsWith('https://')) return original(input, options);
            const result = await (window as any).__fixtureFetch(url, options);
            return new Response(JSON.stringify(result.body), {
                status: result.status,
                headers: { 'Content-Type': 'application/json' },
            });
        };
    });
    return calls;
}
async function load(page: Page) {
    await page.goto('/test/browser/index.html');
    await page.addScriptTag({ url: '/dist/index.global.js' });
}
async function init(page: Page) {
    return page.evaluate((opts) => (window as any).notifly.initialize(opts), options);
}
async function snapshot(page: Page) {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('notifly');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        const result = await new Promise<any>((resolve, reject) => {
            const tx = db.transaction(['notiflyprotected', 'notiflyconfig-v2']);
            const secure = tx.objectStore('notiflyprotected'),
                config = tx.objectStore('notiflyconfig-v2');
            const key = secure.get('key'),
                record = secure.get('record'),
                keys = config.getAllKeys(),
                values = config.getAll();
            tx.oncomplete = () =>
                resolve({ key: key.result, record: record.result, keys: keys.result, values: values.result });
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        const header = result.record;
        const aad = new TextEncoder().encode(
            JSON.stringify([
                'notifly.identity',
                header.schemaVersion,
                header.cryptoVersion,
                header.keyVersion,
                header.revision,
            ])
        );
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: header.iv, additionalData: aad, tagLength: 128 },
            result.key,
            header.ciphertext
        );
        return {
            identity: JSON.parse(new TextDecoder().decode(plain)),
            keys: result.keys,
            values: result.values,
            extractable: result.key.extractable,
            ciphertext: Array.from(new Uint8Array(header.ciphertext)),
        };
    });
}
test('fresh init queues events, reload restores identity, SPA does not refetch', async ({ page, context }) => {
    const calls = await setup(context, 150);
    await load(page);
    const initialized = await page.evaluate(async (opts) => {
        const sdk = (window as any).notifly;
        const initializing = sdk.initialize(opts);
        const params = { page: '/checkout' };
        const event = sdk.trackEvent('page_view', params);
        params.page = '/mutated';
        const initialized = await initializing;
        await event;
        return initialized;
    }, options);
    expect(initialized).toBe(true);
    expect(calls.states).toBe(1);
    expect(calls.events.filter((e) => e.name === 'page_view')).toHaveLength(1);
    expect(calls.events.find((e) => e.name === 'page_view').event_params).toEqual({ page: '/checkout' });
    const first = await snapshot(page);
    expect(first.extractable).toBe(false);
    expect(first.keys).not.toContain('__notiflyState');
    expect(first.keys).not.toContain('__notiflyDeviceID');
    expect(first.values).not.toContain('secret-state');
    await page.evaluate(() => history.pushState({}, '', '/spa-route'));
    expect(await init(page)).toBe(true);
    expect(calls.states).toBe(1);
    await load(page);
    expect(await init(page)).toBe(true);
    expect(calls.states).toBe(2);
    expect((await snapshot(page)).identity.deviceId).toBe(first.identity.deviceId);
});
test('concurrent fresh tabs retain the same device ID', async ({ page, context }) => {
    await setup(context);
    const other = await context.newPage();
    await Promise.all([load(page), load(other)]);
    expect(await Promise.all([init(page), init(other)])).toEqual([true, true]);
    expect((await snapshot(page)).identity.deviceId).toBe((await snapshot(other)).identity.deviceId);
});
test('key loss fails initialization without overwriting ciphertext', async ({ page, context }) => {
    const calls = await setup(context);
    await load(page);
    expect(await init(page)).toBe(true);
    const before = await snapshot(page);
    await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
            const r = indexedDB.open('notifly');
            r.onsuccess = () => resolve(r.result);
        });
        await new Promise<void>((resolve) => {
            const tx = db.transaction('notiflyprotected', 'readwrite');
            tx.objectStore('notiflyprotected').delete('key');
            tx.oncomplete = () => resolve();
        });
        db.close();
    });
    await load(page);
    expect(await init(page)).toBe(false);
    expect(calls.states).toBe(1);
    const after = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
            const r = indexedDB.open('notifly');
            r.onsuccess = () => resolve(r.result);
        });
        const result = await new Promise<any>((resolve) => {
            const tx = db.transaction('notiflyprotected');
            const k = tx.objectStore('notiflyprotected').get('key'),
                r = tx.objectStore('notiflyprotected').get('record');
            tx.oncomplete = () => resolve({ key: k.result, bytes: Array.from(new Uint8Array(r.result.ciphertext)) });
        });
        db.close();
        return result;
    });
    expect(after.key).toBeUndefined();
    expect(after.bytes).toEqual(before.ciphertext);
});
test('active compatible classic worker decrypts the migrated identity', async ({ page, context }) => {
    await setup(context, 0, '/test/browser/notifly-worker.js');
    await load(page);
    await page.evaluate(async () => {
        await navigator.serviceWorker.register('/test/browser/notifly-worker.js');
        await navigator.serviceWorker.ready;
    });
    expect(await init(page)).toBe(true);
    const identity = await snapshot(page);
    expect(identity.identity.deviceId).toBeTruthy();
    const capability = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return new Promise((resolve) => {
            const ch = new MessageChannel();
            ch.port1.onmessage = (e) => {
                ch.port1.close();
                resolve(e.data);
            };
            reg!.active!.postMessage({ type: '__notifly_storage_capability' }, [ch.port2]);
        });
    });
    expect(capability).toMatchObject({ protocolVersion: 1, schemaVersions: [1] });
});

test('worker display, delivery and click use the same IDs before and after migration', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });
    await setup(context, 0, '/test/browser/notifly-worker.js');
    await page.goto('/test/browser/index.html');
    await page.addScriptTag({ url: '/build/secure-storage-fixtures/legacy-sdk.js' });
    expect(await init(page)).toBe(true);
    await page.evaluate(async () => {
        await navigator.serviceWorker.register('/test/browser/notifly-worker.js');
        await navigator.serviceWorker.ready;
    });
    const exercise = () =>
        page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return new Promise<any>((resolve) => {
                const c = new MessageChannel();
                c.port1.onmessage = (e) => {
                    c.port1.close();
                    resolve(e.data);
                };
                reg!.active!.postMessage({ type: '__test_push' }, [c.port2]);
            });
        });
    const legacy = await exercise();
    await load(page);
    expect(await init(page), errors.join('\n')).toBe(true);
    const migrated = await exercise();
    const events = (r: any) =>
        r.requests.flatMap((q: any) =>
            q.body ? JSON.parse(q.body).records?.map((e: any) => JSON.parse(e.data)) ?? [] : []
        );
    expect(legacy.notifications).toHaveLength(1);
    expect(migrated.notifications).toHaveLength(2);
    const before = events(legacy),
        after = events(migrated).slice(before.length);
    expect(before.map((e: any) => e.name).sort()).toEqual(['push_click', 'push_delivered']);
    expect(after.map((e: any) => e.name).sort()).toEqual(['push_click', 'push_delivered']);
    for (const e of after) {
        expect(e.notifly_user_id).toBe(before[0].notifly_user_id);
        expect(e.notifly_device_id).toBe((await snapshot(page)).identity.deviceId);
    }
});
test('queued events settle on initial user-state failure without being transmitted', async ({ page, context }) => {
    const calls = await setup(context, 0, undefined, true);
    await load(page);
    const result = await page.evaluate(async (opts) => {
        const sdk = (window as any).notifly,
            initializing = sdk.initialize(opts);
        const event = sdk.trackEvent('should-not-send');
        return {
            initialized: await initializing,
            settled: await event.then(
                () => true,
                () => true
            ),
        };
    }, options);
    expect(result).toEqual({ initialized: false, settled: true });
    expect(calls.events.filter((e) => e.name === 'should-not-send')).toHaveLength(0);
});
test('BFCache lifecycle keeps the initialized SDK usable', async ({ page, context }) => {
    const calls = await setup(context);
    await load(page);
    expect(await init(page)).toBe(true);
    await page.evaluate(async () => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        await (window as any).notifly.trackEvent('after-back');
    });
    expect(calls.events.filter((e) => e.name === 'after-back')).toHaveLength(1);
    expect(calls.states).toBe(1);
});
test('a different tab identity is refreshed before evaluating a new event', async ({ page, context }) => {
    const calls = await setup(context);
    await load(page);
    expect(await init(page)).toBe(true);
    const second = await context.newPage();
    await load(second);
    expect(await init(second)).toBe(true);
    await second.evaluate(() => (window as any).notifly.setUserId('member-B'));
    const states = calls.states;
    await page.evaluate(() => (window as any).notifly.trackEvent('belongs-to-B'));
    expect(calls.states).toBeGreaterThan(states);
    expect(calls.events.find((e) => e.name === 'belongs-to-B').external_user_id).toBe('member-B');
    expect((await snapshot(page)).identity.externalUserId).toBe('member-B');
});

test('a browser process restart restores the persisted CryptoKey and identity', async ({ browserName }, info) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'notifly-profile-'));
    const engine = { chromium, firefox, webkit }[browserName];
    let context: BrowserContext | undefined;
    const launch = () =>
        engine.launchPersistentContext(profile, {
            headless: true,
            ...(info.project.name === 'chrome' ? { channel: 'chrome' } : {}),
        });
    try {
        context = await launch();
        await setup(context);
        let page = await context.newPage();
        await page.goto('http://127.0.0.1:8765/test/browser/index.html');
        await page.addScriptTag({ url: '/dist/index.global.js' });
        expect(await init(page)).toBe(true);
        const first = await snapshot(page);
        await context.close();
        context = await launch();
        await setup(context);
        page = await context.newPage();
        await page.goto('http://127.0.0.1:8765/test/browser/index.html');
        await page.addScriptTag({ url: '/dist/index.global.js' });
        expect(await init(page)).toBe(true);
        const restored = await snapshot(page);
        expect(restored.identity.deviceId).toBe(first.identity.deviceId);
        expect(restored.ciphertext).toEqual(first.ciphertext);
        expect(restored.extractable).toBe(false);
    } finally {
        await context?.close();
        await rm(profile, { recursive: true, force: true });
    }
});
