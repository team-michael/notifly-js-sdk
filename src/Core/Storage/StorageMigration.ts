import { beginPerformance } from '../Diagnostics';
import { generateIdentityKey, encryptIdentity } from './IdentityCrypto';
import { ProtectedIdentityStore } from './ProtectedIdentityStore';
import { ProtectedSnapshot, ProtectedValues, PROTECTED_KEYS, ProtectedStorageError } from './ProtectedStorageTypes';

export class StorageMigration {
    constructor(
        private readonly store: ProtectedIdentityStore,
        private readonly worker: () => Promise<'compatible' | 'not-registered' | 'blocked'>,
        private readonly createDeviceId: () => string
    ) {}

    async initialize(input: { projectId: string; username: string; password: string }): Promise<ProtectedSnapshot> {
        if ((await this.worker()) === 'blocked') throw new ProtectedStorageError('MIGRATION_BLOCKED');
        let raw = await this.store.raw();
        const end = beginPerformance(raw ? 'storage.restore' : 'storage.migrate');
        let success = false;
        try {
            if (!raw) {
                const legacy = await this.store.configuration(Object.keys(PROTECTED_KEYS));
                const [projectId, , , deviceId, externalUserId] = legacy;
                if (projectId && projectId !== input.projectId) throw new ProtectedStorageError('PROJECT_MISMATCH');
                if (!deviceId && legacy.some((value) => value !== null))
                    throw new ProtectedStorageError('INVALID_IDENTITY');
                const values: ProtectedValues = {
                    ...input,
                    deviceId: deviceId ?? this.createDeviceId(),
                    externalUserId,
                };
                const key = await generateIdentityKey();
                const record = await encryptIdentity(values, key, {
                    schemaVersion: 1,
                    cryptoVersion: 1,
                    keyVersion: 1,
                    revision: 1,
                });
                await this.store.stage(key, record, legacy);
                raw = await this.store.raw();
            }
            for (let attempt = 0; attempt < 4; attempt++) {
                try {
                    if (!raw) throw new ProtectedStorageError('KEY_MISSING');
                    const snapshot = await this.store.decode(raw);
                    if (snapshot.values.projectId !== input.projectId)
                        throw new ProtectedStorageError('PROJECT_MISMATCH');
                    if (raw.status !== 'ready' && raw.status !== 'pending')
                        throw new ProtectedStorageError('UNSUPPORTED_VERSION');
                    await this.store.finish(snapshot);
                    if (snapshot.values.username !== input.username || snapshot.values.password !== input.password) {
                        const updated = await this.store.patch(
                            { username: input.username, password: input.password },
                            snapshot.revision
                        );
                        success = true;
                        return updated;
                    }
                    success = true;
                    return snapshot;
                } catch (error) {
                    if (
                        !(error instanceof ProtectedStorageError) ||
                        error.code !== 'REVISION_CONFLICT' ||
                        attempt === 3
                    )
                        throw error;
                    raw = await this.store.raw();
                }
            }
            throw new ProtectedStorageError('REVISION_CONFLICT');
        } finally {
            end(success);
        }
    }
}
