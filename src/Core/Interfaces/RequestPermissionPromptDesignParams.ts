export interface TextContent {
    ko?: string;
    en?: string;
}

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
