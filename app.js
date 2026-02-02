// Copyright 2025 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

import { createApp, reactive } from 'https://unpkg.com/petite-vue?module'

import { prettyXML } from './helpers.js';
import { selectJsonLd } from './select.js';

const examplesBaseUrl = window.location.hostname !== 'localhost' ?
  'https://examples.vcplayground.org/credentials/' :
  'http://localhost:8788/credentials/';

// global state
const store = reactive({
  credential: {}
});

// ...depends exclusively on the above reactive data...for better or worse...
function SVGViewer({idx}) {
  return {
    $template: '#svg-viewer',
    // local state
    currentTab: 'rendered', // rendered or code
    code: '',
    // methods
    mustache(template, credential) {
      credential.formatDate = (text) => {
        // TODO: no real error parsing here...assumes we only have a date
        return (text, render) => {
          try {
            // get the data from the Mustache "view"
            const hydratedTemplate = render(text);
            if (!hydratedTemplate) {
              throw new Error(`Unable to parse date from value: ${text}`)
            }
            const date = new Date(hydratedTemplate);
            return date.toISOString().split('T')[0];
          } catch(err) {
            console.error(err);
            return '';
          }
        };
      };
      return Mustache.render(template, credential);
    },
    dataURLfromSVG() {
      const svg = this.renderingSVG();
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    },
    renderingSVG() {
      if (this.code.length > 0) {
        return this.mustache(this.code, store.credential);
      }
    },
    template() {
      let template = '';
      if ('renderMethod' in store.credential) {
        const renderMethod = Array.isArray(store.credential.renderMethod) ?
          store.credential.renderMethod[idx] :
          store.credential.renderMethod;

        if (renderMethod) {
          if ('url' in renderMethod) {
            const dataUrlRegex = /^data:(?<mediatype>[^;]+)?(;base64)?,(?<data>.*)$/;
            const match = renderMethod.url.match(dataUrlRegex);
            template = atob(match.groups.data);
          } else if ('template' in renderMethod) {
            // the `template` field should be raw text/markup
            template = renderMethod.template;
          }
        }
      }
      return template;
    },
    // lifecycle
    mounted() {
      this.code = prettyXML(this.template());
    }
  }
}

function HTMLViewer({template, credential}) {
  const store = reactive({
    code: template
  });

  return {
    $template: '#html-viewer',
    // local state
    currentTab: 'rendered', // rendered or code
    store,
    // methods
    shimCode() {
      const {renderMethod, ...partialCredential} = credential;
      const filteredCredential = selectJsonLd({
        // credential must be un-Proxy-object'd
        document: JSON.parse(JSON.stringify(credential)),
        // TODO: ...which renderMethod do we have renderProperties from? Pass
        // that into HTML Viewer?
        pointers: credential.renderMethod.renderProperty
      });
      console.log(filteredCredential);
      return `<html>
        <head>
          <meta http-equiv="content-security-policy" content="default-src data: 'unsafe-inline'">
          <script name="credential" type="application/vc">${JSON.stringify(filteredCredential)}</script>
        </head>
        <body>
          ${store.code}
        </body>
      </html>`;
    }
  };
}

async function fetchExamples() {
  const examples = await fetch(`${examplesBaseUrl}index.json`)
    .then((r) => r.json());
  return examples;
}

window.app = createApp({
  // components
  HTMLViewer,
  SVGViewer,

  // global state
  store,

  // local state
  credentialString: "",
  filename: "",
  landscape: "",
  landscapeSVG: "",
  parseError: "",
  examples: await fetchExamples(),

  // methods
  async pickFile() {
    const [fileHandle] = await window.showOpenFilePicker();
    this.filename = fileHandle.name;
    const file = await fileHandle.getFile();
    const text = await file.text();
    try {
      this.credentialString = text;
      store.credential = JSON.parse(this.credentialString);
      this.parseError = "";
    } catch(error) {
      // TODO: error on selected files should be reported somewhere else
      // ...and be blocking...
      this.parseError = error.message;
      console.error(error);
    };
  },
  loadCredential(url) {
    if (url) this.credentialUrl = url;
    fetch(this.credentialUrl)
      .then((r) => r.json())
      .then((credential) => {
        store.credential = credential;
        this.credentialString = JSON.stringify(credential, null, 2);
      })
      .catch(console.error);
  },
  getCredential($event) {
    try {
      store.credential = JSON.parse($event.target.value);
      this.parseError = "";
    } catch(error) {
      this.parseError = error.message;
      console.error(error);
    }
  },
  loadExampleCredential(event) {
    this.loadCredential(event.target.value);
  }
}).mount();
