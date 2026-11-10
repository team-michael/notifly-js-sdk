import { BuiltInUserPropertyKey } from '../../Constants';

const reservedKeys = new Set<string>([...Object.values(BuiltInUserPropertyKey), '$line_user_id', '$appsflyer_id']);

export function getInvalidUserPropertyKeys(keys: string[]): string[] {
    return keys.filter((key) => !reservedKeys.has(key) && (key.length === 0 || /[^A-Za-z0-9_]/.test(key))).sort();
}
