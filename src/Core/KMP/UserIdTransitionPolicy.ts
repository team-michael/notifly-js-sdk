import { tech } from 'notifly-kmp-sdk';

export interface UserIdTransitionDecision {
    changed: boolean;
    shouldSync: boolean;
    shouldMerge: boolean;
    shouldClear: boolean;
}

export function evaluateUserIdTransition(
    previousUserId: string | null,
    newUserId: string | null
): UserIdTransitionDecision {
    const decision = tech.notifly.kmp.identity.UserIdTransitionPolicy.evaluate(previousUserId, newUserId);

    return {
        changed: decision.changed,
        shouldSync: decision.shouldSync,
        shouldMerge: decision.shouldMerge,
        shouldClear: decision.shouldClear,
    };
}
