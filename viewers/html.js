// Copyright 2025-2026 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

import { reactive } from 'https://unpkg.com/petite-vue?module'
import {HtmlRenderer, filterCredential} from '@digitalbazaar/vc-html-renderer';

export function HTMLViewer({renderMethod, credential}) {
  // un-proxy the petite-vue reactive credential into a plain object
  const plainCredential = JSON.parse(JSON.stringify(credential));

  // decode the data: template for the "HTML Template Code" display tab
  const template = renderMethod?.template || '';
  let code = template;
  if(template.startsWith('data:text/html;base64,')) {
    code = atob(template.replace('data:text/html;base64,', ''));
  } else if(template.startsWith('data:text/html,')) {
    code = template.replace('data:text/html,', '');
  }

  // the library performs this same filtering internally when it renders; here
  // it only feeds the read-only "Filtered Credential" display tab
  const store = reactive({
    code,
    filteredCredential: JSON.stringify(
      filterCredential({credential: plainCredential, renderMethod}), null, 2)
  });

  let handle = null;

  return {
    $template: '#html-viewer',
    currentTab: 'rendered',
    store,
    // render the HTML Render Method into `mount` via the library (nested,
    // sandboxed host + template iframes; the app's own CSP is untouched)
    renderInto(mount) {
      if(handle) {
        handle.destroy();
        handle = null;
      }
      handle = new HtmlRenderer().render({
        mount,
        credential: plainCredential,
        renderMethod
      });
      handle.ready.catch(error => {
        console.error('HTML render method failed:', error);
      });
    }
  };
}

// export function HTMLViewer({template, credential, pointers}) {
//   let code = template;
//   if(template.startsWith('data:text/html;base64,')) {
//     code = atob(template.replace('data:text/html;base64,', ''));
//   } else if(template.startsWith('data:text/html,')) {
//     code = template.replace('data:text/html,', '');
//   }

//   const store = reactive({
//     code,
//     filteredCredential: JSON.stringify(selectJsonLd({
//       // credential must be un-Proxy-object'd
//       document: JSON.parse(JSON.stringify(credential)),
//       // TODO: ...which renderMethod do we have renderProperties from? Pass
//       // that into HTML Viewer?
//       pointers
//     }), null, 2)
//   });

//   return {
//     $template: '#html-viewer',
//     // local state
//     currentTab: 'rendered', // rendered or codei
//     store,
//     // methods
//     shimCode() {
//       const {renderMethod, ...partialCredential} = credential;
//       return `<html>
//         <head>
//           <meta http-equiv="content-security-policy" content="default-src data: 'unsafe-inline'">
//           <script name="credential" type="application/vc">${store.filteredCredential}</script>
//         </head>
//         <body>
//           ${store.code}
//         </body>
//       </html>`;
//     }
//   };
// }
