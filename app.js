// Copyright 2025 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

import { createApp, reactive } from 'https://unpkg.com/petite-vue?module'
import { SVGViewer } from './viewers/svg-mustache.js';
import { HTMLViewer } from './viewers/html.js';

const examplesBaseUrl = window.location.hostname !== 'localhost' ?
  'https://examples.vcplayground.org/credentials/' :
  'http://localhost:8788/credentials/';

// global state
const store = reactive({
  credential: {}
});

function ObjectTree({value}) {
  return {
    $template: '#object-tree',
    value
  };
}

function KVList({value}) {
  return {
    $template: '#kv-list',
    value
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
  ObjectTree,
  KVList,

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
