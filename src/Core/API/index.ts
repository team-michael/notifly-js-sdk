/* eslint-disable @typescript-eslint/no-explicit-any */
import { SdkStateManager } from '../SdkState';

export class NotiflyAPI {
    private static readonly MAX_RETRY_COUNT = 3;

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
        const request: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
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
            if (retryCount < this.MAX_RETRY_COUNT) {
                return await this._call(url, method, body, redirect, retryCount + 1);
            } else {
                throw new Error(response.statusText);
            }
        }
    }
}
