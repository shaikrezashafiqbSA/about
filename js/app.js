/* app.js - the page: load markdown, edit headings, preview, download .docx.
 *
 * The preview is drawn from the same block model as the .docx rather than from
 * a generic markdown renderer. That is the only way the page ruler can mean
 * anything: if the preview came from a different pipeline, its page breaks
 * would be a different document's page breaks.
 */
(function () {
  'use strict';

  var DEFAULT_SOURCE = 'content/Shaik_Reza_Shafiq_Resume.md';
  var STORE = 'resume-render.v1';

  var el = {
    file:     document.getElementById('file'),
    drop:     document.getElementById('drop'),
    org:      document.getElementById('org'),
    theme:    document.getElementById('theme'),
    headings: document.getElementById('headings'),
    reset:    document.getElementById('reset'),
    download: document.getElementById('download'),
    status:   document.getElementById('status'),
    pages:    document.getElementById('pages'),
    sheet:    document.getElementById('sheet'),
    rules:    document.getElementById('rules'),
    source:   document.getElementById('source')
  };

  var model = null;         // { header, sections }
  var overrides = {};       // section id -> heading text typed by the user
  var prefs = { org: '', theme: 'navy' };

  /* ---------------------------------------------------------------- state */

  function sectionId(s) { return s.key || ('~' + s.sourceName.toUpperCase()); }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var saved = JSON.parse(raw);
      overrides = saved.overrides || {};
      prefs.org = saved.org || '';
      prefs.theme = saved.theme || 'navy';
    } catch (e) { /* private window, cleared storage: defaults are fine */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        overrides: overrides, org: prefs.org, theme: prefs.theme
      }));
    } catch (e) { /* nothing here is worth failing a render over */ }
  }

  function setStatus(msg, kind) {
    el.status.textContent = msg || '';
    el.status.className = msg ? ('status ' + (kind || '')) : 'status';
  }

  /* --------------------------------------------------------------- naming */

  function templateFor(section) {
    var id = sectionId(section);
    return overrides[id] !== undefined
      ? overrides[id]
      : window.ResumeParse.defaultName(section);
  }

  function applyNames() {
    model.sections.forEach(function (s) {
      s.displayName = window.ResumeParse.applyOrg(templateFor(s), prefs.org);
    });
  }

  function buildHeadingPanel() {
    el.headings.innerHTML = '';
    model.sections.forEach(function (s) {
      var id = sectionId(s);
      var row = document.createElement('label');
      row.className = 'heading-row';

      var tag = document.createElement('span');
      tag.className = 'heading-tag' + (s.key ? '' : ' custom');
      tag.textContent = s.key || 'other';
      tag.title = s.key
        ? 'Matched from "' + s.sourceName + '"'
        : 'No canonical slot matched; this section keeps its own name and sits last';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = templateFor(s);
      input.spellcheck = false;
      input.addEventListener('input', function () {
        overrides[id] = input.value;
        savePrefs();
        refresh();
      });

      row.appendChild(tag);
      row.appendChild(input);
      el.headings.appendChild(row);
    });

    if (!model.sections.length) {
      el.headings.innerHTML =
        '<p class="hint">No sections found. Check that the file uses headings.</p>';
    }
  }

  /* -------------------------------------------------------------- preview */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;

  function inlineHtml(text) {
    var out = '', last = 0, m;
    text = text || '';
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(text)) !== null) {
      out += esc(text.slice(last, m.index));
      if (m[1] !== undefined) out += '<strong>' + esc(m[1]) + '</strong>';
      else if (m[2] !== undefined) out += '<em>' + esc(m[2]) + '</em>';
      else out += '<a href="' + esc(m[4]) + '">' + esc(m[3]) + '</a>';
      last = INLINE_RE.lastIndex;
    }
    return out + esc(text.slice(last));
  }

  function blockHtml(b) {
    switch (b.t) {
      case 'role': {
        var h = '<p class="r-role">' + esc(b.role) + '</p>';
        if (b.org || b.dates) {
          h += '<p class="r-org"><span>' + inlineHtml(b.org) + '</span>' +
               '<span class="r-dates">' + esc(b.dates) + '</span></p>';
        }
        return h;
      }
      case 'edu': {
        var e = '<p class="r-edu"><span><strong>' + esc(b.degree) + '</strong>' +
                (b.school ? '  -  ' + esc(b.school) : '') + '</span>' +
                '<span class="r-dates">' + esc(b.year) + '</span></p>';
        if (b.note) e += '<p class="r-note">' + inlineHtml(b.note) + '</p>';
        return e;
      }
      case 'subhead':
        return '<p class="r-subhead">' + esc(b.text) + '</p>';
      case 'callout':
        return '<p class="r-callout">' + inlineHtml(b.text) + '</p>';
      case 'context':
        return '<p class="r-context">' + inlineHtml(b.text) + '</p>';
      case 'skill':
        return '<p class="r-skill">' +
               (b.label ? '<strong>' + esc(b.label) + ': </strong>' : '') +
               inlineHtml(b.text) + '</p>';
      case 'bullet':
        return '<p class="r-bullet">' +
               (b.label ? '<strong>' + esc(b.label) + ': </strong>' : '') +
               inlineHtml(b.text) + '</p>';
      default:
        return '<p class="r-para">' + inlineHtml(b.text) + '</p>';
    }
  }

  function renderPreview() {
    var h = model.header, out = '';
    if (h.name) out += '<p class="r-name">' + esc(h.name) + '</p>';

    var contact = h.contactText ? inlineHtml(h.contactText) : '';
    (h.contactLinks || []).forEach(function (l) {
      if (contact) contact += '  |  ';
      contact += '<a href="' + esc(l.url) + '">' + esc(l.label) + '</a>';
    });
    if (contact) out += '<p class="r-contact">' + contact + '</p>';
    if (h.headline) out += '<p class="r-headline">' + inlineHtml(h.headline) + '</p>';
    if (h.subline) out += '<p class="r-subline">' + inlineHtml(h.subline) + '</p>';

    model.sections.forEach(function (s) {
      if (s.displayName) {
        out += '<p class="r-section">' + esc(s.displayName) + '</p>';
      }
      s.blocks.forEach(function (b) { out += blockHtml(b); });
    });

    el.sheet.innerHTML = out;
    document.body.setAttribute('data-theme', prefs.theme);
    measurePages();
  }

  /* Page count is an estimate. The preview uses the same page size, margins and
   * type scale as the .docx, but a browser and Word break lines differently, so
   * treat a result right on the boundary as "check it in Word". */
  function measurePages() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:297mm';
    document.body.appendChild(probe);
    var pageH = probe.offsetHeight;
    document.body.removeChild(probe);

    var padY = parseFloat(getComputedStyle(el.sheet).paddingTop) || 0;
    var usable = pageH - 2 * padY;
    var contentH = el.sheet.scrollHeight - 2 * padY;
    var count = Math.max(1, Math.ceil(contentH / usable));

    el.rules.innerHTML = '';
    for (var i = 1; i < count; i++) {
      var line = document.createElement('div');
      line.className = 'page-rule';
      line.style.top = (padY + i * usable) + 'px';
      line.dataset.label = 'page ' + (i + 1);
      el.rules.appendChild(line);
    }

    el.pages.textContent = count + (count === 1 ? ' page' : ' pages') + ' (estimated)';
    el.pages.className = count > 3 ? 'pages over' : 'pages';
    if (count > 3) {
      setStatus('Over three pages. Trim in this order: Languages, then Community ' +
                'Engagement, then the lowest-relevance bullets in the oldest roles.',
                'warn');
    } else if (el.status.classList.contains('warn')) {
      setStatus('');
    }
  }

  /* --------------------------------------------------------------- render */

  function refresh() {
    if (!model) return;
    applyNames();
    renderPreview();
  }

  function loadMarkdown(md, label) {
    model = window.ResumeParse.parse(md);
    el.source.textContent = label;
    buildHeadingPanel();
    refresh();
    el.download.disabled = !window.docx;
    if (!window.docx) {
      setStatus('The docx library did not load, so download is unavailable. ' +
                'Check your network or ad blocker.', 'err');
    }
  }

  function slug(s) {
    return String(s || '').trim().replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function download() {
    if (!model) return;
    el.download.disabled = true;
    var original = el.download.textContent;
    el.download.textContent = 'Building...';

    setTimeout(function () {
      try {
        var doc = window.ResumeRender.build(model, { theme: prefs.theme });
        window.docx.Packer.toBlob(doc).then(function (blob) {
          var parts = [slug(model.header.name) || 'Resume'];
          if (prefs.org) parts.push(slug(prefs.org));
          parts.push('Resume');
          var filename = parts.join('_') + '.docx';

          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          setStatus('Downloaded ' + filename, 'ok');
        }).catch(function (e) {
          setStatus('Could not package the .docx: ' + e, 'err');
        }).then(function () {
          el.download.disabled = false;
          el.download.textContent = original;
        });
      } catch (e) {
        setStatus('Could not build the .docx: ' + e, 'err');
        el.download.disabled = false;
        el.download.textContent = original;
      }
    }, 0);
  }

  /* ----------------------------------------------------------------- wire */

  function readFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { loadMarkdown(String(reader.result), file.name); };
    reader.onerror = function () { setStatus('Could not read that file.', 'err'); };
    reader.readAsText(file);
  }

  el.file.addEventListener('change', function () { readFile(el.file.files[0]); });

  ['dragenter', 'dragover'].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) {
      e.preventDefault();
      el.drop.classList.add('over');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) {
      e.preventDefault();
      el.drop.classList.remove('over');
    });
  });
  el.drop.addEventListener('drop', function (e) {
    readFile(e.dataTransfer.files[0]);
  });

  el.org.addEventListener('input', function () {
    prefs.org = el.org.value;
    savePrefs();
    refresh();
  });

  el.theme.addEventListener('change', function () {
    prefs.theme = el.theme.value;
    savePrefs();
    refresh();
  });

  el.reset.addEventListener('click', function () {
    overrides = {};
    savePrefs();
    buildHeadingPanel();
    refresh();
  });

  el.download.addEventListener('click', download);
  window.addEventListener('resize', function () { if (model) measurePages(); });

  /* ---------------------------------------------------------------- start */

  loadPrefs();
  el.org.value = prefs.org;
  el.theme.value = prefs.theme;

  fetch(DEFAULT_SOURCE)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (md) { loadMarkdown(md, DEFAULT_SOURCE); })
    .catch(function (err) {
      var isFile = location.protocol === 'file:';
      setStatus(isFile
        ? 'Opened over file://, so the browser blocks reading the sample. ' +
          'Drop a Markdown file above, or serve the folder over HTTP.'
        : 'Could not load the sample (' + err + '). Drop a Markdown file above.',
        'err');
    });
})();
