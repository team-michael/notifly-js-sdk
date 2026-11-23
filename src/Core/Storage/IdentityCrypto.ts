import {
    EnvelopeHeader,
    ProtectedEnvelope,
    ProtectedValues,
    ProtectedStorageError,
    validateValues,
} from './ProtectedStorageTypes';

// Promise settlement fences uncancellable WebCrypto completions from subsequent writes.
function boundedCrypto<T>(operation: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new ProtectedStorageError('TIMEOUT')), 1000);
        operation.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
function cryptoAPI(): SubtleCrypto {
    const scope = typeof self === 'undefined' ? globalThis : self;
    if (
        typeof scope.crypto === 'undefined' ||
        !scope.crypto.subtle ||
        (typeof scope.isSecureContext !== 'undefined' && !scope.isSecureContext)
    ) {
        throw new ProtectedStorageError('UNSUPPORTED_ENVIRONMENT');
    }
    return scope.crypto.subtle;
}
function validateHeader(header: EnvelopeHeader): void {
    if (header.schemaVersion !== 1 || header.cryptoVersion !== 1 || header.keyVersion !== 1) {
        throw new ProtectedStorageError('UNSUPPORTED_VERSION');
    }
    if (!Number.isSafeInteger(header.revision) || header.revision < 1)
        throw new ProtectedStorageError('INVALID_IDENTITY');
}
function aad(header: EnvelopeHeader): Uint8Array {
    return new TextEncoder().encode(
        JSON.stringify([
            'notifly.identity',
            header.schemaVersion,
            header.cryptoVersion,
            header.keyVersion,
            header.revision,
        ])
    );
}
export async function generateIdentityKey(): Promise<CryptoKey> {
    return boundedCrypto(cryptoAPI().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
}
export async function encryptIdentity(
    values: ProtectedValues,
    key: CryptoKey,
    header: EnvelopeHeader
): Promise<ProtectedEnvelope> {
    validateValues(values);
    validateHeader(header);
    const subtle = cryptoAPI();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await boundedCrypto(
        subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: aad(header), tagLength: 128 },
            key,
            new TextEncoder().encode(JSON.stringify(values))
        )
    );
    return { ...header, iv, ciphertext };
}
export async function decryptIdentity(envelope: ProtectedEnvelope, key: CryptoKey): Promise<ProtectedValues> {
    validateHeader(envelope);
    const subtle = cryptoAPI();
    try {
        if (envelope.iv.byteLength !== 12 || key.extractable || key.algorithm.name !== 'AES-GCM') {
            throw new ProtectedStorageError('DECRYPT_FAILED');
        }
        const bytes = await boundedCrypto(
            subtle.decrypt(
                { name: 'AES-GCM', iv: envelope.iv, additionalData: aad(envelope), tagLength: 128 },
                key,
                envelope.ciphertext
            )
        );
        const values: unknown = JSON.parse(new TextDecoder().decode(bytes));
        validateValues(values);
        return values;
    } catch (error) {
        if (error instanceof ProtectedStorageError && error.code === 'TIMEOUT') throw error;
        throw new ProtectedStorageError('DECRYPT_FAILED');
    }
}
