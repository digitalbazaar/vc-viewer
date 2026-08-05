/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */

// HTML Render Suite constants. Tags: [spec] = mandated by
// https://w3c.github.io/vc-render-method/#the-html-render-suite ;
// [lib] = library-defined (not spec-mandated).

// [spec] HTML suite = `TemplateRenderMethod` with `renderSuite: "html"`.
export const RENDER_METHOD_TYPE = 'TemplateRenderMethod';
export const HTML_RENDER_SUITE = 'html';

// [spec] wrapper/template-frame CSP: inline + `data:` only, no network.
export const TEMPLATE_CSP = `default-src data: 'unsafe-inline'`;

// [spec] host-frame CSP requires `frame-src 'none'` (allows `srcdoc`, blocks
// `<iframe src>` -> isolates the template and preserves the app's CHAPI
// framing). The remaining directives are added hardening (not spec-mandated):
// `default-src 'none'` blocks all network; `script-src`/`style-src
// 'unsafe-inline'` admit only the host controller's inline script and styles.
export const HOST_CSP = `default-src 'none'; script-src 'unsafe-inline'; ` +
  `style-src 'unsafe-inline'; frame-src 'none'`;

// [spec] template-frame sandbox; no `allow-same-origin` -> opaque origin.
export const TEMPLATE_SANDBOX = 'allow-scripts';

// [lib] reject `handle.ready` if no ready/error by this time; `0` disables.
export const DEFAULT_TIMEOUT = 10000;

// Transports: app<->host via `postMessage` [lib]; host<->template via a
// transferred `MessageChannel` port [spec].
export const MESSAGE_NAMESPACE = '@digitalbazaar/vc-html-renderer';

export const MESSAGE_TYPE = {
  // [lib] host->app: controller ready to receive the template
  HOST_READY: `${MESSAGE_NAMESPACE}:host-ready`,
  // [lib] app->host: deliver template document + options
  RENDER: `${MESSAGE_NAMESPACE}:render`,
  // [spec] host->template: transfer the MessageChannel port
  PORT: `${MESSAGE_NAMESPACE}:port`,
  // [lib] host->app: template frame `load` fired (drives no-signal fallback)
  LOADED: `${MESSAGE_NAMESPACE}:loaded`,
  // [spec] renderMethodReady() success (template->host port->app)
  READY: `${MESSAGE_NAMESPACE}:ready`,
  // [spec] renderMethodReady(Error) (template->host port->app)
  ERROR: `${MESSAGE_NAMESPACE}:error`,
  // [lib] content size changed (template->host port->app)
  RESIZE: `${MESSAGE_NAMESPACE}:resize`
};
