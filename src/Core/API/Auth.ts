import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

/**
 * Fetches a Cognito ID token for the given user name and password.
 *
 * @async
 * @param {string} username - The user name to use for authentication.
 * @param {string} password - The password to use for authentication.
 * @returns {Promise<string>} A promise that resolves with the Cognito ID token, or rejects with an error.
 *
 * @example
 * const token = await getCognitoIdToken('myUserName', 'myPassword');
 */
export async function getCognitoIdToken(username: string, password: string): Promise<string | null> {
    if (!username || !password) {
        console.error('[Notifly]: Username or password not provided.');
        return null;
    }

    const body = JSON.stringify({
        userName: username,
        password,
    });

    const requestOptions: RequestInit = {
        method: 'POST',
        body,
    };

    try {
        const response = await fetch('https://api.notifly.tech/authorize', requestOptions);
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }
        return result.data || null;
    } catch (error) {
        console.warn('[Notifly]: ', error);
        return null;
    }
}

export async function saveAndGetCognitoIdToken(userName: string, password: string): Promise<string | null> {
    const cognitoIdToken = await getCognitoIdToken(userName, password);
    if (!cognitoIdToken) {
        return null;
    }
    await NotiflyStorage.setItem(NotiflyStorageKeys.COGNITO_ID_TOKEN, cognitoIdToken);
    return cognitoIdToken;
}
