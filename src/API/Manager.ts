import localForage from '../LocalForage';

import { saveCognitoIdToken } from './Auth';

export class APIManager {
    private static readonly MAX_RETRY_COUNT_ON_TOKEN_EXPIRED = 3;
    private static username: string | null = null;
    private static password: string | null = null;
    private static cognitoIdToken: string | null = null;

    static async initialize(username: string, password: string) {
        this.username = username;
        this.password = password;

        await Promise.all([
            localForage.setItem('__notiflyUserName', username),
            localForage.setItem('__notiflyPassword', password),
        ]);

        this.cognitoIdToken = await localForage.getItem<string>('__notiflyCognitoIDToken');
        if (!this.cognitoIdToken) {
            this.cognitoIdToken = await saveCognitoIdToken(username, password);
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
        if (!this.username || !this.password) {
            console.warn('[Notifly]: APIManager has not been initialized. API may not work as expected.');
        }

        const request: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.cognitoIdToken}`,
            },
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
                    if (!this.username || !this.password) {
                        throw new Error(
                            'Username or password required when token has expired. Call APIManager.initialize() first to refresh token.'
                        );
                    }
                    this.cognitoIdToken = await saveCognitoIdToken(this.username, this.password);
                }
                return await this._call(url, method, body, redirect, retryCount + 1);
            } else {
                throw new Error(response.statusText);
            }
        }
    }
}
