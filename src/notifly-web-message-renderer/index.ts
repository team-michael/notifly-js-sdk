import type { InWebMessageTemplateProps, RendererCallbacks } from './Core/Types';
import Renderer from './Core/Renderer';

/**
 *
 * @param props Props to render
 * @param source Source (URL or HTML) to render
 * @param callbacks Callbacks to handle rendering events
 */
function render(props: InWebMessageTemplateProps, source: string, callbacks: RendererCallbacks = {}) {
    Renderer.render(props, source, callbacks);
}

/**
 * Force dispose the renderer.
 * It immediately removes the iframe from the DOM.
 */
function dispose() {
    Renderer.dispose();
}

/**
 * @returns Promise that resolves when the renderer is closed.
 * It waits for the exit animation to complete.
 * If the renderer is already closed, it resolves immediately.
 *
 * When the render function is called when the renderer has not completed closing,
 * it will immediately dispose the current renderer and render the new one.
 */
async function close() {
    return Renderer.close();
}

function getIframe() {
    return Renderer.iframe;
}

export * from './Core/Types';

export { render, dispose, getIframe, close };
