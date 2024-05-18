/**
 * @typedef {Object} NotiflyInitializeOptions
 * @property {string} projectId - The project ID of the Notifly project.
 * @property {string} username - Username to authorize Notifly project.
 * @property {string} password - Password to authorize Notifly project.
 */
export type NotiflyInitializeOptions = {
    projectId: string;
    username: string;
    password: string;
};

/**
 * @typedef {Object} SetUserIdOptions
 * @property {boolean} [onlyIfChanged] - If true, the user ID will only be set if it is different from the current user ID. Default is false.
 */
export type SetUserIdOptions = {
    onlyIfChanged?: boolean;
};
