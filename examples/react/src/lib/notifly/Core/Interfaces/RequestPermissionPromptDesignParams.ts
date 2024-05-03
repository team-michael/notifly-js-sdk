export const Language = Object.freeze({
    KO: 'ko',
    EN: 'en',
    JA: 'ja', // Japanese
    ZH: 'zh', // Chinese
});

export type Language = (typeof Language)[keyof typeof Language];

export type TextContent = {
    [lang in Language]?: string;
};

export interface ButtonDesignParams {
    backgroundColor?: string;
    backgroundHoverColor?: string;
    color?: string;
    text?: TextContent;
}

export interface TextDesignParams {
    color?: string;
    text?: TextContent;
}

export interface RequestPermissionPromptDesignParams {
    backgroundColor?: string;
    borderColor?: string;
    headerDesign?: TextDesignParams;
    messageDesign?: TextDesignParams;
    grantButtonDesign?: ButtonDesignParams;
    denyButtonDesign?: ButtonDesignParams;
    bellIconColor?: string;
    closeButtonColor?: string;
}
