/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {HTML_RENDER_SUITE, RENDER_METHOD_TYPE} from './constants.js';
import {selectJsonLd} from './select.js';

/**
 * Check if a verifiable credential has an HTML Render Method.
 *
 * @param {object} options - Options.
 * @param {object} options.credential - The verifiable credential.
 *
 * @returns {boolean} `true` if an HTML render method is present.
 */
export function supportsHtml({credential} = {}) {
  return findHtmlRenderMethods({credential}).length > 0;
}

/**
 * Find all HTML Render Methods on a verifiable credential.
 *
 * [spec] An HTML Render Method is a `TemplateRenderMethod` whose `renderSuite`
 * is `"html"`. `renderMethod` may be a single object or an array.
 *
 * @param {object} options - Options.
 * @param {object} options.credential - The verifiable credential.
 *
 * @returns {Array} The matching render method objects (possibly empty).
 */
export function findHtmlRenderMethods({credential} = {}) {
  let renderMethods = credential?.renderMethod;
  if(!renderMethods) {
    return [];
  }
  // normalize a single render method to an array
  if(!Array.isArray(renderMethods)) {
    renderMethods = [renderMethods];
  }
  return renderMethods.filter(_isHtmlRenderMethod);
}

/**
 * Find the first HTML Render Method on a verifiable credential.
 *
 * @param {object} options - Options.
 * @param {object} options.credential - The verifiable credential.
 *
 * @returns {object|null} The first matching render method, or `null`.
 */
export function findHtmlRenderMethod({credential} = {}) {
  const [renderMethod = null] = findHtmlRenderMethods({credential});
  return renderMethod;
}

/**
 * Filter a credential to the fields named by a render method's
 * `renderProperty` JSON pointers (selective disclosure).
 *
 * [spec] MUST filter with the `selectJsonLd` algorithm from VC-DI-ECDSA over
 * the RFC-6901 `renderProperty` pointers; an absent `renderProperty` exposes
 * the whole credential. Every pointer must resolve or `selectJsonLd` throws.
 *
 * @param {object} options - Options.
 * @param {object} options.credential - The verifiable credential.
 * @param {object} options.renderMethod - The HTML render method.
 *
 * @returns {object} The filtered credential.
 */
export function filterCredential({credential, renderMethod} = {}) {
  // [lib] deep-clone to strip framework reactive proxies (e.g. Vue); the
  // selection algorithm requires a plain object
  const document = JSON.parse(JSON.stringify(credential));
  const pointers = renderMethod?.renderProperty;
  if(!Array.isArray(pointers) || pointers.length === 0) {
    // [spec] no `renderProperty`: expose the whole credential
    return document;
  }
  return selectJsonLd({document, pointers});
}

// [spec] discriminator: `TemplateRenderMethod` + `renderSuite: "html"`
function _isHtmlRenderMethod(renderMethod) {
  return renderMethod?.type === RENDER_METHOD_TYPE &&
    renderMethod?.renderSuite === HTML_RENDER_SUITE;
}
