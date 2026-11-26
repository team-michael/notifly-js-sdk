export interface EncryptedIdentity {
    iv: Uint8Array;
    ciphertext: ArrayBuffer;
}

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

/** Checks API availability only; migration still verifies encryption and persisted key readback. */
export function isIdentityCryptoSupported(): boolean {
    return (
        typeof globalThis !== 'undefined' &&
        typeof globalThis.crypto?.getRandomValues === 'function' &&
        typeof globalThis.crypto?.subtle?.generateKey === 'function' &&
        typeof globalThis.crypto?.subtle?.encrypt === 'function' &&
        typeof globalThis.crypto?.subtle?.decrypt === 'function' &&
        typeof TextEncoder === 'function' &&
        typeof TextDecoder === 'function'
    );
}

function getCrypto(): Crypto {
    if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
        throw new Error('[Notifly] Web Crypto API is unavailable.');
    }
    return globalThis.crypto;
}

function validateKey(key: CryptoKey): void {
    if (
        key.type !== 'secret' ||
        key.extractable ||
        key.algorithm.name !== ALGORITHM ||
        (key.algorithm as AesKeyAlgorithm).length !== KEY_LENGTH
    ) {
        throw new Error('[Notifly] A non-extractable AES-256-GCM key is required.');
    }
}

export async function generateIdentityKey(): Promise<CryptoKey> {
    return getCrypto().subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
}

/** Encrypts the serialized identity payload, including its field names. */
export async function encryptIdentity(plaintext: string, key: CryptoKey): Promise<EncryptedIdentity> {
    const crypto = getCrypto();
    validateKey(key);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
        key,
        new TextEncoder().encode(plaintext)
    );
    return { iv, ciphertext };
}

export async function decryptIdentity(encrypted: EncryptedIdentity, key: CryptoKey): Promise<string> {
    const crypto = getCrypto();
    validateKey(key);
    if (encrypted.iv.byteLength !== IV_LENGTH) {
        throw new Error('[Notifly] The identity encryption IV must be 12 bytes.');
    }
    const plaintext = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: encrypted.iv, tagLength: TAG_LENGTH },
        key,
        encrypted.ciphertext
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
