// Copyright 2025 Digital Bazaar, Inc.
//
// SPDX-License-Identifier: BSD-3-Clause

// from https://stackoverflow.com/a/47317538
function prettyXML(sourceXml) {
    var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
    var xsltDoc = new DOMParser().parseFromString([
        // describes how we want to modify the XML - indent everything
        '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
        '  <xsl:strip-space elements="*"/>',
        '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
        '    <xsl:value-of select="normalize-space(.)"/>',
        '  </xsl:template>',
        '  <xsl:template match="node()|@*">',
        '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
        '  </xsl:template>',
        '  <xsl:output indent="yes"/>',
        '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
}

export function SVGViewer({idx, credential}) {
  return {
    $template: '#svg-viewer',
    // local state
    credential,
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
        return this.mustache(this.code, this.credential);
      }
    },
    template() {
      let template = '';
      if ('renderMethod' in this.credential) {
        const renderMethod = Array.isArray(this.credential.renderMethod) ?
          this.credential.renderMethod[idx] :
          this.credential.renderMethod;

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
