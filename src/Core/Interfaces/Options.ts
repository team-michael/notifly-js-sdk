/**
 * @typedef {Object} NotiflyInitializeOptions
 * @property {string} projectId - The project ID of the Notifly project.
 * @property {string} [username] - Legacy username, accepted for compatibility.
 * @property {string} [password] - Legacy password, accepted for compatibility.
 */
export type NotiflyInitializeOptions = {
    projectId: string;
    username?: string;
    password?: string;
    allowUserSuppliedLogEvent?: boolean;
};

/**
 * @typedef {Object} SetUserIdOptions
 * @property {boolean} [onlyIfChanged] - If true, the user ID will only be set if it is different from the current user ID. Default is false.
 */
export type SetUserIdOptions = {
    onlyIfChanged?: boolean;
};
