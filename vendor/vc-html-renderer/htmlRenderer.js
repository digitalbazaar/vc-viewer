/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {createHostDocument, createTemplateDocument} from './documents.js';
import {
  DEFAULT_TIMEOUT, MESSAGE_TYPE, TEMPLATE_SANDBOX
} from './constants.js';
import {findHtmlRenderMethod} from './detect.js';

// [lib] after the template frame's `load`, wait this long for an explicit
// `renderMethodReady()` before treating load as success (fallback for
// templates that never signal)
const DEFAULT_SIGNAL_GRACE = 250;

// [spec] coerce an `outputPreference.style` width/height to a CSS length
function _cssSize(value) {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Controls a single in-progress render: owns the outer host iframe, runs the
 * `HOST_READY -> RENDER -> LOADED -> READY/ERROR` handshake, applies size
 * updates, and exposes lifecycle events plus a `ready` promise.
 */
export class RenderHandle {
  /**
    * @param {object} options - Options (supplied by {@link HtmlRenderer}).
    * @param {Element} options.mount - The element to render into.
    * @param {object} options.credential - The verifiable credential.
    * @param {object} options.renderMethod - The HTML render method.
    * @param {number} options.timeout - Readiness timeout in ms (`0` disables).
    * @param {string} options.sandbox - `sandbox` for the inner template frame.
    * @param {boolean} options.waitForReady - Require an explicit ready signal.
    * @param {number} options.signalGrace - Post-`load` grace period in ms.
    * @param {object} [options.style] - Issuer-declared `outputPreference.style`
    *  with optional CSS `width`/`height` for the rendered frame.
    */
  constructor({
    mount, credential, renderMethod, timeout, sandbox, waitForReady,
    signalGrace, style
  } = {}) {
    this._listeners = new Map();
    this._settled = false;
    this._destroyed = false;
    this._sandbox = sandbox;
    this._waitForReady = waitForReady;
    this._signalGrace = signalGrace;
    this._graceTimer = null;
    this._timeoutTimer = null;
    // [spec] `outputPreference.style` (width/height): a declared height makes
    // the frame a fixed box instead of hugging its content
    this._style = style || null;
    this._fill = !!(style && style.height);
    this._document = createTemplateDocument({credential, renderMethod});

    /**
      * Resolves when the render signals readiness, rejects on error, timeout,
      * or `destroy()` before completion.
      *
      * @type {Promise<RenderHandle>}
      */
    this.ready = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // [lib] avoid unhandled-rejection noise when the caller only uses events
    this.ready.catch(() => {});

    // create the outer host iframe (NOT sandboxed: it runs the trusted host
    // controller as a same-origin `srcdoc` frame under the strict HOST_CSP)
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Verifiable Credential');
    frame.setAttribute('scrolling', 'no');
    frame.style.cssText = 'display:block;border:0;width:100%;overflow:hidden';
    // [spec] honor an issuer-declared box (`outputPreference.style`)
    if(this._style && this._style.width) {
      frame.style.width = _cssSize(this._style.width);
    }
    if(this._style && this._style.height) {
      frame.style.height = _cssSize(this._style.height);
    }

    /**
      * The outer host iframe element.
      *
      * @type {HTMLIFrameElement}
      */
    this.element = frame;
    this._frame = frame;

    this._onMessage = event => this._handleMessage(event);
    window.addEventListener('message', this._onMessage);

    // [lib] safeguard: reject if no ready/error arrives in time.
    if(timeout > 0) {
      this._timeoutTimer = setTimeout(() => this._fail(new Error(
        'Timed out waiting for the HTML render method to signal readiness.')),
      timeout);
    }

    // [lib] attach the listener before mounting so HOST_READY is never missed
    frame.srcdoc = createHostDocument();
    mount.appendChild(frame);
  }

  /**
    * Subscribe to an event (`ready`, `error`, `resize`, or `loaded`).
    *
    * @param {string} type - The event type.
    * @param {Function} listener - The listener.
    *
    * @returns {RenderHandle} This handle, for chaining.
    */
  on(type, listener) {
    let set = this._listeners.get(type);
    if(!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(listener);
    return this;
  }

  /**
    * Unsubscribe a previously-registered listener.
    *
    * @param {string} type - The event type.
    * @param {Function} listener - The listener.
    *
    * @returns {RenderHandle} This handle, for chaining.
    */
  off(type, listener) {
    const set = this._listeners.get(type);
    if(set) {
      set.delete(listener);
    }
    return this;
  }

  /**
    * Tear down the render: remove the iframe and listeners, clear timers, and
    * reject `ready` if it has not already settled.
    *
    * @returns {void}
    */
  destroy() {
    if(this._destroyed) {
      return;
    }
    this._destroyed = true;
    this._clearTimers();
    window.removeEventListener('message', this._onMessage);
    if(this._frame && this._frame.parentNode) {
      this._frame.parentNode.removeChild(this._frame);
    }
    if(!this._settled) {
      this._settled = true;
      this._reject(new Error('Renderer destroyed before completion.'));
    }
    this._listeners.clear();
  }

  _handleMessage(event) {
    // only accept messages relayed by this render's host frame
    if(this._destroyed || event.source !== this._frame.contentWindow) {
      return;
    }
    const data = event.data || {};
    switch(data.type) {
      case MESSAGE_TYPE.HOST_READY:
        // [lib] host controller ready: deliver the template + render options
        this._frame.contentWindow.postMessage({
          type: MESSAGE_TYPE.RENDER,
          document: this._document,
          sandbox: this._sandbox,
          fill: this._fill
        }, '*');
        break;
      case MESSAGE_TYPE.LOADED:
        // [lib] fallback: if no explicit signal arrives within the grace
        // period, treat `load` as success (for templates that never signal)
        this._emit('loaded', {});
        if(!this._waitForReady && !this._settled) {
          this._graceTimer = setTimeout(
            () => this._succeed(), this._signalGrace);
        }
        break;
      case MESSAGE_TYPE.READY:
        // [spec] renderMethodReady() -> resolve the render promise
        this._succeed();
        break;
      case MESSAGE_TYPE.ERROR:
        // [spec] renderMethodReady(Error) -> reject the render promise
        this._fail(new Error(data.message || 'HTML render method failed.'));
        break;
      case MESSAGE_TYPE.RESIZE:
        this._applySize(data);
        break;
      default:
        break;
    }
  }

  _applySize({width, height} = {}) {
    // [spec] a declared `outputPreference` height wins; else hug content
    if(!(this._style && this._style.height) &&
      typeof height === 'number' && height > 0) {
      this._frame.style.height = `${height}px`;
    }
    this._emit('resize', {width, height});
  }

  // settle as success (resolve `ready`); the first signal wins
  _succeed() {
    if(this._settled) {
      return;
    }
    this._settled = true;
    this._clearTimers();
    this._emit('ready', {});
    this._resolve(this);
  }

  // settle as failure (reject `ready`); the first signal wins
  _fail(error) {
    if(this._settled) {
      return;
    }
    this._settled = true;
    this._clearTimers();
    this._emit('error', error);
    this._reject(error);
  }

  _clearTimers() {
    if(this._timeoutTimer) {
      clearTimeout(this._timeoutTimer);
      this._timeoutTimer = null;
    }
    if(this._graceTimer) {
      clearTimeout(this._graceTimer);
      this._graceTimer = null;
    }
  }

  _emit(type, detail) {
    const set = this._listeners.get(type);
    if(!set) {
      return;
    }
    for(const listener of set) {
      try {
        listener(detail);
      } catch(e) {
        // surface listener errors globally without breaking the emit loop
        setTimeout(() => {
          throw e;
        });
      }
    }
  }
}

/**
 * Renders Verifiable Credential HTML Render Methods inside a nested, sandboxed
 * iframe.
 *
 * A single instance holds default options and may be reused for many renders.
 * Each `render()` call returns an independent {@link RenderHandle}.
 */
export class HtmlRenderer {
  /**
    * @param {object} [options] - Default options for every render.
    * @param {number} [options.timeout] - Milliseconds to wait for readiness
    *  before rejecting; `0` disables the timeout.
    * @param {string} [options.sandbox] - `sandbox` attribute for the inner
    *  template frame.
    * @param {boolean} [options.waitForReady] - If `true`, only an explicit
    *  `renderMethodReady()` (or error) settles the render; the template's
    *  `load` event is not treated as success.
    * @param {number} [options.signalGrace] - Milliseconds to wait after the
    *  template `load` for an explicit signal before treating load as success
    *  (ignored when `waitForReady` is `true`).
    */
  constructor({
    timeout = DEFAULT_TIMEOUT,
    sandbox = TEMPLATE_SANDBOX,
    waitForReady = false,
    signalGrace = DEFAULT_SIGNAL_GRACE
  } = {}) {
    this.timeout = timeout;
    this.sandbox = sandbox;
    this.waitForReady = waitForReady;
    this.signalGrace = signalGrace;
  }

  /**
    * Render a credential's HTML Render Method into a mount element.
    *
    * @param {object} options - Options.
    * @param {Element} options.mount - The element to render into; the outer
    *  host iframe is appended to it.
    * @param {object} options.credential - The verifiable credential.
    * @param {object} [options.renderMethod] - The HTML render method to use;
    *  defaults to the first one found on the credential.
    *
    * @returns {RenderHandle} A handle exposing `ready`, `element`, events, and
    *  `destroy()`.
    */
  render({mount, credential, renderMethod} = {}) {
    if(!(mount && mount.nodeType === 1)) {
      throw new TypeError('"mount" must be a DOM element.');
    }
    renderMethod = renderMethod || findHtmlRenderMethod({credential});
    if(!renderMethod) {
      throw new Error(
        'The verifiable credential does not have an HTML render method.');
    }
    return new RenderHandle({
      mount, credential, renderMethod,
      timeout: this.timeout,
      sandbox: this.sandbox,
      waitForReady: this.waitForReady,
      signalGrace: this.signalGrace,
      style: renderMethod?.outputPreference?.style || null
    });
  }
}
