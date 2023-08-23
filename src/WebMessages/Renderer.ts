/* eslint-disable @typescript-eslint/no-explicit-any */

const WIDE_SCREEN_THRESHOLD = 520;

type ModalPropsVersion = 1 | 2;

export class WebMessageRenderer {
    private _modalProps: Record<string, any>;
    private _modalPropsVersion: ModalPropsVersion;
    private _container: HTMLDivElement;
    private _iframe: HTMLIFrameElement;
    private _isNarrow: boolean;
    private _windowResizeHandler = this.handleWindowResize.bind(this);
    private _onRenderCompleted?: () => void;

    public get iframe() {
        return this._iframe;
    }

    constructor(modalProps: Record<string, any>, iframeSrc: string, onRenderCompleted?: () => void) {
        this._modalProps = modalProps;
        this._modalPropsVersion = ModalPropsApplier.getVersion(this._modalProps);
        this._container = document.createElement('div');
        this._container.id = `notifly-web-message-container-${new Date().toISOString()}`;
        this._iframe = this._createIframe(iframeSrc);
        this._isNarrow = window.outerWidth < WIDE_SCREEN_THRESHOLD;
        this._onRenderCompleted = onRenderCompleted;
    }

    render() {
        this._isNarrow = window.outerWidth < WIDE_SCREEN_THRESHOLD;
        ModalPropsApplier.applyModalProps(this._container, this._modalProps, this._isNarrow);

        this._container.appendChild(this._iframe);
        const firstChild = document.body.firstChild;
        document.body.insertBefore(this._container, firstChild);

        window.addEventListener('resize', this._windowResizeHandler);

        if (this._onRenderCompleted) this._onRenderCompleted();
    }

    dispose() {
        document.body.removeChild(this._container);
        window.removeEventListener('resize', this._windowResizeHandler);
    }

    handleWindowResize() {
        console.log(`Window Resized! ${window.outerWidth}`);
        if (this._modalPropsVersion < 2) {
            return;
        }

        const isNarrow = window.outerWidth < WIDE_SCREEN_THRESHOLD;
        if (isNarrow !== this._isNarrow) {
            this._isNarrow = isNarrow;
            ModalPropsApplier.applyModalProps(this._container, this._modalProps, this._isNarrow);
        }
    }

    private _createIframe(iframeSrc: string): HTMLIFrameElement {
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden !important';
        iframe.style.margin = '0';
        iframe.style.padding = '0';
        iframe.style.display = 'block';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.id = `--notifly-web-message-iframe-${new Date().toISOString()}`;
        iframe.src = iframeSrc;

        return iframe;
    }
}

class ModalPropsApplier {
    private static readonly DEFAULT_PROPS = {
        width: '100%',
        height: '100%',
        zIndex: '9999',
        position: 'fixed',
        padding: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
        top: '0px',
    };

    static getVersion(props: Record<string, any>): ModalPropsVersion {
        if (!props.version) return 1;

        if (typeof props.version === 'number' && (props.version === 1 || props.version === 2)) {
            return props.version;
        }

        if (typeof props.version === 'string') {
            const version = parseInt(props.version);
            if (version === 1 || version === 2) return version;
        }

        throw new Error(`Invalid version ${props.version}`);
    }

    static applyModalProps(container: HTMLDivElement, props: Record<string, any>, isNarrow: boolean) {
        if (!container || !props) {
            throw new Error('Invalid arguments');
        }

        // Override user agent stylesheet (css reset)
        container.style.border = 'none';
        container.style.overflow = 'hidden !important';
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.display = 'block';

        const version = this.getVersion(props);
        const propsToApply =
            version === 1
                ? props
                : version === 2
                ? isNarrow
                    ? props.modal_props_narrow
                    : props.modal_props_wide
                : null;

        if (!propsToApply) {
            throw new Error(`Invalid version ${version}`);
        }

        this._parseAndApplyModalProps(container, propsToApply, version);
    }

    private static _parseAndApplyModalProps(
        container: HTMLDivElement,
        props: Record<string, any>,
        version: ModalPropsVersion
    ) {
        // Width and height
        container.style.width = this._convertToValidCSSStyle(props.width, this.DEFAULT_PROPS.width);
        if (version === 1) {
            if (props.small_screen_width_full && window.outerWidth < WIDE_SCREEN_THRESHOLD) {
                container.style.width = '100%';
            }
        }
        container.style.height = this._convertToValidCSSStyle(props.height, this.DEFAULT_PROPS.height);

        // Z-index and position
        container.style.zIndex = this._convertToValidCSSStyle(props.zIndex, this.DEFAULT_PROPS.zIndex);
        container.style.position =
            props.position === 'fixed' || props.position === 'absolute' ? props.position : this.DEFAULT_PROPS.position;
        // If center is set, top, bottom, left and right will be ignored.
        // Otherwise , if top and bottom are both defined, bottom will take precedence
        if (props.center) {
            container.style.top = '50%';
            container.style.left = '50%';
            container.style.transform = 'translate(-50%, -50%)';
        } else {
            if (props.right !== undefined) {
                container.style.right = this._convertToValidCSSStyle(props.right, this.DEFAULT_PROPS.right);
            } else if (props.left !== undefined) {
                container.style.left = this._convertToValidCSSStyle(props.left, this.DEFAULT_PROPS.left);
            } else {
                container.style.left = '0px';
            }
            if (props.bottom !== undefined) {
                container.style.bottom = this._convertToValidCSSStyle(props.bottom, this.DEFAULT_PROPS.bottom);
            } else if (props.top !== undefined) {
                container.style.top = this._convertToValidCSSStyle(props.top, this.DEFAULT_PROPS.top);
            } else {
                container.style.top = '0px';
            }
        }

        // Background
        if (props.background) {
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.background = this._convertToValidCSSStyle(props.backgroundOpacity, 'rgba(0,0,0,0.2)');
        } else {
            container.style.background = 'transparent';
            if (props.padding) {
                container.style.padding = this._convertToValidCSSStyle(props.padding, '0px');
            }
        }
    }

    private static _convertToValidCSSStyle(value: string | number | undefined, defaultValue = 'auto'): string {
        if (typeof value === 'number') {
            return `${value}px`;
        } else if (typeof value === 'string') {
            return value;
        } else {
            return defaultValue;
        }
    }

    private static _generateId(): string {
        return `--notifly-web-message-${new Date().toISOString()}`;
    }
}
