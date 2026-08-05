/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */

// Public API of @digitalbazaar/vc-html-renderer.
// primary entry point: render a credential's HTML render method into the DOM
export {HtmlRenderer, RenderHandle} from './htmlRenderer.js';

// detection + selective-disclosure helpers (usable without rendering)
export {
  filterCredential, findHtmlRenderMethod, findHtmlRenderMethods, supportsHtml
} from './detect.js';

// lower-level building blocks: the host/template frame document strings
export {createHostDocument, createTemplateDocument} from './documents.js';
