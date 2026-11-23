/** @jest-environment node */
import { webcrypto } from 'crypto';
import { generateIdentityKey, encryptIdentity, decryptIdentity } from '../../src/Core/Storage/IdentityCrypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
const values = { projectId: 'project', username: 'user', password: 'secret', deviceId: 'device', externalUserId: null };
const header = { schemaVersion: 1, cryptoVersion: 1, keyVersion: 1, revision: 1 };
test('identifiers round-trip inside opaque authenticated payload and use a fresh IV', async () => {
    const key = await generateIdentityKey();
    const a = await encryptIdentity(values, key, header);
    const b = await encryptIdentity(values, key, header);
    expect(await decryptIdentity(a, key)).toEqual(values);
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
    expect(new TextDecoder().decode(a.ciphertext)).not.toContain('secret');
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
});
test('tampered ciphertext and revision are rejected', async () => {
    const key = await generateIdentityKey();
    const envelope = await encryptIdentity(values, key, header);
    await expect(decryptIdentity({ ...envelope, revision: 2 }, key)).rejects.toMatchObject({ code: 'DECRYPT_FAILED' });
    const bytes = new Uint8Array(envelope.ciphertext.slice(0));
    bytes[0] ^= 1;
    await expect(decryptIdentity({ ...envelope, ciphertext: bytes.buffer }, key)).rejects.toMatchObject({
        code: 'DECRYPT_FAILED',
    });
});
test('future formats and insecure contexts are rejected', async () => {
    const key = await generateIdentityKey();
    const envelope = await encryptIdentity(values, key, header);
    await expect(decryptIdentity({ ...envelope, schemaVersion: 2 }, key)).rejects.toMatchObject({
        code: 'UNSUPPORTED_VERSION',
    });
    Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true });
    await expect(generateIdentityKey()).rejects.toMatchObject({ code: 'UNSUPPORTED_ENVIRONMENT' });
    Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
});

test('a late crypto completion cannot turn a timed out operation into success', async () => {
    let complete!: (key: CryptoKey) => void;
    const realKey = await generateIdentityKey();
    const spy = jest.spyOn(webcrypto.subtle, 'generateKey').mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = resolve;
            }) as any
    );
    jest.useFakeTimers();
    const result = generateIdentityKey();
    const rejected = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
    await jest.advanceTimersByTimeAsync(1001);
    await rejected;
    complete(realKey);
    await Promise.resolve();
    spy.mockRestore();
    jest.useRealTimers();
});
