/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    type InWebMessageTemplateProps,
    type InWebMessageModalProps,
    type RenderSourceType,
    type Animation,
    AnimationType,
} from './Types';

const SUPPORTED_TEMPLATE_VERSION_RANGE = [2, 3];

const KEYFRAME_NAMESPACE = '--notifly-';

export function validateTemplate(template: InWebMessageTemplateProps): void {
    _validateVersion(template);

    if (!template.modal_props_narrow || !template.modal_props_wide) {
        throw new Error('Invalid template: modal_props_narrow and modal_props_wide are required');
    }

    const { animation } = template;
    if (typeof animation !== 'undefined') {
        const { enter, leave } = animation;
        if (enter) {
            if (!Object.values(AnimationType).includes(enter.type)) {
                throw new Error(`Invalid entry animation type: ${enter.type}`);
            }
            if (!enter.duration) {
                throw new Error('Invalid entry animation: duration is required');
            }
        }
        if (leave) {
            if (!Object.values(AnimationType).includes(leave.type)) {
                throw new Error(`Invalid exit animation type: ${leave.type}`);
            }
            if (!leave.duration) {
                throw new Error('Invalid exit animation: duration is required');
            }
        }
    }

    _validateModalProps(template.modal_props_narrow);
    _validateModalProps(template.modal_props_wide);
}

export function getPropsToApply(template: InWebMessageTemplateProps, isNarrow: boolean): InWebMessageModalProps {
    return isNarrow ? template.modal_props_narrow : template.modal_props_wide;
}

export function sanitizeCSSStyle(value: string | number | undefined, defaultValue = 'auto'): string {
    if (typeof value === 'number') {
        return `${value}px`;
    } else if (typeof value === 'string') {
        return value;
    } else {
        return defaultValue;
    }
}

export function conjectureSourceType(source: string): RenderSourceType {
    const _source = source.trim();
    if (_source.startsWith('<')) {
        return 'html';
    } else if (_source.startsWith('http')) {
        return 'url';
    } else {
        throw new Error(`Invalid source: ${source}`);
    }
}

export function getKeyframeName(animationType: AnimationType, action: keyof Animation) {
    return `${KEYFRAME_NAMESPACE}${animationType}-${action}`;
}

export function getKeyframes() {
    return `
    @keyframes ${getKeyframeName(AnimationType.FADE, 'enter')} {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_TOP, 'enter')} {
        from {
            opacity: 0;
            transform: translateY(50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_BOTTOM, 'enter')} {
        from {
            opacity: 0;
            transform: translateY(-50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_LEFT, 'enter')} {
        from {
            opacity: 0;
            transform: translateX(50px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_RIGHT, 'enter')} {
        from {
            opacity: 0;
            transform: translateX(-50px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes ${getKeyframeName(AnimationType.ROTATE, 'enter')} {
        from {
            opacity: 0;
            transform: rotate(100deg);
        }
        to {
            opacity: 1;
            transform: rotate(0);
        }
    }

    @keyframes ${getKeyframeName(AnimationType.FADE, 'leave')} {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_TOP, 'leave')} {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-50px);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_BOTTOM, 'leave')} {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(50px);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_LEFT, 'leave')} {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50px);
        }
    }
    @keyframes ${getKeyframeName(AnimationType.SLIDE_TO_RIGHT, 'leave')} {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(50px);
        }
    }

    @keyframes ${getKeyframeName(AnimationType.ROTATE, 'leave')} {
        from {
            opacity: 1;
            transform: rotate(0);
        }
        to {
            opacity: 0;
            transform: rotate(100deg);
        }
    }
    `;
}

function _validateModalProps(props: InWebMessageModalProps): void {
    if (!_isObject(props)) {
        throw new Error('Invalid modal props: object is expected');
    }
}

function _validateVersion(props: InWebMessageTemplateProps): void {
    const { version } = props;
    if (typeof version !== 'number') {
        throw new Error('Invalid template: version must be a number');
    }
    if (version < SUPPORTED_TEMPLATE_VERSION_RANGE[0]) {
        throw new Error(`Invalid template: version ${version} is deprecated`);
    }
    if (version > SUPPORTED_TEMPLATE_VERSION_RANGE[1]) {
        throw new Error(`Invalid template: version ${version} is not supported in this SDK version.`);
    }
}

function _isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
