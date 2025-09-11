import { createApp } from 'https://unpkg.com/petite-vue?module'

window.app = createApp({

  // local state
  credential: {},
  credentialString: "",
  filename: "",
  landscape: "",
  landscapeSVG: "",
  parseError: "",
  currentTab: "rendered", // or 'code'

  // methods
  template() {
    let template = '';
    if ('renderMethod' in this.credential) {
      // TODO: really need to provide for more that one renderMethod
      const renderMethod = this.credential.renderMethod[0];
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
  },
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
  rendering() {
    return `data:image/svg+xml;base64,${btoa(this.renderingSVG())}`;
  },
  renderingSVG() {
    const template = this.template();
    if (template.length > 0) {
      return this.mustache(template, this.credential);
    }
  },
  async renderings() {
    const template = this.template();
    //const resp = await fetch(this.credential.renderMethod[0].url);
    const resp = this.credential.renderMethod[0].url;
    //const template = await resp.text();
    const rv = this.mustache(template, this.credential.credentialSubject);
    this.landscapeSVG = rv;
    this.landscape = `data:image/svg+xml;base64,${btoa(rv)}`;
  },
  async pickFile() {
    const [fileHandle] = await window.showOpenFilePicker();
    this.filename = fileHandle.name;
    const file = await fileHandle.getFile();
    const text = await file.text();
    try {
      this.credentialString = text;
      this.credential = JSON.parse(text);
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
        this.credential = credential;
        this.renderings();
      })
      .catch(console.error);
  },
  getCredential($event) {
    try {
      this.credential = JSON.parse($event.target.value);
      this.parseError = "";
      this.renderings();
    } catch(error) {
      this.parseError = error.message;
      console.error(error);
    }
  }
  }).mount();
