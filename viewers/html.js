// Copyright 2025 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

import { reactive } from 'https://unpkg.com/petite-vue?module'
import { selectJsonLd } from '../select.js';

export function HTMLViewer({template, credential, pointers}) {
  let code = template;
  if(template.startsWith('data:text/html;base64,')) {
    code = atob(template.replace('data:text/html;base64,', ''));
  } else if(template.startsWith('data:text/html,')) {
    code = template.replace('data:text/html,', '');
  }

  const store = reactive({
    code,
    filteredCredential: JSON.stringify(selectJsonLd({
      // credential must be un-Proxy-object'd
      document: JSON.parse(JSON.stringify(credential)),
      // TODO: ...which renderMethod do we have renderProperties from? Pass
      // that into HTML Viewer?
      pointers
    }), null, 2)
  });

  return {
    $template: '#html-viewer',
    // local state
    currentTab: 'rendered', // rendered or codei
    store,
    // methods
    shimCode() {
      const {renderMethod, ...partialCredential} = credential;
      return `<html>
        <head>
          <meta http-equiv="content-security-policy" content="default-src data: 'unsafe-inline'">
          <script name="credential" type="application/vc">${store.filteredCredential}</script>
          <script>
            // add promise that will resolve to the communication port from
            // the parent window
            const portPromise = new Promise(resolve => {
              window.addEventListener('message', function start(event) {
                if(event.data === 'start' && event.ports?.[0]) {
                  window.removeEventListener('message', start);
                  resolve(event.ports[0]);
                }
              });
            });

            // attach a function to the window for the template to call when
            // it's "ready" (or that an error occurred) that will send a message
            // to the parent so the parent can decide whether to show the iframe
            window.renderMethodReady = function(resp) {
              portPromise.then(port => port.postMessage(
                !resp.error ? resp : {error: {message: resp.error.message}}));
            };
          </script>
        </head>
        <body>
          ${store.code}
        </body>
      </html>`;
    }
  };
}
