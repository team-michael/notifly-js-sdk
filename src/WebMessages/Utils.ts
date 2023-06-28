/* eslint-disable @typescript-eslint/no-explicit-any */
import { SegmentConditionValueType } from '../Types';

export class ConditionValueComparator {
    private static _SafeCast(value: any, type: SegmentConditionValueType | 'ARRAY') {
        switch (type) {
            case 'TEXT':
                if (typeof value !== 'string') {
                    if (typeof value === 'number') {
                        return value.toString();
                    } else if (typeof value === 'boolean') {
                        return value ? 'true' : 'false';
                    }
                    throw new Error('Value is not a string');
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
                    throw new Error('Value is not a number');
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
                            throw new Error('Value is not a boolean');
                        }
                    }
                    throw new Error('Value is not a boolean');
                }
                return value;
            case 'ARRAY':
                if (!Array.isArray(value)) {
                    throw new Error('Value is not an array');
                }
                return value;
            default:
                throw new Error('Invalid type');
        }
    }

    static IsEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) === this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static IsNotEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) !== this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static IsGreaterThan(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) > this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static IsGreaterThanOrEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) >= this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static IsLessThan(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) < this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static IsLessThanOrEqual(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            return this._SafeCast(a, type) <= this._SafeCast(b, type);
        } catch (error) {
            return false;
        }
    }

    static Contains(a: any, b: any, type: SegmentConditionValueType): boolean {
        try {
            const array = this._SafeCast(a, 'ARRAY') as any[];
            const value = this._SafeCast(b, type);

            array.some((element) => {
                if (this.IsEqual(element, value, type)) {
                    return true;
                }
            });
            return false;
        } catch (error) {
            return false;
        }
    }
}

export function getKSTCalendarDateString(daysOffset = 0) {
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kstDate.setDate(kstDate.getDate() + daysOffset);
    return kstDate.toISOString().split('T')[0];
}


