/* eslint-disable @typescript-eslint/no-explicit-any */
import { SegmentConditionValueType } from '../Types';

export class ConditionValueComparator {
    private static _safeCast(value: any, type: SegmentConditionValueType | 'ARRAY') {
        switch (type) {
            case 'TEXT':
                if (typeof value !== 'string') {
                    if (typeof value === 'number') {
                        return value.toString();
                    } else if (typeof value === 'boolean') {
                        return value ? 'true' : 'false';
                    }
                    throw new Error(`Unrecoverable type mismatch: expected ${type}, got ${typeof value}`);
                }
                return value;
            case 'INT':
                if (typeof value !== 'number') {
                    if (typeof value === 'string') {
                        const parsed = parseInt(value, 10);
                        if (isNaN(parsed)) {
                            throw new Error('Value is not a number');
                        } else return parsed;
                    }
                    throw new Error(`Unrecoverable type mismatch: expected ${type}, got ${typeof value}`);
                }
                return value;
            case 'BOOL':
                if (typeof value !== 'boolean') {
                    if (typeof value === 'string') {
                        if (value === 'true') {
                            return true;
                        } else if (value === 'false') {
                            return false;
                        } else {
                            throw new Error(`Unrecoverable type mismatch: expected ${type}, got ${typeof value}`);
                        }
                    }
                    throw new Error(`Unrecoverable type mismatch: expected ${type}, got ${typeof value}`);
                }
                return value;
            case 'ARRAY':
                if (!Array.isArray(value)) {
                    throw new Error(`Unrecoverable type mismatch: expected ${type}, got ${typeof value}`);
                }
                return value;
            default:
                throw new Error(`Unrecoverable type mismatch: invalid type ${type}`);
        }
    }

    static IsEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) === this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsNotEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) !== this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsGreaterThan(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) > this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsGreaterThanOrEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) >= this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsLessThan(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) < this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsLessThanOrEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._safeCast(a, type) <= this._safeCast(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static Contains(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            const array = this._safeCast(a, 'ARRAY') as any[];
            const value = this._safeCast(b, type);

            return array.some(
                ((element: any) => {
                    if (this.IsEqual(element, value, type)) {
                        return true;
                    }
                }).bind(this)
            );
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }
}

export function getKSTCalendarDateString(daysOffset = 0) {
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kstDate.setDate(kstDate.getDate() + daysOffset);
    return kstDate.toISOString().split('T')[0];
}

export function isValidWebMessageState(state: any): boolean {
    // TODO: validate campaign too
    if (!state || !state.eventIntermediateCounts || !state.userData || !state.inWebMessageCampaigns) {
        return false;
    }
    if (!Array.isArray(state.eventIntermediateCounts)) {
        return false;
    }
    if (state.eventIntermediateCounts.some((eic: any) => !isValidEventIntermediateCounts(eic))) {
        return false;
    }
    if (!isValidUserData(state.userData)) {
        return false;
    }

    return true;
}

export function isValidEventIntermediateCounts(eic: any): boolean {
    // dt should be YYYY-MM-DD format
    if (
        eic &&
        eic.dt &&
        typeof eic.dt === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(eic.dt) &&
        eic.name &&
        typeof eic.name === 'string' &&
        eic.count &&
        typeof eic.count === 'number' &&
        eic.event_params &&
        typeof eic.event_params === 'object'
    ) {
        return true;
    } else {
        return false;
    }
}

export function isValidUserData(userData: any): boolean {
    return typeof userData === 'object';
}
