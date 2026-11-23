import { test, expect } from '@playwright/test';
const fixture = '/build/secure-storage-fixtures/legacy-sdk.js';
const projectId = '0123456789abcdef0123456789abcdef';
test('legacy writer is fenced by store rename and excluded settings survive', async ({ page, context }) => {
    await context.route('https://**/*', async (route) => {
        const url = route.request().url();
        const data = url.includes('sdk-configurations')
            ? { data: { session_duration: 1800, use_web_push: false } }
            : url.includes('user-state')
            ? { userData: {}, campaignData: [], eventIntermediateCountsData: [] }
            : url.includes('authorize')
            ? { data: 'test-token' }
            : {};
        await route.fulfill({ json: data });
    });
    await page.goto('/test/browser/index.html');
    await page.addScriptTag({ url: fixture });
    expect(
        await page.evaluate(
            async (id) =>
                (window as any).notifly.initialize({
                    projectId: id,
                    username: 'fixture-user',
                    password: 'fixture-password',
                }),
            projectId
        )
    ).toBe(true);
    const oldId = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('notifly');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        const value = await new Promise((resolve) => {
            const r = db.transaction('notiflyconfig').objectStore('notiflyconfig').get('__notiflyDeviceID');
            r.onsuccess = () => resolve(r.result);
        });
        db.close();
        return value;
    });
    const second = await context.newPage();
    await second.goto('/test/browser/index.html');
    const moved = await second.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('notifly', 2);
            r.onupgradeneeded = () => {
                r.transaction!.objectStore('notiflyconfig').name = 'notiflyconfig-v2';
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        const values = await new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction('notiflyconfig-v2');
            const store = tx.objectStore('notiflyconfig-v2');
            const id = store.get('__notiflyDeviceID'),
                token = store.get('__notiflyCognitoIDToken');
            tx.oncomplete = () => resolve([id.result, token.result]);
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        return values;
    });
    expect(moved).toEqual([oldId, 'test-token']);
    await page.evaluate(() => (window as any).notifly.setUserId('legacy-should-not-write'));
    await page.reload();
    await page.addScriptTag({ url: fixture });
    expect(
        await page.evaluate(
            async (id) =>
                (window as any).notifly.initialize({
                    projectId: id,
                    username: 'fixture-user',
                    password: 'fixture-password',
                }),
            projectId
        )
    ).toBe(false);
    const unchanged = await second.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
            const r = indexedDB.open('notifly');
            r.onsuccess = () => resolve(r.result);
        });
        const result = await new Promise((resolve) => {
            const r = db.transaction('notiflyconfig-v2').objectStore('notiflyconfig-v2').get('__notiflyDeviceID');
            r.onsuccess = () => resolve(r.result);
        });
        const legacyExists = db.objectStoreNames.contains('notiflyconfig');
        db.close();
        return { id: result, legacyExists };
    });
    expect(unchanged).toEqual({ id: oldId, legacyExists: false });
});
