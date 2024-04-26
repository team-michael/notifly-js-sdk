/* eslint-disable @typescript-eslint/no-explicit-any */
import { SdkStateManager } from '../SdkState';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { saveAndGetCognitoIdToken } from './Auth';

export class NotiflyAPI {
    private static readonly MAX_RETRY_COUNT_ON_TOKEN_EXPIRED = 3;
    private static _username: string | null = null;
    private static _password: string | null = null;
    private static _cognitoIdToken: string | null = null;

    static async initialize() {
        [this._username, this._password] = await NotiflyStorage.getItems([
            NotiflyStorageKeys.USERNAME,
            NotiflyStorageKeys.PASSWORD,
        ]);

        if (!this._username || !this._password) {
            throw new Error('Username or password not found. Call Notifly.initialize() first.');
        }

        this._cognitoIdToken = await NotiflyStorage.getItem(NotiflyStorageKeys.COGNITO_ID_TOKEN);
        if (!this._cognitoIdToken) {
            this._cognitoIdToken = await saveAndGetCognitoIdToken(this._username, this._password);
            if (!this._cognitoIdToken) {
                throw new Error('Failed to get authentication token.');
            }
        }
    }

    static async call(url: string, method: 'GET' | 'POST', body?: any, redirect?: RequestRedirect) {
        return await this._call(url, method, body, redirect);
    }

    private static async _call(
        url: string,
        method: 'GET' | 'POST',
        body?: any,
        redirect?: RequestRedirect,
        retryCount = 0
    ): Promise<any> {
        if (!this._username || !this._password) {
            console.warn('[Notifly]: APIManager has not been initialized. API may not work as expected.');
        }

        const request: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this._cognitoIdToken}`,
                'X-Notifly-SDK-Version': `notifly/js/${SdkStateManager.getSdkVersion()}`,
            },
            keepalive: true,
        };
        if (body) {
            request.body = JSON.stringify(body);
        }
        if (redirect) {
            request.redirect = redirect;
        }

        const response = await fetch(url, request);
        if (response.ok) {
            return await response.json();
        } else {
            if (retryCount < this.MAX_RETRY_COUNT_ON_TOKEN_EXPIRED) {
                if (response.status === 401) {
                    // Invalid token
                    if (!this._username || !this._password) {
                        throw new Error(
                            'Username or password required when token has expired. Please retry initialization.'
                        );
                    }
                    this._cognitoIdToken = await saveAndGetCognitoIdToken(this._username, this._password);
                    if (!this._cognitoIdToken) {
                        throw new Error('Failed to get authentication token.');
                    }
                }
                return await this._call(url, method, body, redirect, retryCount + 1);
            } else {
                throw new Error(response.statusText);
            }
        }
    }
}
