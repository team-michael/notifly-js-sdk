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
async function getCognitoIdToken(userName: any, password: any) {
    const headers = new Headers({
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        'Content-Type': 'application/x-amz-json-1.1',
    });

    const body = JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
            PASSWORD: password,
            USERNAME: userName,
        },
        ClientId: '2pc5pce21ec53csf8chafknqve',
    });

    const requestOptions = {
        method: 'POST',
        headers,
        body,
        redirect: 'follow',
    };

    try {
        // @ts-expect-error TS(2345): Argument of type '{ method: string; headers: Heade... Remove this comment to see the full error message
        const response = await fetch('https://cognito-idp.ap-northeast-2.amazonaws.com/', requestOptions);
        const result = await response.text();
        const token = JSON.parse(result).AuthenticationResult.IdToken;
        return token;
    } catch (error) {
        console.warn('[Notifly]: ', error);
    }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'saveCognit... Remove this comment to see the full error message
async function saveCognitoIdToken(userName: any, password: any) {
    const cognitoIDToken = await getCognitoIdToken(userName, password);
    localStorage.setItem('__notiflyCognitoIDToken', cognitoIDToken);
}

// @ts-expect-error TS(2580): Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
    saveCognitoIdToken,
};
