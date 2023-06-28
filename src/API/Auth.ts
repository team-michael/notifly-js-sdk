import localForage from '../LocalForage';

/**
 * Fetches a Cognito ID token for the given user name and password.
 *
 * @async
 * @param {string} userName - The user name to use for authentication.
 * @param {string} password - The password to use for authentication.
 * @returns {Promise<string>} A promise that resolves with the Cognito ID token, or rejects with an error.
 *
 * @example
 * const token = await getCognitoIdToken('myUserName', 'myPassword');
 */
async function getCognitoIdToken(userName: string, password: string): Promise<string> {
    const body = JSON.stringify({
        userName,
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
        return result.data ?? '';
    } catch (error) {
        console.warn('[Notifly]: ', error);
        return '';
    }
}

async function saveCognitoIdToken(userName: string, password: string): Promise<string> {
    const cognitoIDToken = await getCognitoIdToken(userName, password);
    await localForage.setItem('__notiflyCognitoIDToken', cognitoIDToken);
    return cognitoIDToken;
}

export { getCognitoIdToken, saveCognitoIdToken };
