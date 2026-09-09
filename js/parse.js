/* parse.js - resume Markdown -> ordered section/block structure.
 *
 * The dialect here is what Google Docs and LLM output actually produce, not
 * clean CommonMark: bold lines standing in for headings, "* " bullets, and
 * backslash-escaped punctuation. Clean ATX markdown is accepted too, so
 * hand-written files work.
 *
 * Two-column tables are flattened into "Label: items" paragraphs rather than
 * emitted as tables. A table keeps its text out of the linear stream, and the
 * whole point of the .docx is that it reads top to bottom in one column.
 */
(function (global) {
  'use strict';

  var ESCAPE_RE   = /\\([\\*_{}\[\]()#+\-.!~|>&$@%^=?/"':;,`])/g;
  var LINK_RE     = /\[([^\]]+)\]\(([^)]+)\)/g;
  var ROW_RE      = /^\|(.+)\|\s*$/;
  var SEP_RE      = /^\|[\s:|\-]+\|\s*$/;
  var BULLET_RE   = /^[*+\-]\s+(.*)$/;
  var ATX_RE      = /^(#{1,6})\s+(.*)$/;
  var TRIBOLD_RE  = /^\*\*\*(.+?)\*\*\*$/;
  var FULLBOLD_RE = /^\*\*(.+?)\*\*$/;
  var FULLITAL_RE = /^\*(?!\*)([^*]+)\*$/;
  var BOLDITAL_RE = /^\*\*(.+?)\*\*\s+\*(?!\*)([^*]+)\*\s*$/;
  var EDU_RE      = /^\*\*(.+?)\*\*\s*[–—-]\s*(.+?)\s*\*(?!\*)([^*]+)\*\s*$/;
  var LABEL_RE    = /^\*\*(.+?)\*\*:?\s*(.*)$/;
  /* "**Category** - items" written as a plain line rather than a table row.
   * Only trusted inside the skills section, where a bold lead-in is always a
   * category label and never a job title. */
  var SKILLROW_RE = /^\*\*(.+?)\*\*\s*[:–—-]\s*(.+)$/;

  /* The seven slots, in the order they must appear in the finished document.
   * Anything that does not match one of these keeps its own name and is
   * appended after them in source order. */
  var ORDER = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'EDUCATION',
               'CERTIFICATIONS', 'COMMUNITY', 'LANGUAGES'];

  var DEFAULT_NAMES = {
    SUMMARY:        'WHO I AM & THE VALUE I BRING TO [ORGANISATION NAME]',
    SKILLS:         'SKILLS AND CORE COMPETENCIES',
    EXPERIENCE:     'PROFESSIONAL EXPERIENCE',
    EDUCATION:      'EDUCATION',
    CERTIFICATIONS: 'CERTIFICATIONS AND PROFESSIONAL DEVELOPMENT',
    COMMUNITY:      'COMMUNITY ENGAGEMENT',
    LANGUAGES:      'LANGUAGES'
  };

  /* A heading is assigned to the first slot whose synonym appears anywhere in
   * it, so "CORE COMPETENCIES & TECHNICAL SKILLS" and "Skills" both land in
   * SKILLS. Longer phrases come first within each list so the specific match
   * wins over the generic one. */
  var SYNONYMS = [
    ['SUMMARY',        ['WHO I AM', 'VALUE I BRING', 'PROFESSIONAL SUMMARY',
                        'EXECUTIVE SUMMARY', 'SUMMARY', 'PROFILE', 'ABOUT ME']],
    ['SKILLS',         ['CORE COMPETENC', 'COMPETENC', 'TECHNICAL SKILL',
                        'KEY SKILL', 'SKILL']],
    ['EXPERIENCE',     ['PROFESSIONAL EXPERIENCE', 'WORK EXPERIENCE',
                        'CAREER HISTORY', 'EMPLOYMENT', 'EXPERIENCE']],
    ['EDUCATION',      ['EDUCATION', 'ACADEMIC']],
    ['CERTIFICATIONS', ['CERTIFICAT', 'PROFESSIONAL DEVELOPMENT', 'TRAINING',
                        'COURSES', 'ACCREDITATION']],
    ['COMMUNITY',      ['COMMUNITY', 'VOLUNTEER', 'OUTREACH']],
    ['LANGUAGES',      ['LANGUAGE']]
  ];

  function unescapeMd(s) { return s.replace(ESCAPE_RE, '$1'); }

  function stripEmph(s) {
    s = s.trim();
    for (var n = 3; n >= 1; n--) {
      var mark = new Array(n + 1).join('*');
      if (s.length > 2 * n && s.slice(0, n) === mark && s.slice(-n) === mark) {
        return s.slice(n, -n).trim();
      }
    }
    return s;
  }

  /* A fully-bold line whose letters are all uppercase is a section heading. */
  function isSectionHeading(text) {
    var letters = text.replace(/[^A-Za-z]/g, '');
    return letters.length >= 3 && letters === letters.toUpperCase();
  }

  function classify(name) {
    var up = name.toUpperCase();
    for (var i = 0; i < SYNONYMS.length; i++) {
      var key = SYNONYMS[i][0], words = SYNONYMS[i][1];
      for (var j = 0; j < words.length; j++) {
        if (up.indexOf(words[j]) !== -1) return key;
      }
    }
    return null;
  }

  function splitRole(bold) {
    var parts = bold.split('|').map(function (p) { return p.trim(); });
    if (parts.length >= 2) return [parts[0], parts.slice(1).join(' | ')];
    return [bold.trim(), ''];
  }

  function Parser() {
    this.header = { name: '', contactText: '', contactLinks: [],
                    headline: '', subline: '' };
    this.sections = [];
    this.current = null;
    this.table = null;
    this.stage = 0;           // 0 name, 1 contact, 2 headline, 3 subline, 4 body
    this.inEducation = false;
    this.inSkills = false;
  }

  Parser.prototype.push = function (block) {
    if (!this.current) {
      /* Content before any heading: a nameless leading section. It renders
       * straight after the identity block with no heading of its own. */
      this.current = { key: null, sourceName: '', blocks: [] };
      this.sections.push(this.current);
    }
    this.current.blocks.push(block);
  };

  Parser.prototype.addSection = function (name) {
    var key = classify(name);
    this.inEducation = (key === 'EDUCATION');
    this.inSkills = (key === 'SKILLS');
    /* A repeated heading reopens the section already holding that slot, so a
     * resume split across two "EXPERIENCE" blocks does not render twice. */
    if (key) {
      for (var i = 0; i < this.sections.length; i++) {
        if (this.sections[i].key === key) { this.current = this.sections[i]; return; }
      }
    }
    this.current = { key: key, sourceName: name.trim(), blocks: [] };
    this.sections.push(this.current);
  };

  Parser.prototype.flushTable = function () {
    if (!this.table) { this.table = null; return; }
    for (var i = 0; i < this.table.length; i++) {
      var label = stripEmph(this.table[i][0]);
      var text = this.table[i][1] || '';
      if (label || text) this.push({ t: 'skill', label: label, text: text });
    }
    this.table = null;
  };

  Parser.prototype.addBullet = function (body) {
    var m = LABEL_RE.exec(body);
    if (m && m[2]) {
      this.push({ t: 'bullet', label: m[1].replace(/:$/, '').trim(),
                  text: m[2].trim() });
    } else {
      this.push({ t: 'bullet', text: body });
    }
  };

  /* Absorb the first four meaningful lines as the identity block. */
  Parser.prototype.consumeHeader = function (line) {
    var m;
    if (this.stage === 0) {
      m = FULLBOLD_RE.exec(line) || ATX_RE.exec(line);
      if (!m) return false;
      this.header.name = stripEmph(m[m.length - 1]).trim();
      this.stage = 1;
      return true;
    }
    if (this.stage === 1) {
      var links = [], lm;
      LINK_RE.lastIndex = 0;
      while ((lm = LINK_RE.exec(line)) !== null) {
        links.push({ label: lm[1], url: lm[2] });
      }
      this.header.contactLinks = links;
      this.header.contactText = line.replace(LINK_RE, '')
        .replace(/(\s*\|\s*){2,}/g, '  |  ')
        .replace(/(\s*\|\s*)+$/, '')
        .replace(/^(\s*\|\s*)+/, '')
        .trim();
      this.stage = 2;
      return true;
    }
    if (this.stage === 2) {
      m = FULLBOLD_RE.exec(line);
      if (m && !isSectionHeading(m[1])) {
        this.header.headline = m[1].trim();
        this.stage = 3;
        return true;
      }
      this.stage = 4;
      return false;
    }
    if (this.stage === 3) {
      if (!/^[#*|]/.test(line)) {
        this.header.subline = line;
        this.stage = 4;
        return true;
      }
      this.stage = 4;
      return false;
    }
    return false;
  };

  Parser.prototype.parse = function (md) {
    var lines = md.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = unescapeMd(lines[i].trim());
      if (!line) { this.flushTable(); continue; }

      if (ROW_RE.test(line)) {
        if (SEP_RE.test(line)) continue;
        var cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|')
          .map(function (c) { return c.trim(); });
        if (!cells.some(Boolean)) continue;
        if (this.table === null) this.table = [];
        this.table.push(cells.length >= 2 ? cells.slice(0, 2) : [cells[0], '']);
        continue;
      }
      this.flushTable();

      if (this.stage < 4 && this.consumeHeader(line)) continue;

      var m = ATX_RE.exec(line);
      if (m) {
        var depth = m[1].length, text = stripEmph(m[2]);
        if (depth <= 2) {
          this.addSection(text);
        } else if (depth === 3) {
          var rs = splitRole(text);
          this.push({ t: 'role', role: rs[0], org: rs[1], dates: '' });
        } else {
          this.push({ t: 'subhead', text: text });
        }
        continue;
      }

      m = BULLET_RE.exec(line);
      if (m) { this.addBullet(m[1].trim()); continue; }

      m = TRIBOLD_RE.exec(line);
      if (m) { this.push({ t: 'subhead', text: m[1].trim() }); continue; }

      if (this.inEducation) {
        m = EDU_RE.exec(line);
        if (m) {
          this.push({ t: 'edu', degree: m[1].trim(), school: m[2].trim(),
                      year: m[3].trim() });
          continue;
        }
      }

      if (this.inSkills) {
        m = SKILLROW_RE.exec(line);
        if (m) {
          this.push({ t: 'skill', label: m[1].trim(), text: m[2].trim() });
          continue;
        }
      }

      m = BOLDITAL_RE.exec(line);
      if (m) {
        var r = splitRole(m[1]);
        this.push({ t: 'role', role: r[0], org: r[1], dates: m[2].trim() });
        continue;
      }

      m = FULLBOLD_RE.exec(line);
      if (m) {
        var bold = m[1].trim();
        if (isSectionHeading(bold)) {
          this.addSection(bold);
        } else if (bold.indexOf('|') !== -1) {
          var r2 = splitRole(bold);
          this.push({ t: 'role', role: r2[0], org: r2[1], dates: '' });
        } else {
          this.push({ t: 'para', text: line });
        }
        continue;
      }

      m = FULLITAL_RE.exec(line);
      if (m) {
        var it = m[1].trim();
        this.push({ t: /^guiding principle/i.test(it) ? 'callout' : 'context',
                    text: it });
        continue;
      }

      /* A plain line straight after a degree is its coursework note. Folding
       * it into the degree keeps it tight instead of floating as a paragraph. */
      var blocks = this.current ? this.current.blocks : null;
      var last = blocks && blocks.length ? blocks[blocks.length - 1] : null;
      if (this.inEducation && last && last.t === 'edu' && !last.note) {
        last.note = line;
        continue;
      }

      this.push({ t: 'para', text: line });
    }
    this.flushTable();
    return { header: this.header, sections: this.sections };
  };

  /* Canonical slots first in fixed order, then anything unrecognised. */
  function orderSections(sections) {
    var out = [], seen = [];
    ORDER.forEach(function (key) {
      sections.forEach(function (s) {
        if (s.key === key) { out.push(s); seen.push(s); }
      });
    });
    sections.forEach(function (s) {
      if (seen.indexOf(s) === -1) out.push(s);
    });
    return out;
  }

  /* An empty organisation drops the whole trailing "TO [ORGANISATION NAME]"
   * clause, so the heading still reads as a sentence before you tailor it. */
  function applyOrg(name, org) {
    if (org && org.trim()) {
      return name.replace(/\[ORGANISATION NAME\]/g, org.trim().toUpperCase());
    }
    return name.replace(/\s*(TO\s+)?\[ORGANISATION NAME\]/g, '').trim();
  }

  function defaultName(section) {
    return section.key ? DEFAULT_NAMES[section.key] : section.sourceName;
  }

  global.ResumeParse = {
    parse: function (md) {
      var r = new Parser().parse(md);
      r.sections = orderSections(r.sections);
      return r;
    },
    applyOrg: applyOrg,
    defaultName: defaultName,
    DEFAULT_NAMES: DEFAULT_NAMES,
    ORDER: ORDER
  };
})(window);
