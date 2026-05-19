// Copyright 2025 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

import { createApp, reactive } from 'https://unpkg.com/petite-vue?module'
import { SVGViewer } from './viewers/svg-mustache.js';
import { HTMLViewer } from './viewers/html.js';

const examplesBaseUrl = window.location.hostname !== 'localhost' ?
  'https://examples.vcplayground.org/credentials/' :
  'http://localhost:8788/credentials/';

// components
function KVList(value, ignoreKeys = []) {
  return {
    $template: '#kv-list',
    value,
    ignoreKeys
  };
}

function RenderMethod(renderMethod, idx = 0) {
  return {
    $template: '#render-method',
    idx,
    renderMethod
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
  KVList,
  RenderMethod,

  // global state
  store: reactive({
    credential: {}
  }),

  // local state
  credentialString: "",
  filename: "",
  landscape: "",
  landscapeSVG: "",
  parseError: "",
  examples: await fetchExamples(),

  // reactive set
  setCredential(credential) {
    this.store.credential = {};
    this.$nextTick(() => {
      this.store.credential = credential;
    });
  },

  // methods
  async pickFile() {
    const [fileHandle] = await window.showOpenFilePicker();
    this.filename = fileHandle.name;
    const file = await fileHandle.getFile();
    const text = await file.text();
    try {
      this.credentialString = text;
      this.setCredential(JSON.parse(this.credentialString));
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
        this.setCredential(credential);
        this.credentialString = JSON.stringify(credential, null, 2);
      })
      .catch(console.error);
  },
  getCredential($event) {
    try {
      this.setCredential(JSON.parse($event.target.value));
      this.parseError = "";
    } catch(error) {
      this.parseError = error.message;
      console.error(error);
    }
  },
  loadExampleCredential(event) {
    this.loadCredential(event.target.value);
  },
  setupMessaging(el) {
    const iframe = el;
    const loader = el.nextElementSibling;
    // create a MessageChannel; transfer one port to the iframe
    const channel = new MessageChannel();
    // start message queue so messages won't be lost while iframe loads
    channel.port1.start();
    // handle `ready` message
    channel.port1.onmessage = function(event) {
      if(event.data?.ready) {
        iframe.removeAttribute('hidden');
        loader.setAttribute('hidden', 'hidden');
      } else {
        new Error(event.data?.error?.message);
      }
      channel.port1.onmessage = undefined;
    };
    // send "start" message; send `port2` to iframe for return communication
    iframe.contentWindow.postMessage('start', '*', [channel.port2]);
  }
}).mount();
