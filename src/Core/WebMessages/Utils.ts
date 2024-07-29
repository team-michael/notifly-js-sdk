/* eslint-disable @typescript-eslint/no-explicit-any */
import { ValueType } from '../Interfaces/Campaign';

export type PopupVersion = 1 | 2;

export class ValueComparator {
    private static _castOrThrow(value: any, type: ValueType | 'ARRAY') {
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

    private static _castOrNull(value: any, type: ValueType | 'ARRAY') {
        try {
            return this._castOrThrow(value, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return null;
        }
    }

    static IsEqual(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) === this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsNotEqual(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) !== this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsGreaterThan(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) > this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsGreaterThanOrEqual(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) >= this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsLessThan(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) < this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static IsLessThanOrEqual(a: any, b: any, type: ValueType): boolean {
        try {
            return this._castOrThrow(a, type) <= this._castOrThrow(b, type);
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static HasElement(a: any, b: any, type: ValueType): boolean {
        try {
            const array = this._castOrThrow(a, 'ARRAY') as any[];
            const value = this._castOrThrow(b, type);

            return array.some(
                ((element: any) => {
                    if (this.IsEqual(element, value, type)) {
                        return true;
                    }
                    return false;
                }).bind(this)
            );
        } catch (error) {
            console.warn(`[Notifly] ${(error as Error).message}`);
            return false;
        }
    }

    static StartsWith(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !!castedA?.startsWith(castedB);
    }

    static DoesNotStartWith(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !castedA?.startsWith(castedB);
    }

    static EndsWith(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !!castedA?.endsWith(castedB);
    }

    static DoesNotEndWith(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !castedA?.endsWith(castedB);
    }

    static Contains(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !!castedA?.includes(castedB);
    }

    static DoesNotContain(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !castedA?.includes(castedB);
    }

    static MatchesRegex(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !!matchRegex(castedA ?? '', castedB);
    }

    static DoesNotMatchRegex(a: any, b: any): boolean {
        const castedA = this._castOrNull(a, 'TEXT') as string | null;
        const castedB = this._castOrNull(b, 'TEXT') as string | null;

        return castedB !== null && !matchRegex(castedA ?? '', castedB);
    }
}

export function matchRegex(str: string, regex: string): boolean {
    try {
        return new RegExp(regex).test(str);
    } catch (error) {
        console.warn(`[Notifly] ${(error as Error).message}`);
        return false;
    }
}

export function getKSTCalendarDateString(daysOffset = 0) {
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kstDate.setDate(kstDate.getDate() + daysOffset);
    return kstDate.toISOString().split('T')[0];
}

export function isValueNotPresent(value: any) {
    return typeof value === 'undefined' || value === null;
}

export const reEligibleConditionUnitToSec: Record<string, number> = {
    h: 3600,
    d: 24 * 3600,
    w: 7 * 24 * 3600,
    m: 30 * 24 * 3600,
};
