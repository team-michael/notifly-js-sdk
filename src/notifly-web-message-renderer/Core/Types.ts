export type RenderSourceType = 'html' | 'url';
export type RendererCallbacks = {
    onRenderCompleted?: () => void | Promise<void>;
    onRenderFailed?: (error: unknown) => void | Promise<void>;
    onAutoDismissed?: () => void | Promise<void>;
};

export interface InWebMessageTemplateProps {
    version: number;
    template_name: string;
    modal_props_narrow: InWebMessageModalProps;
    modal_props_wide: InWebMessageModalProps;
    animation?: Animation;
    auto_dismiss_after_seconds?: number;
}

export type BorderRadius =
    | string
    | number
    | {
          bottom_left?: string;
          bottom_right?: string;
          top_left?: string;
          top_right?: string;
      };

export interface InWebMessageModalProps {
    position: 'fixed' | 'absolute';
    width?: string | number;
    height?: string | number;
    background?: boolean;
    background_opacity?: number;
    center?: boolean;
    right?: string | number;
    left?: string | number;
    top?: string | number;
    bottom?: string | number;
    padding?: string | number;
    box_shadow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    border_radius?: BorderRadius;
}

export const AnimationType = Object.freeze({
    FADE: 'fade',
    SLIDE_TO_TOP: 'slide-to-top',
    SLIDE_TO_BOTTOM: 'slide-to-bottom',
    SLIDE_TO_LEFT: 'slide-to-left',
    SLIDE_TO_RIGHT: 'slide-to-right',
    ROTATE: 'rotate',
});
export type AnimationType = (typeof AnimationType)[keyof typeof AnimationType];

export type Animation = {
    enter?: {
        type: AnimationType;
        duration: number;
        timing_function?: string;
    };
    leave?: {
        type: AnimationType;
        duration: number;
        timing_function?: string;
    };
};
