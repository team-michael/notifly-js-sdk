import { EventLogger } from '../Event';
import { Language } from '../Interfaces/RequestPermissionPromptDesignParams';
import { NotiflyWebPushManager } from '../Push';
import { UserIdentityManager } from '../User';
import { SetUserIdCommandParams, SetUserPropertiesCommandParams, TrackEventCommandParams } from './Params';

export enum CommandType {
    SET_USER_ID,
    SET_USER_PROPERTIES,
    TRACK_EVENT,
    REQUEST_PERMISSON,
    GET_USER_ID,
    GET_USER_PROPERTIES,
}

export interface CommandBase<T = any> {
    type: CommandType;
    unrecoverable: boolean; // If true, the SDK will fail when this command fails
    execute(): Promise<T>;
}

export class SetUserIdCommand implements CommandBase<void> {
    public type = CommandType.SET_USER_ID;
    public unrecoverable = true;
    private _params: SetUserIdCommandParams;

    constructor(params: SetUserIdCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { userId } = this._params;
        return UserIdentityManager.setUserId.call(UserIdentityManager, userId);
    }
}

export class RemoveUserIdCommand implements CommandBase<void> {
    public type = CommandType.SET_USER_ID;
    public unrecoverable = true;

    execute(): Promise<void> {
        return UserIdentityManager.setUserId.call(UserIdentityManager, null);
    }
}

export class SetUserPropertiesCommand implements CommandBase<void> {
    public type = CommandType.SET_USER_PROPERTIES;
    public unrecoverable = false;
    private _params: SetUserPropertiesCommandParams;

    constructor(params: SetUserPropertiesCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { params } = this._params;
        return UserIdentityManager.setUserProperties.call(UserIdentityManager, params);
    }
}

export class TrackEventCommand implements CommandBase<void> {
    public type = CommandType.TRACK_EVENT;
    public unrecoverable = false;
    private _params: TrackEventCommandParams;

    constructor(params: TrackEventCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { eventName, eventParams, segmentationEventParamKeys } = this._params;
        return EventLogger.logEvent.call(EventLogger, eventName, eventParams, segmentationEventParamKeys);
    }
}

export class RequestPermissionCommand implements CommandBase<void> {
    public type = CommandType.REQUEST_PERMISSON;
    public unrecoverable = false;
    private _languageToForce?: Language;

    constructor(languageToForce?: Language) {
        this._languageToForce = languageToForce;
    }

    execute(): Promise<void> {
        return Promise.resolve(
            NotiflyWebPushManager.requestPermission.call(NotiflyWebPushManager, this._languageToForce)
        );
    }
}

export class GetUserIdCommand implements CommandBase<string | null> {
    public type = CommandType.GET_USER_ID;
    public unrecoverable = false;

    execute() {
        return UserIdentityManager.getUserId.call(UserIdentityManager);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class getUserPropertiesCommand implements CommandBase<Record<string, any> | null> {
    public type = CommandType.GET_USER_PROPERTIES;
    public unrecoverable = false;

    execute() {
        return UserIdentityManager.getUserProperties.call(UserIdentityManager);
    }
}
