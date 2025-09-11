import { createApp, reactive } from 'https://unpkg.com/petite-vue?module'

// global state
const store = reactive({
  credential: {}
});

// ...depends exclusively on the above reactive data...for better or worse...
function SVGViewer() {
  return {
    $template: '#svg-viewer',
    // local state
    currentTab: 'rendered', // rendered or code
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
    renderingSVG() {
      const template = this.template();
      if (template.length > 0) {
        return this.mustache(template, store.credential);
      }
    },
    template() {
      let template = '';
      if ('renderMethod' in store.credential) {
        // TODO: really need to provide for more that one renderMethod
        const renderMethod = store.credential.renderMethod[0];
        if ('url' in renderMethod) {
          const dataUrlRegex = /^data:(?<mediatype>[^;]+)?(;base64)?,(?<data>.*)$/;
          const match = renderMethod.url.match(dataUrlRegex);
          template = atob(match.groups.data);
        } else if ('template' in renderMethod) {
          // the `template` field should be raw text/markup
          template = renderMethod.template;
        }
      }
      return template;
    }
  }
}

window.app = createApp({
  // components
  SVGViewer,

  // global state
  store,

  // local state
  credentialString: "",
  filename: "",
  landscape: "",
  landscapeSVG: "",
  parseError: "",

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
  }
  }).mount();
