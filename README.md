<!--
Copyright 2025 Digital Bazaar, Inc.

SPDX-License-Identifier: BSD-3-Clause
-->

# Verifiable Credential Viewer

Open locally stored credentials in your browser in order to...
- preview any
[SvgRenderingTemplate2024](https://github.com/digitalbazaar/vc-render-method-context/blob/main/contexts/v2rc1.jsonld)
render methods included
- view other contents and images
- edit the JSON-LD

![Screenshot showing a Verifiable Credential being viewed](screenshot.png)

## Usage

Open the `index.html` in your browser (or host a webserver locally to serve
that file). The rest happens in your browser.

The Web app is built using [petite-vue](https://github.com/vuejs/petite-vue) and
is delightfully build tool free (for now).

## Examples

Examples are pulled from the hosted version of
https://github.com/credential-handler/vc-examples via a Linked Data Platform
(LDP) Basic Container description hosted at
https://examples.vcplayground.org/credentials/index.json


## Render Method implementations

The current viewer code implements *only* SVG processing based on the
`SvgRenderingTemplate2024` draft. Most importantly, the `template` value MUST
be a string containing "raw" `<svg>...</svg>` that can be displayed (after
[Mustache](https://mustache.github.io/) template processing) via an
`<img src="">` tag.

## License

[BSD-3-Clause](LICENSE) Copyright 2024 Digital Bazaar, Inc.

Commercial support and licensing is available by contacting
[Digital Bazaar](https://digitalbazaar.com/) <support@digitalbazaar.com>.
