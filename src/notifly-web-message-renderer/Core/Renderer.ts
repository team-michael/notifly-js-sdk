/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    Animation,
    BorderRadius,
    InWebMessageModalProps,
    InWebMessageTemplateProps,
    RendererCallbacks,
} from './Types';

import {
    sanitizeCSSStyle,
    getPropsToApply,
    conjectureSourceType,
    validateTemplate,
    getKeyframes,
    getKeyframeName,
} from './Utils';

const WIDE_SCREEN_THRESHOLD = 640;

export default class Renderer {
    private static _state: 'uninitialized' | 'idle' | 'processing' | 'completed' | 'closing' = 'uninitialized';
    private static _renderType: 'normal' | 'withBackgroundLayer' = 'normal';
    private static _source: string | null = null;

    private static _callbacks: RendererCallbacks = {};

    private static _props: InWebMessageTemplateProps | null = null;
    private static _isNarrow = false;

    private static _scope: HTMLElement;
    private static _backgroundLayer: HTMLDivElement;
    private static _iframeContainer: HTMLDivElement;
    private static _iframe: HTMLIFrameElement;

    private static _areKeyframesInjected = false;
    private static _areResizeEventListenersAttached = false;

    // Timers
    private static _autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
    private static _closingTimer: ReturnType<typeof setTimeout> | null = null;

    public static get iframe() {
        return this._iframe;
    }

    static render(template: InWebMessageTemplateProps, source: string, callbacks: RendererCallbacks = {}) {
        this._callbacks = callbacks;
        this._renderWrapper(document.body, template, source);
    }

    static async close() {
        if (this._state === 'uninitialized' || this._state === 'idle') return;
        if (this._state === 'closing') return;

        this._clearAutoDismissTimer();

        this._state = 'closing';

        const waitTimeMs = this._maybeAttachLeaveAnimationStyleToIframeAndReturnWaitMs(this._props?.animation);
        if (!waitTimeMs) {
            this.dispose();
            return;
        }

        return new Promise<void>((resolve) => {
            this._closingTimer = setTimeout(() => {
                this.dispose();
                this._closingTimer = null;
                resolve();
            }, waitTimeMs);
        });
    }

    static dispose() {
        if (this._state === 'uninitialized' || this._state === 'idle') return;
        if (this._scope === null) return;

        this._clearAutoDismissTimer();

        try {
            this._iframeContainer.removeChild(this._iframe);
            switch (this._renderType) {
                case 'normal':
                    this._scope.removeChild(this._iframeContainer);
                    break;
                case 'withBackgroundLayer':
                    this._backgroundLayer.removeChild(this._iframeContainer);
                    this._scope.removeChild(this._backgroundLayer);
                    break;
            }
            this._removeResizeEventListeners();
        } catch (e) {
            console.error('[Notifly Web Message Renderer] Error while disposing renderer:', e);
        }

        this._state = 'idle';
    }

    private static async _renderWrapper(scope: HTMLElement, template: InWebMessageTemplateProps, source: string) {
        const { onRenderCompleted, onRenderFailed } = this._callbacks;
        this._render(scope, template, source)
            .then(() => onRenderCompleted?.())
            .catch((e) => onRenderFailed?.(e));
    }

    private static async _render(scope: HTMLElement, template: InWebMessageTemplateProps, source: string) {
        try {
            validateTemplate(template);
        } catch (e) {
            this.dispose();
            throw e;
        }
        this._injectKeyframes();

        if (this._closingTimer) {
            clearTimeout(this._closingTimer);
            this._closingTimer = null;
        }
        if (this._state === 'closing') {
            // If the renderer is closing, we need to dispose it first.
            this.dispose();
        }

        if (this._state === 'uninitialized') {
            // Initialize renderer
            this._scope = scope || document.body;

            this._backgroundLayer = this._createBackgroundLayer();
            this._iframeContainer = this._createIframeContainer();
            this._iframe = this._createIframe();

            this._state = 'idle';
        }

        if (this._state === 'processing') {
            console.warn(
                '[Notifly Web Message Renderer] Cannot render while processing the previous render request. Ignoring this request...'
            );
            return;
        }

        if (template.auto_dismiss_after_seconds) {
            this._setAutoDismissTimer(template.auto_dismiss_after_seconds);
        }

        const isNewlyRendered = this._state === 'idle';
        const shouldIframeContentBeSwitched = this._source !== source;

        this._props = template;
        this._isNarrow = window.innerWidth < WIDE_SCREEN_THRESHOLD;

        const propsToApply = getPropsToApply(template, this._isNarrow);
        if (!propsToApply) {
            this._state = 'idle';
            throw new Error('Unexpected error: cannot get modal props to apply. Aborting...');
        }

        const shouldRenderBackground = !!propsToApply.background;
        const previousRenderType = this._renderType;
        this._renderType = shouldRenderBackground ? 'withBackgroundLayer' : 'normal';

        // Style elements
        BackgroundLayerStyler.style(this._backgroundLayer, propsToApply);
        IframeContainerStyler.style(this._iframeContainer, propsToApply);

        if (shouldIframeContentBeSwitched) {
            // Temporarily hide web message while switching iframe content
            this._hideWebMessage();
        }

        this._maybeAttachEnterAnimationStyleToIframe(template.animation);

        // DOM structure manipulation
        this._scope = scope || document.body;

        if (isNewlyRendered) {
            this._iframeContainer.appendChild(this._iframe);
            switch (this._renderType) {
                case 'normal':
                    this._insert(this._scope, this._iframeContainer);
                    break;
                case 'withBackgroundLayer':
                    this._backgroundLayer.appendChild(this._iframeContainer);
                    this._insert(this._scope, this._backgroundLayer);
                    break;
            }
        } else {
            // In this case, all elements are in-place.
            if (previousRenderType !== this._renderType) {
                switch (previousRenderType) {
                    case 'normal':
                        // Add background layer
                        document.body.removeChild(this._iframeContainer);
                        this._backgroundLayer.appendChild(this._iframeContainer);
                        this._insert(this._scope, this._backgroundLayer);
                        break;
                    case 'withBackgroundLayer':
                        // Remove background layer
                        this._backgroundLayer.removeChild(this._iframeContainer);
                        document.body.removeChild(this._backgroundLayer);
                        this._insert(this._scope, this._iframeContainer);
                        break;
                }
            } else {
                // No-op since renderType has not been changed. Just applying the style is enough.
            }
        }

        if (shouldIframeContentBeSwitched) {
            this._state = 'processing';
            try {
                await this._switchIframeContent(source);
            } catch (error) {
                // There is something wrong with the content. We need to make renderer ready for the next render request.
                if (!isNewlyRendered) {
                    this.dispose();
                }
                throw error;
            }

            this._showWebMessage();
            this._source = source;
        }

        if (isNewlyRendered) {
            // Add event listeners
            this._attachResizeEventListeners();
        }

        this._state = 'completed';
    }

    private static _handleWindowResize() {
        const isNarrow = window.innerWidth < WIDE_SCREEN_THRESHOLD;
        if (isNarrow !== this._isNarrow && this._source && this._props && this._state === 'completed') {
            this.render(this._props, this._source);
        }
    }

    private static _insert(scope: HTMLElement, target: HTMLElement) {
        const firstChild = scope.firstChild;
        if (firstChild) {
            scope.insertBefore(target, firstChild);
        } else {
            scope.appendChild(target);
        }
    }

    private static _createBackgroundLayer(): HTMLDivElement {
        // Background layer will be initialized in BackgroundLayerStyler
        const div = document.createElement('div');
        div.id = '--notifly-web-message-background-layer';

        return div;
    }

    private static _createIframeContainer(): HTMLDivElement {
        // Iframe container will be initialized in ContainerStyler
        const div = document.createElement('div');
        div.id = '--notifly-web-message-iframe-container';

        return div;
    }

    private static _createIframe(): HTMLIFrameElement {
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.style.margin = '0';
        iframe.style.padding = '0';
        iframe.style.display = 'block';
        iframe.style.colorScheme = 'none';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.id = '--notifly-web-message-iframe';

        return iframe;
    }

    // Animations are supported only for version 3 or higher
    private static _injectKeyframes() {
        if (this._areKeyframesInjected) {
            return;
        }
        const keyframes = getKeyframes();
        const style = document.createElement('style');
        style.innerHTML = keyframes;
        document.head.appendChild(style);
    }

    private static async _switchIframeContent(source: string, timeout = 3000) {
        // Remove src or srcdoc attribute to prevent iframe from loading the previous content
        if (this._iframe.src) this._iframe.removeAttribute('src');
        if (this._iframe.srcdoc) this._iframe.removeAttribute('srcdoc');

        return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                window.removeEventListener('message', handleMessageEvent);
                reject(new Error('[Notifly Web Message Renderer] Timeout while waiting for content to be loaded.'));
            }, timeout);

            // Wait for the iframe to be loaded
            const handleMessageEvent = (event: MessageEvent) => {
                if (event.data.type === '__notifly_web_message_loaded') {
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', handleMessageEvent);
                    resolve();
                }
            };

            window.addEventListener('message', handleMessageEvent);

            const sourceType = conjectureSourceType(source);

            if (sourceType === 'html') {
                this._iframe.srcdoc = source;
            } else if (sourceType === 'url') {
                this._iframe.src = source;
            }
        });
    }

    private static _hideWebMessage() {
        switch (this._renderType) {
            case 'normal':
                this._iframeContainer.style.display = 'none';
                break;
            case 'withBackgroundLayer':
                this._backgroundLayer.style.display = 'none';
                break;
        }
    }

    private static _showWebMessage() {
        switch (this._renderType) {
            case 'normal':
                this._iframeContainer.style.display = 'block';
                break;
            case 'withBackgroundLayer':
                this._backgroundLayer.style.display = 'block';
                break;
        }
    }

    private static _setAutoDismissTimer(duration: number) {
        if (this._autoDismissTimer) {
            this._clearAutoDismissTimer();
        }
        if (duration) {
            this._autoDismissTimer = setTimeout(() => {
                this.close();
                this._callbacks.onAutoDismissed?.();
                this._autoDismissTimer = null;
            }, duration * 1000);
        }
    }

    private static _clearAutoDismissTimer() {
        if (this._autoDismissTimer) {
            clearTimeout(this._autoDismissTimer);
            this._autoDismissTimer = null;
        }
    }

    private static _attachResizeEventListeners() {
        if (this._areResizeEventListenersAttached) return;

        window.addEventListener('resize', this._handleWindowResize.bind(this));
        window.addEventListener('orientationchange', this._handleWindowResize.bind(this));

        this._areResizeEventListenersAttached = true;
    }

    private static _removeResizeEventListeners() {
        if (!this._areResizeEventListenersAttached) return;

        window.removeEventListener('resize', this._handleWindowResize.bind(this));
        window.removeEventListener('orientationchange', this._handleWindowResize.bind(this));

        this._areResizeEventListenersAttached = false;
    }

    private static _maybeAttachEnterAnimationStyleToIframe(animation?: Animation) {
        if (!this._iframe) {
            return;
        }

        this._iframe.style.opacity = '1'; // to prevent flickering
        if (!animation?.enter) {
            this._clearIframeAnimation();
            return;
        }

        const { duration, type, timing_function: timingFunction } = animation.enter;
        const keyframeName = getKeyframeName(type, 'enter');
        const animationStyle = `${keyframeName} ${duration}s ${timingFunction || 'ease-in-out'}`;
        this._iframe.style.animation = animationStyle;
    }

    private static _maybeAttachLeaveAnimationStyleToIframeAndReturnWaitMs(animation?: Animation) {
        if (!this._iframe) {
            return 0;
        }
        if (!animation?.leave) {
            this._clearIframeAnimation();
            return 0;
        }

        const { duration, type, timing_function: timingFunction } = animation.leave;
        const keyframeName = getKeyframeName(type, 'leave');
        const animationStyle = `${keyframeName} ${duration}s ${timingFunction || 'ease-out'}`;
        this._iframe.style.opacity = '0'; // to prevent flickering
        this._iframe.style.animation = animationStyle;
        return duration * 1000;
    }

    private static _clearIframeAnimation() {
        if (!this._iframe) {
            return;
        }
        this._iframe.style.animation = '';
    }
}

class BackgroundLayerStyler {
    static style(target: HTMLDivElement, props: InWebMessageModalProps) {
        if (!target || !props) {
            throw new Error('Invalid arguments');
        }
        if (!props.background) return;

        this._initializeBackgroundLayerStyle(target);

        target.style.background = `rgba(0,0,0,${props.background_opacity || 0.2})`;
    }

    private static _initializeBackgroundLayerStyle(backgroundLayer: HTMLDivElement) {
        backgroundLayer.style.zIndex = '9998';
        backgroundLayer.style.border = 'none';
        backgroundLayer.style.overflow = 'hidden';
        backgroundLayer.style.position = 'fixed';
        backgroundLayer.style.margin = '0';
        backgroundLayer.style.padding = '0';
        backgroundLayer.style.display = 'block';
        backgroundLayer.style.top = '0px';
        backgroundLayer.style.left = '0px';
        backgroundLayer.style.width = '100vw';
        backgroundLayer.style.height = '100vh';
    }
}

class IframeContainerStyler {
    private static readonly DEFAULT_PROPS = {
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        padding: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
        top: '0px',
    };

    private static readonly BOX_SHADOW_MAPPINGS = {
        sm: ' 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    };

    static style(target: HTMLDivElement, props: InWebMessageModalProps) {
        if (!target || !props) {
            throw new Error('Invalid arguments');
        }

        // Override user agent stylesheet (css reset) and clear container styles if any
        this._initializeContainerStyle(target);

        // Width and height
        target.style.background = 'transparent';
        target.style.width = sanitizeCSSStyle(props.width, this.DEFAULT_PROPS.width);
        target.style.height = sanitizeCSSStyle(props.height, this.DEFAULT_PROPS.height);

        if (props.padding) {
            target.style.padding = sanitizeCSSStyle(props.padding, '0px');
        }

        // Z-index and position
        target.style.position =
            props.position === 'fixed' || props.position === 'absolute' ? props.position : this.DEFAULT_PROPS.position;
        // If center is set, top, bottom, left and right will be ignored.
        // Otherwise , if top and bottom are both defined, bottom will take precedence
        if (props.center) {
            target.style.top = '50%';
            target.style.left = '50%';
            target.style.transform = 'translate(-50%, -50%)';
        } else {
            if (props.left !== undefined) {
                target.style.left = sanitizeCSSStyle(props.left, this.DEFAULT_PROPS.left);
            } else if (props.right !== undefined) {
                target.style.right = sanitizeCSSStyle(props.right, this.DEFAULT_PROPS.right);
            } else {
                target.style.left = '0px';
            }
            if (props.bottom !== undefined) {
                target.style.bottom = sanitizeCSSStyle(props.bottom, this.DEFAULT_PROPS.bottom);
            } else if (props.top !== undefined) {
                target.style.top = sanitizeCSSStyle(props.top, this.DEFAULT_PROPS.top);
            } else {
                target.style.top = '0px';
            }
        }

        // Box shadow
        if (props.box_shadow && (this.BOX_SHADOW_MAPPINGS as any)[props.box_shadow]) {
            target.style.boxShadow = (this.BOX_SHADOW_MAPPINGS as any)[props.box_shadow];
        }

        // Border radius
        if (typeof target.style.borderRadius !== 'undefined') {
            target.style.borderRadius = this._convertBorderRadiusToCSSValue(props.border_radius);
        }
    }

    private static _initializeContainerStyle(container: HTMLDivElement) {
        container.style.zIndex = '9999';
        container.style.border = 'none';
        container.style.overflow = 'visible';
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.display = 'block';
        container.style.top = 'auto';
        container.style.left = 'auto';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.transform = 'none';
        container.style.boxShadow = 'none';
        container.style.borderRadius = '0px';
    }

    private static _convertBorderRadiusToCSSValue(borderRadius?: string | number | BorderRadius) {
        if (!borderRadius) return '0px';
        if (typeof borderRadius === 'string') return borderRadius;
        if (typeof borderRadius === 'number') return `${borderRadius}px`;

        const { top_left, top_right, bottom_right, bottom_left } = borderRadius;
        return `${top_left || '0px'} ${top_right || '0px'} ${bottom_right || '0px'} ${bottom_left || '0px'}`;
    }
}
