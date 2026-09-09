/* render.js - block structure -> .docx, built in the browser.
 *
 * Layout decisions carried over from the Python renderer this replaces:
 *   - A4, not US Letter, because the readers are in Singapore
 *   - one column, one linear text stream, no tables or text boxes
 *   - a single accent colour on the name, section rules and bullet labels;
 *     body copy stays near-black so nothing competes for attention
 *   - job title on its own line, employer and right-aligned dates beneath it
 *
 * Fonts are limited to faces that ship with Word on both Windows and macOS,
 * so the layout does not reflow on the reader's machine.
 */
(function (global) {
  'use strict';

  /* A4 in twips (1/1440 in): 210mm x 297mm. */
  var PAGE_W = 11906, PAGE_H = 16838;
  var MARGIN_X = 1008;              // 0.7in
  var MARGIN_Y = 792;               // 0.55in
  var TEXT_W = PAGE_W - 2 * MARGIN_X;

  /* Half-points, the unit docx uses for run size. */
  var SZ = {
    name: 40, contact: 18, headline: 20, subline: 19,
    section: 21, role: 21, org: 19, subhead: 19, body: 20, small: 19
  };

  var THEMES = {
    navy:     { head: 'Georgia', body: 'Calibri',
                accent: '1F3A5F', ink: '1A1A1A', muted: '5A5A5A', rule: 'B8C4D4' },
    charcoal: { head: 'Georgia', body: 'Calibri',
                accent: '2B2B2B', ink: '1A1A1A', muted: '606060', rule: 'C6C6C6' },
    teal:     { head: 'Calibri', body: 'Calibri',
                accent: '14524B', ink: '1A1A1A', muted: '5A5A5A', rule: 'B5CCC8' },
    plain:    { head: 'Calibri', body: 'Calibri',
                accent: '000000', ink: '000000', muted: '444444', rule: '999999' }
  };

  /* Inline markup, deliberately limited to the three things a resume needs.
   * A full markdown inline parser would pull in a dependency to handle syntax
   * that never appears in this document. */
  var INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;

  function assign(a, b) {
    var out = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }

  function inlineRuns(text, base) {
    var d = global.docx;
    var runs = [], last = 0, m;
    INLINE_RE.lastIndex = 0;
    text = text || '';
    while ((m = INLINE_RE.exec(text)) !== null) {
      if (m.index > last) {
        runs.push(new d.TextRun(assign(base, { text: text.slice(last, m.index) })));
      }
      if (m[1] !== undefined) {
        runs.push(new d.TextRun(assign(base, { text: m[1], bold: true })));
      } else if (m[2] !== undefined) {
        runs.push(new d.TextRun(assign(base, { text: m[2], italics: true })));
      } else {
        runs.push(new d.ExternalHyperlink({
          link: m[4],
          children: [new d.TextRun(assign(base, {
            text: m[3], color: base.color, underline: {}
          }))]
        }));
      }
      last = INLINE_RE.lastIndex;
    }
    if (last < text.length) {
      runs.push(new d.TextRun(assign(base, { text: text.slice(last) })));
    }
    if (!runs.length) runs.push(new d.TextRun(assign(base, { text: '' })));
    return runs;
  }

  function build(model, opts) {
    var d = global.docx;
    if (!d) throw new Error('The docx library did not load.');

    opts = opts || {};
    var t = THEMES[opts.theme] || THEMES.navy;
    var head = model.header || {};
    var children = [];

    function para(o) { return new d.Paragraph(o); }

    var RIGHT_TAB = [{ type: d.TabStopType.RIGHT, position: TEXT_W }];

    /* ---- identity block ---- */
    if (head.name) {
      children.push(para({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new d.TextRun({
          text: head.name.toUpperCase(), bold: true, allCaps: true,
          font: t.head, size: SZ.name, color: t.accent, characterSpacing: 20
        })]
      }));
    }

    var contactRuns = [];
    if (head.contactText) {
      contactRuns = contactRuns.concat(inlineRuns(head.contactText,
        { font: t.body, size: SZ.contact, color: t.muted }));
    }
    (head.contactLinks || []).forEach(function (l, i) {
      if (contactRuns.length || i) {
        contactRuns.push(new d.TextRun({
          text: '  |  ', font: t.body, size: SZ.contact, color: t.muted
        }));
      }
      contactRuns.push(new d.ExternalHyperlink({
        link: l.url,
        children: [new d.TextRun({
          text: l.label, font: t.body, size: SZ.contact,
          color: t.accent, underline: {}
        })]
      }));
    });
    if (contactRuns.length) {
      children.push(para({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: head.headline ? 60 : 200 },
        children: contactRuns
      }));
    }

    if (head.headline) {
      children.push(para({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: head.subline ? 20 : 200 },
        children: inlineRuns(head.headline,
          { font: t.head, size: SZ.headline, bold: true, color: t.ink })
      }));
    }
    if (head.subline) {
      children.push(para({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 200 },
        children: inlineRuns(head.subline,
          { font: t.body, size: SZ.subline, italics: true, color: t.muted })
      }));
    }

    /* ---- sections ---- */
    (model.sections || []).forEach(function (section) {
      var name = section.displayName;
      if (name) {
        children.push(para({
          spacing: { before: 260, after: 90 },
          keepNext: true,
          outlineLevel: 0,
          border: {
            bottom: { style: d.BorderStyle.SINGLE, size: 6, color: t.rule, space: 3 }
          },
          children: [new d.TextRun({
            text: name.toUpperCase(), bold: true, allCaps: true,
            font: t.head, size: SZ.section, color: t.accent, characterSpacing: 12
          })]
        }));
      }
      (section.blocks || []).forEach(function (b) {
        blockParagraphs(b).forEach(function (p) { children.push(p); });
      });
    });

    function blockParagraphs(b) {
      switch (b.t) {
        case 'role': {
          var out = [para({
            spacing: { before: 200, after: 0 },
            keepNext: true,
            outlineLevel: 1,
            children: [new d.TextRun({
              text: b.role, bold: true, font: t.body, size: SZ.role, color: t.ink
            })]
          })];
          if (b.org || b.dates) {
            var runs = [];
            if (b.org) {
              runs = runs.concat(inlineRuns(b.org,
                { font: t.body, size: SZ.org, color: t.muted }));
            }
            if (b.dates) {
              runs.push(new d.TextRun({ text: '\t', font: t.body, size: SZ.org }));
              runs.push(new d.TextRun({
                text: b.dates, font: t.body, size: SZ.org,
                color: t.muted, italics: true
              }));
            }
            out.push(para({
              spacing: { after: 70 }, keepNext: true,
              tabStops: RIGHT_TAB, children: runs
            }));
          }
          return out;
        }

        case 'edu': {
          var eduRuns = [new d.TextRun({
            text: b.degree, bold: true, font: t.body, size: SZ.body, color: t.ink
          })];
          if (b.school) {
            eduRuns.push(new d.TextRun({
              text: '  -  ' + b.school, font: t.body, size: SZ.body, color: t.ink
            }));
          }
          if (b.year) {
            eduRuns.push(new d.TextRun({ text: '\t', font: t.body, size: SZ.body }));
            eduRuns.push(new d.TextRun({
              text: b.year, font: t.body, size: SZ.small,
              color: t.muted, italics: true
            }));
          }
          var eduOut = [para({
            spacing: { before: 120, after: b.note ? 20 : 60 },
            keepNext: !!b.note, tabStops: RIGHT_TAB, children: eduRuns
          })];
          if (b.note) {
            eduOut.push(para({
              spacing: { after: 60 },
              children: inlineRuns(b.note,
                { font: t.body, size: SZ.small, color: t.muted })
            }));
          }
          return eduOut;
        }

        case 'subhead':
          return [para({
            spacing: { before: 150, after: 50 }, keepNext: true,
            outlineLevel: 2,
            children: [new d.TextRun({
              text: b.text, bold: true, italics: true,
              font: t.body, size: SZ.subhead, color: t.accent
            })]
          })];

        case 'callout':
          return [para({
            spacing: { before: 80, after: 110 },
            indent: { left: 220 },
            border: {
              left: { style: d.BorderStyle.SINGLE, size: 12, color: t.rule, space: 8 }
            },
            children: inlineRuns(b.text,
              { font: t.body, size: SZ.small, italics: true, color: t.accent })
          })];

        case 'context':
          return [para({
            spacing: { after: 70 },
            children: inlineRuns(b.text,
              { font: t.body, size: SZ.small, italics: true, color: t.muted })
          })];

        case 'skill': {
          var skillRuns = [];
          if (b.label) {
            skillRuns.push(new d.TextRun({
              text: b.label + ': ', bold: true,
              font: t.body, size: SZ.body, color: t.accent
            }));
          }
          skillRuns = skillRuns.concat(inlineRuns(b.text,
            { font: t.body, size: SZ.body, color: t.ink }));
          return [para({ spacing: { after: 70 }, children: skillRuns })];
        }

        case 'bullet': {
          var bulletRuns = [];
          if (b.label) {
            bulletRuns.push(new d.TextRun({
              text: b.label + ': ', bold: true,
              font: t.body, size: SZ.body, color: t.accent
            }));
          }
          bulletRuns = bulletRuns.concat(inlineRuns(b.text,
            { font: t.body, size: SZ.body, color: t.ink }));
          return [para({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: bulletRuns
          })];
        }

        default:
          return [para({
            spacing: { after: 100 },
            children: inlineRuns(b.text,
              { font: t.body, size: SZ.body, color: t.ink })
          })];
      }
    }

    return new d.Document({
      creator: head.name || 'Resume',
      title: (head.name || 'Resume') + ' - Resume',
      description: 'Rendered from Markdown',
      styles: {
        default: {
          document: { run: { font: t.body, size: SZ.body, color: t.ink } }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN_Y, bottom: MARGIN_Y,
                      left: MARGIN_X, right: MARGIN_X }
          }
        },
        children: children
      }]
    });
  }

  global.ResumeRender = { build: build, THEMES: THEMES };
})(window);
