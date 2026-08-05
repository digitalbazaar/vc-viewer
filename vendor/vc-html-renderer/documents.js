/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {
  HOST_CSP, MESSAGE_TYPE, TEMPLATE_CSP, TEMPLATE_SANDBOX
} from './constants.js';
import {filterCredential} from './detect.js';

/**
 * Build the inner *template* frame document (the spec's "wrapper code").
 *
 * [spec] The wrapper provides `<html>/<head>/<body>` (the issuer template MUST
 * be a headless fragment), applies the template-frame CSP, and embeds the
 * filtered credential as a `<script type="application/vc">` data block in the
 * `<head>`. A bootstrap adds the spec's `window.renderMethodReady()` and
 * signals over a `MessageChannel` port.
 *
 * @param {object} options - Options.
 * @param {object} options.credential - The verifiable credential.
 * @param {object} options.renderMethod - The HTML render method.
 *
 * @returns {string} The inner template frame document as an HTML string.
 */
export function createTemplateDocument({credential, renderMethod} = {}) {
  const templateCode = _resolveTemplate({renderMethod});
  const filtered = filterCredential({credential, renderMethod});
  const json = _safeJson(filtered);
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="content-security-policy" content="${TEMPLATE_CSP}">
<style>html,body{margin:0}</style>
<script name="credential" type="application/vc">${json}</script>
${_templateBootstrap()}
</head>
<body>
${templateCode}
</body>
</html>`;
}

/**
 * Build the outer *host* frame document (the spec's "host page" role).
 *
 * Static (identical for every credential), so it can be cached. [spec] It
 * carries the host CSP (`frame-src 'none'`) and hosts the template in a
 * sandboxed `srcdoc` iframe. It announces readiness to the app, and on a
 * `RENDER` message creates the template frame and relays the template's
 * ready/error/resize up to the app.
 *
 * @returns {string} The host frame document as an HTML string.
 */
export function createHostDocument() {
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="content-security-policy" content="${HOST_CSP}">
</head>
<body>
${_hostController()}
</body>
</html>`;
}

// Resolve `renderMethod.template` to raw template HTML.
// [spec] `template` is a string `data:` URL (RFC-2397): `;base64,` is decoded,
// plain `data:text/html,` is used verbatim.
function _resolveTemplate({renderMethod} = {}) {
  const template = renderMethod?.template;
  if(typeof template !== 'string') {
    throw new TypeError('"renderMethod.template" must be a string.');
  }
  const base64Prefix = 'data:text/html;base64,';
  const plainPrefix = 'data:text/html,';
  if(template.startsWith(base64Prefix)) {
    return atob(template.slice(base64Prefix.length));
  }
  if(template.startsWith(plainPrefix)) {
    return template.slice(plainPrefix.length);
  }
  // [lib] otherwise treat the string as raw HTML.
  return template;
}

// [lib] serialize to JSON and neutralize `<` so a credential value containing
// `</script>` cannot break out of the `application/vc` data block
function _safeJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
}

// Bootstrap injected into the template frame.
// [spec] defines `window.renderMethodReady()` and signals ready/error over a
// transferred `MessageChannel` port. [lib] also reports content size, and
// buffers a terminal signal made before the port arrives.
function _templateBootstrap() {
  return `<script>
(function() {
  'use strict';
  let port = null;
  let pendingTerminal = null;
  let settled = false;
  function send(message) {
    if(port) {
      port.postMessage(message);
    }
  }
  function reportSize() {
    // [lib] measure body (documentElement.scrollHeight is viewport-clamped)
    // so the frame hugs its content instead of a minimum height
    const body = document.body;
    if(!body) {
      return;
    }
    send({
      type: '${MESSAGE_TYPE.RESIZE}',
      width: body.scrollWidth,
      height: body.scrollHeight
    });
  }
  function flush() {
    if(port && pendingTerminal) {
      port.postMessage(pendingTerminal);
      pendingTerminal = null;
    }
  }
  // [spec] the completion signal the issuer template calls
  window.renderMethodReady = function(error) {
    if(settled) {
      return;
    }
    settled = true;
    if(error) {
      const message = (error && error.message) ?
        String(error.message) : String(error);
      pendingTerminal = {type: '${MESSAGE_TYPE.ERROR}', message: message};
    } else {
      pendingTerminal = {type: '${MESSAGE_TYPE.READY}'};
    }
    flush();
    reportSize();
  };
  // [spec] receive the MessageChannel port handed off by the host frame
  window.addEventListener('message', function(event) {
    if(event.source !== window.parent) {
      return;
    }
    const data = event.data || {};
    if(data.type === '${MESSAGE_TYPE.PORT}' && event.ports && event.ports[0]) {
      port = event.ports[0];
      flush();
      reportSize();
    }
  });
  window.addEventListener('load', reportSize);
  if(typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(reportSize).observe(document.documentElement);
  } else {
    window.addEventListener('resize', reportSize);
  }
})();
</script>`;
}

// Controller injected into the host frame.
// [spec] creates the sandboxed `srcdoc` template frame and a `MessageChannel`
// to it. [lib] relays the template's messages to the app and applies sizing.
function _hostController() {
  return `<script>
(function() {
  'use strict';
  const app = window.parent;
  let inner = null;
  let fill = false;
  function toApp(message) {
    app.postMessage(message, '*');
  }
  function render(data) {
    fill = !!data.fill;
    if(inner) {
      inner.remove();
      inner = null;
    }
    if(fill) {
      // [lib] issuer declared a fixed height: let the inner frame fill the
      // host frame's box rather than hugging its content
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
    }
    const frame = document.createElement('iframe');
    // [spec] template frame is a sandboxed srcdoc iframe (opaque origin)
    frame.setAttribute('sandbox', data.sandbox || '${TEMPLATE_SANDBOX}');
    frame.setAttribute('scrolling', 'no');
    frame.style.cssText = 'display:block;border:0;width:100%;height:' +
      (fill ? '100%' : '0') + ';overflow:hidden';
    // [spec] dedicated MessageChannel to the template: it signals
    // ready/error/resize over the transferred port; the host relays to the app
    const channel = new MessageChannel();
    channel.port1.onmessage = function(event) {
      const msg = event.data || {};
      if(!fill && msg.type === '${MESSAGE_TYPE.RESIZE}' &&
        typeof msg.height === 'number') {
        inner.style.height = msg.height + 'px';
      }
      toApp(msg);
    };
    frame.addEventListener('load', function() {
      toApp({type: '${MESSAGE_TYPE.LOADED}'});
      // [spec] transfer port2 to the template frame
      frame.contentWindow.postMessage(
        {type: '${MESSAGE_TYPE.PORT}'}, '*', [channel.port2]);
    });
    frame.srcdoc = data.document;
    document.body.appendChild(frame);
    inner = frame;
  }
  document.documentElement.style.margin = '0';
  document.body.style.margin = '0';
  window.addEventListener('message', function(event) {
    if(event.source === app) {
      const data = event.data || {};
      if(data.type === '${MESSAGE_TYPE.RENDER}') {
        render(data);
      }
    }
  });
  toApp({type: '${MESSAGE_TYPE.HOST_READY}'});
})();
</script>`;
}
