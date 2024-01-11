import { EventLogger } from '../../Event';
import { UserIdentityManager } from '../../User';

import { SetUserIdCommandParams, SetUserPropertiesCommandParams, TrackEventCommandParams } from './Params';

export enum CommandType {
    SET_USER_ID,
    SET_USER_PROPERTIES,
    TRACK_EVENT,
}

export interface CommandBase {
    type: CommandType;
    execute(): Promise<void>;
}

export class SetUserIdCommand implements CommandBase {
    public type = CommandType.SET_USER_ID;
    private _params: SetUserIdCommandParams;

    constructor(params: SetUserIdCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { userId } = this._params;
        return UserIdentityManager.setUserId.call(UserIdentityManager, userId);
    }
}

export class RemoveUserIdCommand implements CommandBase {
    public type = CommandType.SET_USER_ID;

    execute(): Promise<void> {
        return UserIdentityManager.setUserId.call(UserIdentityManager, null);
    }
}

export class SetUserPropertiesCommand implements CommandBase {
    public type = CommandType.SET_USER_PROPERTIES;
    private _params: SetUserPropertiesCommandParams;

    constructor(params: SetUserPropertiesCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { params } = this._params;
        return UserIdentityManager.setUserProperties.call(UserIdentityManager, params);
    }
}

export class TrackEventCommand implements CommandBase {
    public type = CommandType.TRACK_EVENT;
    private _params: TrackEventCommandParams;

    constructor(params: TrackEventCommandParams) {
        this._params = params;
    }

    execute(): Promise<void> {
        const { eventName, eventParams, segmentationEventParamKeys } = this._params;
        return EventLogger.logEvent.call(EventLogger, eventName, eventParams, segmentationEventParamKeys);
    }
}
