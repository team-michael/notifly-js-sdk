export type ProtectedValues = {
    projectId: string;
    username: string;
    password: string;
    deviceId: string;
    externalUserId: string | null;
};
export type ProtectedSnapshot = { revision: number; values: ProtectedValues };
export type EnvelopeHeader = { schemaVersion: number; cryptoVersion: number; keyVersion: number; revision: number };
export type ProtectedEnvelope = EnvelopeHeader & { iv: Uint8Array; ciphertext: ArrayBuffer };
export type StorageErrorCode =
    | 'UNSUPPORTED_ENVIRONMENT'
    | 'KEY_MISSING'
    | 'DECRYPT_FAILED'
    | 'UNSUPPORTED_VERSION'
    | 'TRANSACTION_FAILED'
    | 'TIMEOUT'
    | 'REVISION_CONFLICT'
    | 'MIGRATION_BLOCKED'
    | 'INVALID_IDENTITY'
    | 'PROJECT_MISMATCH';
export class ProtectedStorageError extends Error {
    constructor(public readonly code: StorageErrorCode) {
        super('[Notifly storage] ' + code);
        this.name = 'ProtectedStorageError';
        Object.setPrototypeOf(this, ProtectedStorageError.prototype);
    }
}
export function validateValues(value: unknown): asserts value is ProtectedValues {
    const v = value as ProtectedValues | null;
    if (
        !v ||
        ['projectId', 'username', 'password', 'deviceId'].some(
            (k) =>
                typeof (v as unknown as Record<string, unknown>)[k] !== 'string' ||
                !(v as unknown as Record<string, unknown>)[k]
        ) ||
        !(v.externalUserId === null || typeof v.externalUserId === 'string')
    ) {
        throw new ProtectedStorageError('INVALID_IDENTITY');
    }
}
export const LEGACY_STORE = 'notiflyconfig';
export const CONFIG_STORE = 'notiflyconfig-v2';
export const PROTECTED_STORE = 'notiflyprotected';
export const PROTECTED_KEYS = {
    __notiflyProjectID: 'projectId',
    __notiflyUserName: 'username',
    __notiflyPassword: 'password',
    __notiflyDeviceID: 'deviceId',
    __notiflyExternalUserID: 'externalUserId',
} as const;
export const STATE_KEY = '__notiflyState';
