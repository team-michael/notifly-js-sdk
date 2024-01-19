import { RequestPermissionPromptDesignParams } from '../Interfaces/RequestPermissionPromptDesignParams';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

const DEFAULTS = {
    sessionDuration: 1800,
    serviceWorkerPath: '/notifly-service-worker.js',
};

export interface SdkConfiguration {
    sessionDuration: number;
    useWebPush: boolean;
    webPushOptions?: {
        vapidPublicKey: string;
        serviceWorkerPath: string;
        askPermission: boolean;
        promptDelayMillis?: number;
        promptDesignParams?: RequestPermissionPromptDesignParams;
    };
}

export async function getSdkConfiguration(): Promise<SdkConfiguration> {
    const projectId = await NotiflyStorage.getItem(NotiflyStorageKeys.PROJECT_ID);
    if (!projectId) {
        throw new Error('Project ID not found. Did you forget to call Notifly.initialize()?');
    }

    const url = `https://api.notifly.tech/sdk-configurations?project_id=${projectId}&type=website`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to get SDK configuration.');
    }

    const { data, error } = await response.json();
    if (error) {
        throw new Error(error);
    }

    const result = {
        sessionDuration: data.session_duration || DEFAULTS.sessionDuration,
        useWebPush: !!data.use_web_push,
    };

    if (result.useWebPush) {
        if (!data.web_push_options) {
            throw new Error('Invalid configuration: web push options should be set when use_web_push is true');
        }

        const { vapid_public_key, ask_permission, service_worker_path, prompt_delay_millis, prompt_design_params } =
            data.web_push_options;
        if (!vapid_public_key) {
            throw new Error('Invalid configuration: vapid_public_key is required');
        }

        const webPushOptions = {
            vapidPublicKey: vapid_public_key,
            askPermission: !!ask_permission,
            serviceWorkerPath: service_worker_path || DEFAULTS.serviceWorkerPath,
            promptDelayMillis: prompt_delay_millis,
            promptDesignParams: prompt_design_params,
        };

        return {
            ...result,
            webPushOptions,
        };
    } else {
        return result;
    }
}
