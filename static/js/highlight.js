/*
  Highlight.js 10.0.0 (705f49b8)
  License: BSD-3-Clause
  Copyright (c) 2006-2020, Ivan Sagalaev
*/
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.hljs = factory());
}(this, (function () { 'use strict';

  // https://github.com/substack/deep-freeze/blob/master/index.js
  function deepFreeze (o) {
    Object.freeze(o);

    var objIsFunction = typeof o === 'function';

    Object.getOwnPropertyNames(o).forEach(function (prop) {
      if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      // IE11 fix: https://github.com/highlightjs/highlight.js/issues/2318
      // TODO: remove in the future
      && (objIsFunction ? prop !== 'caller' && prop !== 'callee' && prop !== 'arguments' : true)
      && !Object.isFrozen(o[prop])) {
        deepFreeze(o[prop]);
      }
    });

    return o;
  }

  function escapeHTML(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  
  function inherit(parent) { // inherit(parent, override_obj, override_obj, ...)
    var result = {};
    var objects = Array.prototype.slice.call(arguments, 1);

    for (const key in parent) {
      result[key] = parent[key];
    }
    objects.forEach(function(obj) {
      for (const key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  /* Stream merging */

  function tag(node) {
    return node.nodeName.toLowerCase();
  }

  function nodeStream(node) {
    var result = [];
    (function _nodeStream(node, offset) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) {
          offset += child.nodeValue.length;
        } else if (child.nodeType === 1) {
          result.push({
            event: 'start',
            offset: offset,
            node: child
          });
          offset = _nodeStream(child, offset);
          // Prevent void elements from having an end tag that would actually
          // double them in the output. There are more void elements in HTML
          // but we list only those realistically expected in code display.
          if (!tag(child).match(/br|hr|img|input/)) {
            result.push({
              event: 'stop',
              offset: offset,
              node: child
            });
          }
        }
      }
      return offset;
    })(node, 0);
    return result;
  }

  function mergeStreams(original, highlighted, value) {
    var processed = 0;
    var result = '';
    var nodeStack = [];

    function selectStream() {
      if (!original.length || !highlighted.length) {
        return original.length ? original : highlighted;
      }
      if (original[0].offset !== highlighted[0].offset) {
        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
      }

      /*
      To avoid starting the stream just before it should stop the order is
      ensured that original always starts first and closes last:

      if (event1 == 'start' && event2 == 'start')
        return original;
      if (event1 == 'start' && event2 == 'stop')
        return highlighted;
      if (event1 == 'stop' && event2 == 'start')
        return original;
      if (event1 == 'stop' && event2 == 'stop')
        return highlighted;

      ... which is collapsed to:
      */
      return highlighted[0].event === 'start' ? original : highlighted;
    }

    function open(node) {
      function attr_str(a) {
        return ' ' + a.nodeName + '="' + escapeHTML(a.value).replace(/"/g, '&quot;') + '"';
      }
      result += '<' + tag(node) + [].map.call(node.attributes, attr_str).join('') + '>';
    }

    function close(node) {
      result += '</' + tag(node) + '>';
    }

    function render(event) {
      (event.event === 'start' ? open : close)(event.node);
    }

    while (original.length || highlighted.length) {
      var stream = selectStream();
      result += escapeHTML(value.substring(processed, stream[0].offset));
      processed = stream[0].offset;
      if (stream === original) {
        /*
        On any opening or closing tag of the original markup we first close
        the entire highlighted node stack, then render the original tag along
        with all the following original tags at the same offset and then
        reopen all the tags on the highlighted stack.
        */
        nodeStack.reverse().forEach(close);
        do {
          render(stream.splice(0, 1)[0]);
          stream = selectStream();
        } while (stream === original && stream.length && stream[0].offset === processed);
        nodeStack.reverse().forEach(open);
      } else {
        if (stream[0].event === 'start') {
          nodeStack.push(stream[0].node);
        } else {
          nodeStack.pop();
        }
        render(stream.splice(0, 1)[0]);
      }
    }
    return result + escapeHTML(value.substr(processed));
  }

  var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    escapeHTML: escapeHTML,
    inherit: inherit,
    nodeStream: nodeStream,
    mergeStreams: mergeStreams
  });

  const SPAN_CLOSE = '</span>';
  const emitsWrappingTags = (node) => {
    return !!node.kind;
  };

  class HTMLRenderer {
    constructor(tree, options) {
      this.buffer = "";
      this.classPrefix = options.classPrefix;
      tree.walk(this);
    }

    // renderer API

    addText(text) {
      this.buffer += escapeHTML(text);
    }

    openNode(node) {
      if (!emitsWrappingTags(node)) return;

      let className = node.kind;
      if (!node.sublanguage) {
        className = `${this.classPrefix}${className}`;
      }
      this.span(className);
    }

    closeNode(node) {
      if (!emitsWrappingTags(node)) return;

      this.buffer += SPAN_CLOSE;
    }

    // helpers

    span(className) {
      this.buffer += `<span class="${className}">`;
    }

    value() {
      return this.buffer;
    }
  }

  class TokenTree {
    constructor() {
      this.rootNode = { children: [] };
      this.stack = [this.rootNode];
    }

    get top() {
      return this.stack[this.stack.length - 1];
    }

    get root() { return this.rootNode; }

    add(node) {
      this.top.children.push(node);
    }

    openNode(kind) {
      const node = { kind, children: [] };
      this.add(node);
      this.stack.push(node);
    }

    closeNode() {
      if (this.stack.length > 1) {
        return this.stack.pop();
      }
    }

    closeAllNodes() {
      while (this.closeNode());
    }

    toJSON() {
      return JSON.stringify(this.rootNode, null, 4);
    }

    walk(builder) {
      return this.constructor._walk(builder, this.rootNode);
    }

    static _walk(builder, node) {
      if (typeof node === "string") {
        builder.addText(node);
      } else if (node.children) {
        builder.openNode(node);
        node.children.forEach((child) => this._walk(builder, child));
        builder.closeNode(node);
      }
      return builder;
    }

    static _collapse(node) {
      if (!node.children) {
        return;
      }
      if (node.children.every(el => typeof el === "string")) {
        node.text = node.children.join("");
        delete node.children;
      } else {
        node.children.forEach((child) => {
          if (typeof child === "string") return;
          TokenTree._collapse(child);
        });
      }
    }
  }

  /**
    Currently this is all private API, but this is the minimal API necessary
    that an Emitter must implement to fully support the parser.

    Minimal interface:

    - addKeyword(text, kind)
    - addText(text)
    - addSublanguage(emitter, subLanguageName)
    - finalize()
    - openNode(kind)
    - closeNode()
    - closeAllNodes()
    - toHTML()

  */
  class TokenTreeEmitter extends TokenTree {
    constructor(options) {
      super();
      this.options = options;
    }

    addKeyword(text, kind) {
      if (text === "") { return; }

      this.openNode(kind);
      this.addText(text);
      this.closeNode();
    }

    addText(text) {
      if (text === "") { return; }

      this.add(text);
    }

    addSublanguage(emitter, name) {
      const node = emitter.root;
      node.kind = name;
      node.sublanguage = true;
      this.add(node);
    }

    toHTML() {
      const renderer = new HTMLRenderer(this, this.options);
      return renderer.value();
    }

    finalize() {
      return true;
    }
  }

  function escape(value) {
    return new RegExp(value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'm');
  }

  function source(re) {
    // if it's a regex get it's source,
    // otherwise it's a string already so just return it
    return (re && re.source) || re;
  }

  function countMatchGroups(re) {
    return (new RegExp(re.toString() + '|')).exec('').length - 1;
  }

  function startsWith(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index === 0;
  }

  // join logically computes regexps.join(separator), but fixes the
  // backreferences so they continue to match.
  // it also places each individual regular expression into it's own
  // match group, keeping track of the sequencing of those match groups
  // is currently an exercise for the caller. :-)
  function join(regexps, separator) {
    // backreferenceRe matches an open parenthesis or backreference. To avoid
    // an incorrect parse, it additionally matches the following:
    // - [...] elements, where the meaning of parentheses and escapes change
    // - other escape sequences, so we do not misparse escape sequences as
    //   interesting elements
    // - non-matching or lookahead parentheses, which do not capture. These
    //   follow the '(' with a '?'.
    var backreferenceRe = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
    var numCaptures = 0;
    var ret = '';
    for (var i = 0; i < regexps.length; i++) {
      numCaptures += 1;
      var offset = numCaptures;
      var re = source(regexps[i]);
      if (i > 0) {
        ret += separator;
      }
      ret += "(";
      while (re.length > 0) {
        var match = backreferenceRe.exec(re);
        if (match == null) {
          ret += re;
          break;
        }
        ret += re.substring(0, match.index);
        re = re.substring(match.index + match[0].length);
        if (match[0][0] === '\\' && match[1]) {
          // Adjust the backreference.
          ret += '\\' + String(Number(match[1]) + offset);
        } else {
          ret += match[0];
          if (match[0] === '(') {
            numCaptures++;
          }
        }
      }
      ret += ")";
    }
    return ret;
  }

  // Common regexps
  const IDENT_RE = '[a-zA-Z]\\w*';
  const UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
  const NUMBER_RE = '\\b\\d+(\\.\\d+)?';
  const C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
  const BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
  const RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

  // Common modes
  const BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
  };
  const APOS_STRING_MODE = {
    className: 'string',
    begin: '\'',
    end: '\'',
    illegal: '\\n',
    contains: [BACKSLASH_ESCAPE]
  };
  const QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"',
    end: '"',
    illegal: '\\n',
    contains: [BACKSLASH_ESCAPE]
  };
  const PHRASAL_WORDS_MODE = {
    begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
  };
  const COMMENT = function(begin, end, inherits) {
    var mode = inherit(
      {
        className: 'comment',
        begin: begin,
        end: end,
        contains: []
      },
      inherits || {}
    );
    mode.contains.push(PHRASAL_WORDS_MODE);
    mode.contains.push({
      className: 'doctag',
      begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
      relevance: 0
    });
    return mode;
  };
  const C_LINE_COMMENT_MODE = COMMENT('//', '$');
  const C_BLOCK_COMMENT_MODE = COMMENT('/\\*', '\\*/');
  const HASH_COMMENT_MODE = COMMENT('#', '$');
  const NUMBER_MODE = {
    className: 'number',
    begin: NUMBER_RE,
    relevance: 0
  };
  const C_NUMBER_MODE = {
    className: 'number',
    begin: C_NUMBER_RE,
    relevance: 0
  };
  const BINARY_NUMBER_MODE = {
    className: 'number',
    begin: BINARY_NUMBER_RE,
    relevance: 0
  };
  const CSS_NUMBER_MODE = {
    className: 'number',
    begin: NUMBER_RE + '(' +
      '%|em|ex|ch|rem' +
      '|vw|vh|vmin|vmax' +
      '|cm|mm|in|pt|pc|px' +
      '|deg|grad|rad|turn' +
      '|s|ms' +
      '|Hz|kHz' +
      '|dpi|dpcm|dppx' +
      ')?',
    relevance: 0
  };
  const REGEXP_MODE = {
    // this outer rule makes sure we actually have a WHOLE regex and not simply
    // an expression such as:
    //
    //     3 / something
    //
    // (which will then blow up when regex's `illegal` sees the newline)
    begin: /(?=\/[^/\n]*\/)/,
    contains: [{
      className: 'regexp',
      begin: /\//,
      end: /\/[gimuy]*/,
      illegal: /\n/,
      contains: [
        BACKSLASH_ESCAPE,
        {
          begin: /\[/,
          end: /\]/,
          relevance: 0,
          contains: [BACKSLASH_ESCAPE]
        }
      ]
    }]
  };
  const TITLE_MODE = {
    className: 'title',
    begin: IDENT_RE,
    relevance: 0
  };
  const UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: UNDERSCORE_IDENT_RE,
    relevance: 0
  };
  const METHOD_GUARD = {
    // excludes method names from keyword processing
    begin: '\\.\\s*' + UNDERSCORE_IDENT_RE,
    relevance: 0
  };

  var MODES = /*#__PURE__*/Object.freeze({
    __proto__: null,
    IDENT_RE: IDENT_RE,
    UNDERSCORE_IDENT_RE: UNDERSCORE_IDENT_RE,
    NUMBER_RE: NUMBER_RE,
    C_NUMBER_RE: C_NUMBER_RE,
    BINARY_NUMBER_RE: BINARY_NUMBER_RE,
    RE_STARTERS_RE: RE_STARTERS_RE,
    BACKSLASH_ESCAPE: BACKSLASH_ESCAPE,
    APOS_STRING_MODE: APOS_STRING_MODE,
    QUOTE_STRING_MODE: QUOTE_STRING_MODE,
    PHRASAL_WORDS_MODE: PHRASAL_WORDS_MODE,
    COMMENT: COMMENT,
    C_LINE_COMMENT_MODE: C_LINE_COMMENT_MODE,
    C_BLOCK_COMMENT_MODE: C_BLOCK_COMMENT_MODE,
    HASH_COMMENT_MODE: HASH_COMMENT_MODE,
    NUMBER_MODE: NUMBER_MODE,
    C_NUMBER_MODE: C_NUMBER_MODE,
    BINARY_NUMBER_MODE: BINARY_NUMBER_MODE,
    CSS_NUMBER_MODE: CSS_NUMBER_MODE,
    REGEXP_MODE: REGEXP_MODE,
    TITLE_MODE: TITLE_MODE,
    UNDERSCORE_TITLE_MODE: UNDERSCORE_TITLE_MODE,
    METHOD_GUARD: METHOD_GUARD
  });

  // keywords that should have no default relevance value
  var COMMON_KEYWORDS = 'of and for in not or if then'.split(' ');

  // compilation

  function compileLanguage(language) {

    function langRe(value, global) {
      return new RegExp(
        source(value),
        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
      );
    }

    /**
      Stores multiple regular expressions and allows you to quickly search for
      them all in a string simultaneously - returning the first match.  It does
      this by creating a huge (a|b|c) regex - each individual item wrapped with ()
      and joined by `|` - using match groups to track position.  When a match is
      found checking which position in the array has content allows us to figure
      out which of the original regexes / match groups triggered the match.

      The match object itself (the result of `Regex.exec`) is returned but also
      enhanced by merging in any meta-data that was registered with the regex.
      This is how we keep track of which mode matched, and what type of rule
      (`illegal`, `begin`, end, etc).
    */
    class MultiRegex {
      constructor() {
        this.matchIndexes = {};
        this.regexes = [];
        this.matchAt = 1;
        this.position = 0;
      }

      addRule(re, opts) {
        opts.position = this.position++;
        this.matchIndexes[this.matchAt] = opts;
        this.regexes.push([opts, re]);
        this.matchAt += countMatchGroups(re) + 1;
      }

      compile() {
        if (this.regexes.length === 0) {
          // avoids the need to check length every time exec is called
          this.exec = () => null;
        }
        const terminators = this.regexes.map(el => el[1]);
        this.matcherRe = langRe(join(terminators, '|'), true);
        this.lastIndex = 0;
      }

      exec(s) {
        this.matcherRe.lastIndex = this.lastIndex;
        const match = this.matcherRe.exec(s);
        if (!match) { return null; }

        // eslint-disable-next-line no-undefined
        const i = match.findIndex((el, i) => i > 0 && el !== undefined);
        const matchData = this.matchIndexes[i];

        return Object.assign(match, matchData);
      }
    }

    /*
      Created to solve the key deficiently with MultiRegex - there is no way to
      test for multiple matches at a single location.  Why would we need to do
      that?  In the future a more dynamic engine will allow certain matches to be
      ignored.  An example: if we matched say the 3rd regex in a large group but
      decided to ignore it - we'd need to started testing again at the 4th
      regex... but MultiRegex itself gives us no real way to do that.

      So what this class creates MultiRegexs on the fly for whatever search
      position they are needed.

      NOTE: These additional MultiRegex objects are created dynamically.  For most
      grammars most of the time we will never actually need anything more than the
      first MultiRegex - so this shouldn't have too much overhead.

      Say this is our search group, and we match regex3, but wish to ignore it.

        regex1 | regex2 | regex3 | regex4 | regex5    ' ie, startAt = 0

      What we need is a new MultiRegex that only includes the remaining
      possibilities:

        regex4 | regex5                               ' ie, startAt = 3

      This class wraps all that complexity up in a simple API... `startAt` decides
      where in the array of expressions to start doing the matching. It
      auto-increments, so if a match is found at position 2, then startAt will be
      set to 3.  If the end is reached startAt will return to 0.

      MOST of the time the parser will be setting startAt manually to 0.
    */
    class ResumableMultiRegex {
      constructor() {
        this.rules = [];
        this.multiRegexes = [];
        this.count = 0;

        this.lastIndex = 0;
        this.regexIndex = 0;
      }

      getMatcher(index) {
        if (this.multiRegexes[index]) return this.multiRegexes[index];

        const matcher = new MultiRegex();
        this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
        matcher.compile();
        this.multiRegexes[index] = matcher;
        return matcher;
      }

      considerAll() {
        this.regexIndex = 0;
      }

      addRule(re, opts) {
        this.rules.push([re, opts]);
        if (opts.type === "begin") this.count++;
      }

      exec(s) {
        const m = this.getMatcher(this.regexIndex);
        m.lastIndex = this.lastIndex;
        const result = m.exec(s);
        if (result) {
          this.regexIndex += result.position + 1;
          if (this.regexIndex === this.count) { // wrap-around
            this.regexIndex = 0;
          }
        }

        // this.regexIndex = 0;
        return result;
      }
    }

    function buildModeRegex(mode) {
      const mm = new ResumableMultiRegex();

      mode.contains.forEach(term => mm.addRule(term.begin, { rule: term, type: "begin" }));

      if (mode.terminator_end) {
        mm.addRule(mode.terminator_end, { type: "end" });
      }
      if (mode.illegal) {
        mm.addRule(mode.illegal, { type: "illegal" });
      }

      return mm;
    }

    // TODO: We need negative look-behind support to do this properly
    function skipIfhasPrecedingOrTrailingDot(match) {
      const before = match.input[match.index - 1];
      const after = match.input[match.index + match[0].length];
      if (before === "." || after === ".") {
        return { ignoreMatch: true };
      }
    }

    /** skip vs abort vs ignore
     *
     * @skip   - The mode is still entered and exited normally (and contains rules apply),
     *           but all content is held and added to the parent buffer rather than being
     *           output when the mode ends.  Mostly used with `sublanguage` to build up
     *           a single large buffer than can be parsed by sublanguage.
     *
     *             - The mode begin ands ends normally.
     *             - Content matched is added to the parent mode buffer.
     *             - The parser cursor is moved forward normally.
     *
     * @abort  - A hack placeholder until we have ignore.  Aborts the mode (as if it
     *           never matched) but DOES NOT continue to match subsequent `contains`
     *           modes.  Abort is bad/suboptimal because it can result in modes
     *           farther down not getting applied because an earlier rule eats the
     *           content but then aborts.
     *
     *             - The mode does not begin.
     *             - Content matched by `begin` is added to the mode buffer.
     *             - The parser cursor is moved forward accordingly.
     *
     * @ignore - Ignores the mode (as if it never matched) and continues to match any
     *           subsequent `contains` modes.  Ignore isn't technically possible with
     *           the current parser implementation.
     *
     *             - The mode does not begin.
     *             - Content matched by `begin` is ignored.
     *             - The parser cursor is not moved forward.
     */

    function compileMode(mode, parent) {
      if (mode.compiled) return;
      mode.compiled = true;

      // __onBegin is considered private API, internal use only
      mode.__onBegin = null;

      mode.keywords = mode.keywords || mode.beginKeywords;
      if (mode.keywords) {
        mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
      }

      mode.lexemesRe = langRe(mode.lexemes || /\w+/, true);

      if (parent) {
        if (mode.beginKeywords) {
          // for languages with keywords that include non-word characters checking for
          // a word boundary is not sufficient, so instead we check for a word boundary
          // or whitespace - this does no harm in any case since our keyword engine
          // doesn't allow spaces in keywords anyways and we still check for the boundary
          // first
          mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')(?=\\b|\\s)';
          mode.__onBegin = skipIfhasPrecedingOrTrailingDot;
        }
        if (!mode.begin)
          mode.begin = /\B|\b/;
        mode.beginRe = langRe(mode.begin);
        if (mode.endSameAsBegin)
          mode.end = mode.begin;
        if (!mode.end && !mode.endsWithParent)
          mode.end = /\B|\b/;
        if (mode.end)
          mode.endRe = langRe(mode.end);
        mode.terminator_end = source(mode.end) || '';
        if (mode.endsWithParent && parent.terminator_end)
          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
      }
      if (mode.illegal)
        mode.illegalRe = langRe(mode.illegal);
      if (mode.relevance == null)
        mode.relevance = 1;
      if (!mode.contains) {
        mode.contains = [];
      }
      mode.contains = [].concat(...mode.contains.map(function(c) {
        return expand_or_clone_mode(c === 'self' ? mode : c);
      }));
      mode.contains.forEach(function(c) { compileMode(c, mode); });

      if (mode.starts) {
        compileMode(mode.starts, parent);
      }

      mode.matcher = buildModeRegex(mode);
    }

    // self is not valid at the top-level
    if (language.contains && language.contains.includes('self')) {
      throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
    }
    compileMode(language);
  }

  function dependencyOnParent(mode) {
    if (!mode) return false;

    return mode.endsWithParent || dependencyOnParent(mode.starts);
  }

  function expand_or_clone_mode(mode) {
    if (mode.variants && !mode.cached_variants) {
      mode.cached_variants = mode.variants.map(function(variant) {
        return inherit(mode, { variants: null }, variant);
      });
    }

    // EXPAND
    // if we have variants then essentially "replace" the mode with the variants
    // this happens in compileMode, where this function is called from
    if (mode.cached_variants) {
      return mode.cached_variants;
    }

    // CLONE
    // if we have dependencies on parents then we need a unique
    // instance of ourselves, so we can be reused with many
    // different parents without issue
    if (dependencyOnParent(mode)) {
      return inherit(mode, { starts: mode.starts ? inherit(mode.starts) : null });
    }

    if (Object.isFrozen(mode)) {
      return inherit(mode);
    }

    // no special dependency issues, just return ourselves
    return mode;
  }

  // keywords

  function compileKeywords(rawKeywords, case_insensitive) {
    var compiled_keywords = {};

    if (typeof rawKeywords === 'string') { // string
      splitAndCompile('keyword', rawKeywords);
    } else {
      Object.keys(rawKeywords).forEach(function(className) {
        splitAndCompile(className, rawKeywords[className]);
      });
    }
    return compiled_keywords;

    // ---

    function splitAndCompile(className, str) {
      if (case_insensitive) {
        str = str.toLowerCase();
      }
      str.split(' ').forEach(function(keyword) {
        var pair = keyword.split('|');
        compiled_keywords[pair[0]] = [className, scoreForKeyword(pair[0], pair[1])];
      });
    }
  }

  function scoreForKeyword(keyword, providedScore) {
    // manual scores always win over common keywords
    // so you can force a score of 1 if you really insist
    if (providedScore) {
      return Number(providedScore);
    }

    return commonKeyword(keyword) ? 0 : 1;
  }

  function commonKeyword(word) {
    return COMMON_KEYWORDS.includes(word.toLowerCase());
  }

  var version = "10.0.0";

  /*
  Syntax highlighting with language autodetection.
  https://highlightjs.org/
  */

  const escape$1 = escapeHTML;
  const inherit$1 = inherit;

  const { nodeStream: nodeStream$1, mergeStreams: mergeStreams$1 } = utils;
  const NO_MATCH = Symbol("nomatch");

  const HLJS = function(hljs) {
    // Convenience variables for build-in objects
    var ArrayProto = [];

    // Global internal variables used within the highlight.js library.
    var languages = {};
    var aliases = {};
    var plugins = [];

    // safe/production mode - swallows more errors, tries to keep running
    // even if a single syntax or parse hits a fatal error
    var SAFE_MODE = true;

    // Regular expressions used throughout the highlight.js library.
    var fixMarkupRe = /((^(<[^>]+>|\t|)+|(?:\n)))/gm;

    var LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";

    // Global options used when within external APIs. This is modified when
    // calling the `hljs.configure` function.
    var options = {
      noHighlightRe: /^(no-?highlight)$/i,
      languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
      classPrefix: 'hljs-',
      tabReplace: null,
      useBR: false,
      languages: null,
      // beta configuration options, subject to change, welcome to discuss
      // https://github.com/highlightjs/highlight.js/issues/1086
      __emitter: TokenTreeEmitter
    };

    /* Utility functions */

    function shouldNotHighlight(language) {
      return options.noHighlightRe.test(language);
    }

    function blockLanguage(block) {
      var classes = block.className + ' ';

      classes += block.parentNode ? block.parentNode.className : '';

      // language-* takes precedence over non-prefixed class names.
      const match = options.languageDetectRe.exec(classes);
      if (match) {
        var language = getLanguage(match[1]);
        if (!language) {
          console.warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
          console.warn("Falling back to no-highlight mode for this block.", block);
        }
        return language ? match[1] : 'no-highlight';
      }

      return classes
        .split(/\s+/)
        .find((_class) => shouldNotHighlight(_class) || getLanguage(_class));
    }

    /**
     * Core highlighting function.
     *
     * @param {string} languageName - the language to use for highlighting
     * @param {string} code - the code to highlight
     * @param {boolean} ignoreIllegals - whether to ignore illegal matches, default is to bail
     * @param {array<mode>} continuation - array of continuation modes
     *
     * @returns an object that represents the result
     * @property {string} language - the language name
     * @property {number} relevance - the relevance score
     * @property {string} value - the highlighted HTML code
     * @property {string} code - the original raw code
     * @property {mode} top - top of the current mode stack
     * @property {boolean} illegal - indicates whether any illegal matches were found
    */
    function highlight(languageName, code, ignoreIllegals, continuation) {
      var context = {
        code,
        language: languageName
      };
      // the plugin can change the desired language or the code to be highlighted
      // just be changing the object it was passed
      fire("before:highlight", context);

      // a before plugin can usurp the result completely by providing it's own
      // in which case we don't even need to call highlight
      var result = context.result ?
        context.result :
        _highlight(context.language, context.code, ignoreIllegals, continuation);

      result.code = context.code;
      // the plugin can change anything in result to suite it
      fire("after:highlight", result);

      return result;
    }

    // private highlight that's used internally and does not fire callbacks
    function _highlight(languageName, code, ignoreIllegals, continuation) {
      var codeToHighlight = code;

      function endOfMode(mode, lexeme) {
        if (startsWith(mode.endRe, lexeme)) {
          while (mode.endsParent && mode.parent) {
            mode = mode.parent;
          }
          return mode;
        }
        if (mode.endsWithParent) {
          return endOfMode(mode.parent, lexeme);
        }
      }

      function keywordData(mode, match) {
        var matchText = language.case_insensitive ? match[0].toLowerCase() : match[0];
        return Object.prototype.hasOwnProperty.call(mode.keywords, matchText) && mode.keywords[matchText];
      }

      function processKeywords() {
        if (!top.keywords) {
          emitter.addText(mode_buffer);
          return;
        }

        let last_index = 0;
        top.lexemesRe.lastIndex = 0;
        let match = top.lexemesRe.exec(mode_buffer);
        let buf = "";

        while (match) {
          buf += mode_buffer.substring(last_index, match.index);
          const data = keywordData(top, match);
          if (data) {
            const [kind, keywordRelevance] = data;
            emitter.addText(buf);
            buf = "";

            relevance += keywordRelevance;
            emitter.addKeyword(match[0], kind);
          } else {
            buf += match[0];
          }
          last_index = top.lexemesRe.lastIndex;
          match = top.lexemesRe.exec(mode_buffer);
        }
        buf += mode_buffer.substr(last_index);
        emitter.addText(buf);
      }

      function processSubLanguage() {
        if (mode_buffer === "") return;

        var explicit = typeof top.subLanguage === 'string';

        if (explicit && !languages[top.subLanguage]) {
          emitter.addText(mode_buffer);
          return;
        }

        var result = explicit ?
          _highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
          highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : null);

        // Counting embedded language score towards the host language may be disabled
        // with zeroing the containing mode relevance. Use case in point is Markdown that
        // allows XML everywhere and makes every XML snippet to have a much larger Markdown
        // score.
        if (top.relevance > 0) {
          relevance += result.relevance;
        }
        if (explicit) {
          continuations[top.subLanguage] = result.top;
        }
        emitter.addSublanguage(result.emitter, result.language);
      }

      function processBuffer() {
        if (top.subLanguage != null) {
          processSubLanguage();
        } else {
          processKeywords();
        }
        mode_buffer = '';
      }

      function startNewMode(mode) {
        if (mode.className) {
          emitter.openNode(mode.className);
        }
        top = Object.create(mode, { parent: { value: top } });
      }

      function doIgnore(lexeme) {
        if (top.matcher.regexIndex === 0) {
          // no more regexs to potentially match here, so we move the cursor forward one
          // space
          mode_buffer += lexeme[0];
          return 1;
        } else {
          // no need to move the cursor, we still have additional regexes to try and
          // match at this very spot
          continueScanAtSamePosition = true;
          return 0;
        }
      }

      function doBeginMatch(match) {
        var lexeme = match[0];
        var new_mode = match.rule;

        if (new_mode.__onBegin) {
          const res = new_mode.__onBegin(match) || {};
          if (res.ignoreMatch) {
            return doIgnore(lexeme);
          }
        }

        if (new_mode && new_mode.endSameAsBegin) {
          new_mode.endRe = escape(lexeme);
        }

        if (new_mode.skip) {
          mode_buffer += lexeme;
        } else {
          if (new_mode.excludeBegin) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (!new_mode.returnBegin && !new_mode.excludeBegin) {
            mode_buffer = lexeme;
          }
        }
        startNewMode(new_mode);
        return new_mode.returnBegin ? 0 : lexeme.length;
      }

      function doEndMatch(match) {
        var lexeme = match[0];
        var matchPlusRemainder = codeToHighlight.substr(match.index);
        var end_mode = endOfMode(top, matchPlusRemainder);
        if (!end_mode) { return NO_MATCH; }

        var origin = top;
        if (origin.skip) {
          mode_buffer += lexeme;
        } else {
          if (!(origin.returnEnd || origin.excludeEnd)) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (origin.excludeEnd) {
            mode_buffer = lexeme;
          }
        }
        do {
          if (top.className) {
            emitter.closeNode();
          }
          if (!top.skip && !top.subLanguage) {
            relevance += top.relevance;
          }
          top = top.parent;
        } while (top !== end_mode.parent);
        if (end_mode.starts) {
          if (end_mode.endSameAsBegin) {
            end_mode.starts.endRe = end_mode.endRe;
          }
          startNewMode(end_mode.starts);
        }
        return origin.returnEnd ? 0 : lexeme.length;
      }

      function processContinuations() {
        var list = [];
        for (var current = top; current !== language; current = current.parent) {
          if (current.className) {
            list.unshift(current.className);
          }
        }
        list.forEach(item => emitter.openNode(item));
      }

      var lastMatch = {};
      function processLexeme(textBeforeMatch, match) {
        var lexeme = match && match[0];

        // add non-matched text to the current mode buffer
        mode_buffer += textBeforeMatch;

        if (lexeme == null) {
          processBuffer();
          return 0;
        }

        // we've found a 0 width match and we're stuck, so we need to advance
        // this happens when we have badly behaved rules that have optional matchers to the degree that
        // sometimes they can end up matching nothing at all
        // Ref: https://github.com/highlightjs/highlight.js/issues/2140
        if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
          // spit the "skipped" character that our regex choked on back into the output sequence
          mode_buffer += codeToHighlight.slice(match.index, match.index + 1);
          if (!SAFE_MODE) {
            const err = new Error('0 width match regex');
            err.languageName = languageName;
            err.badRule = lastMatch.rule;
            throw err;
          }
          return 1;
        }
        lastMatch = match;

        if (match.type === "begin") {
          return doBeginMatch(match);
        } else if (match.type === "illegal" && !ignoreIllegals) {
          // illegal match, we do not continue processing
          const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');
          err.mode = top;
          throw err;
        } else if (match.type === "end") {
          var processed = doEndMatch(match);
          if (processed !== NO_MATCH) {
            return processed;
          }
        }

        /*
        Why might be find ourselves here?  Only one occasion now.  An end match that was
        triggered but could not be completed.  When might this happen?  When an `endSameasBegin`
        rule sets the end rule to a specific match.  Since the overall mode termination rule that's
        being used to scan the text isn't recompiled that means that any match that LOOKS like
        the end (but is not, because it is not an exact match to the beginning) will
        end up here.  A definite end match, but when `doEndMatch` tries to "reapply"
        the end rule and fails to match, we wind up here, and just silently ignore the end.

        This causes no real harm other than stopping a few times too many.
        */

        mode_buffer += lexeme;
        return lexeme.length;
      }

      var language = getLanguage(languageName);
      if (!language) {
        console.error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
        throw new Error('Unknown language: "' + languageName + '"');
      }

      compileLanguage(language);
      var result = '';
      var top = continuation || language;
      var continuations = {}; // keep continuations for sub-languages
      var emitter = new options.__emitter(options);
      processContinuations();
      var mode_buffer = '';
      var relevance = 0;
      var index = 0;
      var continueScanAtSamePosition = false;

      try {
        top.matcher.considerAll();

        for (;;) {
          if (continueScanAtSamePosition) {
            continueScanAtSamePosition = false;
            // only regexes not matched previously will now be
            // considered for a potential match
          } else {
            top.matcher.lastIndex = index;
            top.matcher.considerAll();
          }
          const match = top.matcher.exec(codeToHighlight);
          // console.log("match", match[0], match.rule && match.rule.begin)
          if (!match) break;

          const beforeMatch = codeToHighlight.substring(index, match.index);
          const processedCount = processLexeme(beforeMatch, match);
          index = match.index + processedCount;
        }
        processLexeme(codeToHighlight.substr(index));
        emitter.closeAllNodes();
        emitter.finalize();
        result = emitter.toHTML();

        return {
          relevance: relevance,
          value: result,
          language: languageName,
          illegal: false,
          emitter: emitter,
          top: top
        };
      } catch (err) {
        if (err.message && err.message.includes('Illegal')) {
          return {
            illegal: true,
            illegalBy: {
              msg: err.message,
              context: codeToHighlight.slice(index - 100, index + 100),
              mode: err.mode
            },
            sofar: result,
            relevance: 0,
            value: escape$1(codeToHighlight),
            emitter: emitter
          };
        } else if (SAFE_MODE) {
          return {
            relevance: 0,
            value: escape$1(codeToHighlight),
            emitter: emitter,
            language: languageName,
            top: top,
            errorRaised: err
          };
        } else {
          throw err;
        }
      }
    }

    // returns a valid highlight result, without actually
    // doing any actual work, auto highlight starts with
    // this and it's possible for small snippets that
    // auto-detection may not find a better match
    function justTextHighlightResult(code) {
      const result = {
        relevance: 0,
        emitter: new options.__emitter(options),
        value: escape$1(code),
        illegal: false,
        top: PLAINTEXT_LANGUAGE
      };
      result.emitter.addText(code);
      return result;
    }

    /*
    Highlighting with language detection. Accepts a string with the code to
    highlight. Returns an object with the following properties:

    - language (detected language)
    - relevance (int)
    - value (an HTML string with highlighting markup)
    - second_best (object with the same structure for second-best heuristically
      detected language, may be absent)

    */
    function highlightAuto(code, languageSubset) {
      languageSubset = languageSubset || options.languages || Object.keys(languages);
      var result = justTextHighlightResult(code);
      var secondBest = result;
      languageSubset.filter(getLanguage).filter(autoDetection).forEach(function(name) {
        var current = _highlight(name, code, false);
        current.language = name;
        if (current.relevance > secondBest.relevance) {
          secondBest = current;
        }
        if (current.relevance > result.relevance) {
          secondBest = result;
          result = current;
        }
      });
      if (secondBest.language) {
        // second_best (with underscore) is the expected API
        result.second_best = secondBest;
      }
      return result;
    }

    /*
    Post-processing of the highlighted markup:

    - replace TABs with something more useful
    - replace real line-breaks with '<br>' for non-pre containers

    */
    function fixMarkup(value) {
      if (!(options.tabReplace || options.useBR)) {
        return value;
      }

      return value.replace(fixMarkupRe, function(match, p1) {
        if (options.useBR && match === '\n') {
          return '<br>';
        } else if (options.tabReplace) {
          return p1.replace(/\t/g, options.tabReplace);
        }
        return '';
      });
    }

    function buildClassName(prevClassName, currentLang, resultLang) {
      var language = currentLang ? aliases[currentLang] : resultLang;
      var result = [prevClassName.trim()];

      if (!prevClassName.match(/\bhljs\b/)) {
        result.push('hljs');
      }

      if (!prevClassName.includes(language)) {
        result.push(language);
      }

      return result.join(' ').trim();
    }

    /*
    Applies highlighting to a DOM node containing code. Accepts a DOM node and
    two optional parameters for fixMarkup.
    */
    function highlightBlock(block) {
      let node = null;
      const language = blockLanguage(block);

      if (shouldNotHighlight(language)) return;

      fire("before:highlightBlock",
        { block: block, language: language });

      if (options.useBR) {
        node = document.createElement('div');
        node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ /]*>/g, '\n');
      } else {
        node = block;
      }
      const text = node.textContent;
      const result = language ? highlight(language, text, true) : highlightAuto(text);

      const originalStream = nodeStream$1(node);
      if (originalStream.length) {
        const resultNode = document.createElement('div');
        resultNode.innerHTML = result.value;
        result.value = mergeStreams$1(originalStream, nodeStream$1(resultNode), text);
      }
      result.value = fixMarkup(result.value);

      fire("after:highlightBlock", { block: block, result: result });

      block.innerHTML = result.value;
      block.className = buildClassName(block.className, language, result.language);
      block.result = {
        language: result.language,
        re: result.relevance
      };
      if (result.second_best) {
        block.second_best = {
          language: result.second_best.language,
          re: result.second_best.relevance
        };
      }
    }

    /*
    Updates highlight.js global options with values passed in the form of an object.
    */
    function configure(userOptions) {
      options = inherit$1(options, userOptions);
    }

    /*
    Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
    */
    function initHighlighting() {
      if (initHighlighting.called) return;
      initHighlighting.called = true;

      var blocks = document.querySelectorAll('pre code');
      ArrayProto.forEach.call(blocks, highlightBlock);
    }

    /*
    Attaches highlighting to the page load event.
    */
    function initHighlightingOnLoad() {
      window.addEventListener('DOMContentLoaded', initHighlighting, false);
    }

    const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: 'Plain text' };

    function registerLanguage(name, language) {
      var lang = null;
      try {
        lang = language(hljs);
      } catch (error) {
        console.error("Language definition for '{}' could not be registered.".replace("{}", name));
        // hard or soft error
        if (!SAFE_MODE) { throw error; } else { console.error(error); }
        // languages that have serious errors are replaced with essentially a
        // "plaintext" stand-in so that the code blocks will still get normal
        // css classes applied to them - and one bad language won't break the
        // entire highlighter
        lang = PLAINTEXT_LANGUAGE;
      }
      // give it a temporary name if it doesn't have one in the meta-data
      if (!lang.name) lang.name = name;
      languages[name] = lang;
      lang.rawDefinition = language.bind(null, hljs);

      if (lang.aliases) {
        lang.aliases.forEach(function(alias) { aliases[alias] = name; });
      }
    }

    function listLanguages() {
      return Object.keys(languages);
    }

    /*
      intended usage: When one language truly requires another

      Unlike `getLanguage`, this will throw when the requested language
      is not available.
    */
    function requireLanguage(name) {
      var lang = getLanguage(name);
      if (lang) { return lang; }

      var err = new Error('The \'{}\' language is required, but not loaded.'.replace('{}', name));
      throw err;
    }

    function getLanguage(name) {
      name = (name || '').toLowerCase();
      return languages[name] || languages[aliases[name]];
    }

    function autoDetection(name) {
      var lang = getLanguage(name);
      return lang && !lang.disableAutodetect;
    }

    function addPlugin(plugin) {
      plugins.push(plugin);
    }

    function fire(event, args) {
      var cb = event;
      plugins.forEach(function(plugin) {
        if (plugin[cb]) {
          plugin[cb](args);
        }
      });
    }

    /* Interface definition */

    Object.assign(hljs, {
      highlight,
      highlightAuto,
      fixMarkup,
      highlightBlock,
      configure,
      initHighlighting,
      initHighlightingOnLoad,
      registerLanguage,
      listLanguages,
      getLanguage,
      requireLanguage,
      autoDetection,
      inherit: inherit$1,
      addPlugin
    });

    hljs.debugMode = function() { SAFE_MODE = false; };
    hljs.safeMode = function() { SAFE_MODE = true; };
    hljs.versionString = version;

    for (const key in MODES) {
      if (typeof MODES[key] === "object") {
        deepFreeze(MODES[key]);
      }
    }

    // merge all the modes/regexs into our main object
    Object.assign(hljs, MODES);

    return hljs;
  };

  // export an "instance" of the highlighter
  var highlight = HLJS({});

  return highlight;

})));

hljs.registerLanguage('nix', function () {
  'use strict';

  /*
  Language: Nix
  Author: Domen Kožar <domen@dev.si>
  Description: Nix functional language
  Website: http://nixos.org/nix
  */


  function nix(hljs) {
    var NIX_KEYWORDS = {
      keyword:
        'rec with let in inherit assert if else then',
      literal:
        'true false or and null',
      built_in:
        'import abort baseNameOf dirOf isNull builtins map removeAttrs throw ' +
        'toString derivation'
    };
    var ANTIQUOTE = {
      className: 'subst',
      begin: /\$\{/,
      end: /}/,
      keywords: NIX_KEYWORDS
    };
    var ATTRS = {
      begin: /[a-zA-Z0-9-_]+(\s*=)/, returnBegin: true,
      relevance: 0,
      contains: [
        {
          className: 'attr',
          begin: /\S+/
        }
      ]
    };
    var STRING = {
      className: 'string',
      contains: [ANTIQUOTE],
      variants: [
        {begin: "''", end: "''"},
        {begin: '"', end: '"'}
      ]
    };
    var EXPRESSIONS = [
      hljs.NUMBER_MODE,
      hljs.HASH_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING,
      ATTRS
    ];
    ANTIQUOTE.contains = EXPRESSIONS;
    return {
      name: 'Nix',
      aliases: ["nixos"],
      keywords: NIX_KEYWORDS,
      contains: EXPRESSIONS
    };
  }

  return nix;

  return module.exports.definer || module.exports;

}());

hljs.registerLanguage('haskell', function () {
  'use strict';

  /*
  Language: Haskell
  Author: Jeremy Hull <sourdrums@gmail.com>
  Contributors: Zena Treep <zena.treep@gmail.com>
  Website: https://www.haskell.org
  Category: functional
  */

  function haskell(hljs) {
    var COMMENT = {
      variants: [
        hljs.COMMENT('--', '$'),
        hljs.COMMENT(
          '{-',
          '-}',
          {
            contains: ['self']
          }
        )
      ]
    };

    var PRAGMA = {
      className: 'meta',
      begin: '{-#', end: '#-}'
    };

    var PREPROCESSOR = {
      className: 'meta',
      begin: '^#', end: '$'
    };

    var CONSTRUCTOR = {
      className: 'type',
      begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (build-in, infix).
      relevance: 0
    };

    var LIST = {
      begin: '\\(', end: '\\)',
      illegal: '"',
      contains: [
        PRAGMA,
        PREPROCESSOR,
        {className: 'type', begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'},
        hljs.inherit(hljs.TITLE_MODE, {begin: '[_a-z][\\w\']*'}),
        COMMENT
      ]
    };

    var RECORD = {
      begin: '{', end: '}',
      contains: LIST.contains
    };

    return {
      name: 'Haskell',
      aliases: ['hs'],
      keywords:
        'let in if then else case of where do module import hiding ' +
        'qualified type data newtype deriving class instance as default ' +
        'infix infixl infixr foreign export ccall stdcall cplusplus ' +
        'jvm dotnet safe unsafe family forall mdo proc rec',
      contains: [

        // Top-level constructions.

        {
          beginKeywords: 'module', end: 'where',
          keywords: 'module where',
          contains: [LIST, COMMENT],
          illegal: '\\W\\.|;'
        },
        {
          begin: '\\bimport\\b', end: '$',
          keywords: 'import qualified as hiding',
          contains: [LIST, COMMENT],
          illegal: '\\W\\.|;'
        },

        {
          className: 'class',
          begin: '^(\\s*)?(class|instance)\\b', end: 'where',
          keywords: 'class family instance where',
          contains: [CONSTRUCTOR, LIST, COMMENT]
        },
        {
          className: 'class',
          begin: '\\b(data|(new)?type)\\b', end: '$',
          keywords: 'data family type newtype deriving',
          contains: [PRAGMA, CONSTRUCTOR, LIST, RECORD, COMMENT]
        },
        {
          beginKeywords: 'default', end: '$',
          contains: [CONSTRUCTOR, LIST, COMMENT]
        },
        {
          beginKeywords: 'infix infixl infixr', end: '$',
          contains: [hljs.C_NUMBER_MODE, COMMENT]
        },
        {
          begin: '\\bforeign\\b', end: '$',
          keywords: 'foreign import export ccall stdcall cplusplus jvm ' +
                    'dotnet safe unsafe',
          contains: [CONSTRUCTOR, hljs.QUOTE_STRING_MODE, COMMENT]
        },
        {
          className: 'meta',
          begin: '#!\\/usr\\/bin\\/env\ runhaskell', end: '$'
        },

        // "Whitespaces".

        PRAGMA,
        PREPROCESSOR,

        // Literals and names.

        // TODO: characters.
        hljs.QUOTE_STRING_MODE,
        hljs.C_NUMBER_MODE,
        CONSTRUCTOR,
        hljs.inherit(hljs.TITLE_MODE, {begin: '^[_a-z][\\w\']*'}),

        COMMENT,

        {begin: '->|<-'} // No markup, relevance booster
      ]
    };
  }

  return haskell;

  return module.exports.definer || module.exports;

}());

hljs.registerLanguage('makefile', function () {
  'use strict';

  /*
  Language: Makefile
  Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
  Contributors: Joël Porquet <joel@porquet.org>
  Website: https://www.gnu.org/software/make/manual/html_node/Introduction.html
  Category: common
  */

  function makefile(hljs) {
    /* Variables: simple (eg $(var)) and special (eg $@) */
    var VARIABLE = {
      className: 'variable',
      variants: [
        {
          begin: '\\$\\(' + hljs.UNDERSCORE_IDENT_RE + '\\)',
          contains: [hljs.BACKSLASH_ESCAPE],
        },
        {
          begin: /\$[@%<?\^\+\*]/
        },
      ]
    };
    /* Quoted string with variables inside */
    var QUOTE_STRING = {
      className: 'string',
      begin: /"/, end: /"/,
      contains: [
        hljs.BACKSLASH_ESCAPE,
        VARIABLE,
      ]
    };
    /* Function: $(func arg,...) */
    var FUNC = {
      className: 'variable',
      begin: /\$\([\w-]+\s/, end: /\)/,
      keywords: {
        built_in:
          'subst patsubst strip findstring filter filter-out sort ' +
          'word wordlist firstword lastword dir notdir suffix basename ' +
          'addsuffix addprefix join wildcard realpath abspath error warning ' +
          'shell origin flavor foreach if or and call eval file value',
      },
      contains: [
        VARIABLE,
      ]
    };
    /* Variable assignment */
    var ASSIGNMENT = {
      begin: '^' + hljs.UNDERSCORE_IDENT_RE + '\\s*(?=[:+?]?=)'
    };
    /* Meta targets (.PHONY) */
    var META = {
      className: 'meta',
      begin: /^\.PHONY:/, end: /$/,
      keywords: {'meta-keyword': '.PHONY'},
      lexemes: /[\.\w]+/
    };
    /* Targets */
    var TARGET = {
      className: 'section',
      begin: /^[^\s]+:/, end: /$/,
      contains: [VARIABLE,]
    };
    return {
      name: 'Makefile',
      aliases: ['mk', 'mak'],
      keywords:
        'define endef undefine ifdef ifndef ifeq ifneq else endif ' +
        'include -include sinclude override export unexport private vpath',
      lexemes: /[\w-]+/,
      contains: [
        hljs.HASH_COMMENT_MODE,
        VARIABLE,
        QUOTE_STRING,
        FUNC,
        ASSIGNMENT,
        META,
        TARGET,
      ]
    };
  }

  return makefile;

  return module.exports.definer || module.exports;

}());

hljs.registerLanguage('bash', function () {
  'use strict';

  /*
  Language: Bash
  Author: vah <vahtenberg@gmail.com>
  Contributrors: Benjamin Pannell <contact@sierrasoftworks.com>
  Website: https://www.gnu.org/software/bash/
  Category: common
  */

  function bash(hljs) {
    const VAR = {};
    const BRACED_VAR = {
      begin: /\$\{/, end:/\}/,
      contains: [
        { begin: /:-/, contains: [VAR] } // default values
      ]
    };
    Object.assign(VAR,{
      className: 'variable',
      variants: [
        {begin: /\$[\w\d#@][\w\d_]*/},
        BRACED_VAR
      ]
    });

    const SUBST = {
      className: 'subst',
      begin: /\$\(/, end: /\)/,
      contains: [hljs.BACKSLASH_ESCAPE]
    };
    const QUOTE_STRING = {
      className: 'string',
      begin: /"/, end: /"/,
      contains: [
        hljs.BACKSLASH_ESCAPE,
        VAR,
        SUBST
      ]
    };
    SUBST.contains.push(QUOTE_STRING);
    const ESCAPED_QUOTE = {
      className: '',
      begin: /\\"/

    };
    const APOS_STRING = {
      className: 'string',
      begin: /'/, end: /'/
    };
    const ARITHMETIC = {
      begin: /\$\(\(/,
      end: /\)\)/,
      contains: [
        { begin: /\d+#[0-9a-f]+/, className: "number" },
        hljs.NUMBER_MODE,
        VAR
      ]
    };
    const SHEBANG = {
      className: 'meta',
      begin: /^#![^\n]+sh\s*$/,
      relevance: 10
    };
    const FUNCTION = {
      className: 'function',
      begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
      returnBegin: true,
      contains: [hljs.inherit(hljs.TITLE_MODE, {begin: /\w[\w\d_]*/})],
      relevance: 0
    };

    return {
      name: 'Bash',
      aliases: ['sh', 'zsh'],
      lexemes: /\b-?[a-z\._]+\b/,
      keywords: {
        keyword:
          'if then else elif fi for while in do done case esac function',
        literal:
          'true false',
        built_in:
          // Shell built-ins
          // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
          'break cd continue eval exec exit export getopts hash pwd readonly return shift test times ' +
          'trap umask unset ' +
          // Bash built-ins
          'alias bind builtin caller command declare echo enable help let local logout mapfile printf ' +
          'read readarray source type typeset ulimit unalias ' +
          // Shell modifiers
          'set shopt ' +
          // Zsh built-ins
          'autoload bg bindkey bye cap chdir clone comparguments compcall compctl compdescribe compfiles ' +
          'compgroups compquote comptags comptry compvalues dirs disable disown echotc echoti emulate ' +
          'fc fg float functions getcap getln history integer jobs kill limit log noglob popd print ' +
          'pushd pushln rehash sched setcap setopt stat suspend ttyctl unfunction unhash unlimit ' +
          'unsetopt vared wait whence where which zcompile zformat zftp zle zmodload zparseopts zprof ' +
          'zpty zregexparse zsocket zstyle ztcp',
        _:
          '-ne -eq -lt -gt -f -d -e -s -l -a' // relevance booster
      },
      contains: [
        SHEBANG,
        FUNCTION,
        ARITHMETIC,
        hljs.HASH_COMMENT_MODE,
        QUOTE_STRING,
        ESCAPED_QUOTE,
        APOS_STRING,
        VAR
      ]
    };
  }

  return bash;

  return module.exports.definer || module.exports;

}());

hljs.registerLanguage('shell', function () {
  'use strict';

  /*
  Language: Shell Session
  Requires: bash.js
  Author: TSUYUSATO Kitsune <make.just.on@gmail.com>
  Category: common
  */

  function shell(hljs) {
    return {
      name: 'Shell Session',
      aliases: ['console'],
      contains: [
        {
          className: 'meta',
          begin: '^\\s{0,3}[/\\w\\d\\[\\]()@-]*[>%$#]',
          starts: {
            end: '$', subLanguage: 'bash'
          }
        }
      ]
    }
  }

  return shell;

  return module.exports.definer || module.exports;

}());

hljs.registerLanguage('rust', function () {
  'use strict';

  /*
  Language: Rust
  Author: Andrey Vlasovskikh <andrey.vlasovskikh@gmail.com>
  Contributors: Roman Shmatov <romanshmatov@gmail.com>, Kasper Andersen <kma_untrusted@protonmail.com>
  Website: https://www.rust-lang.org
  Category: common, system
  */

  function rust(hljs) {
    var NUM_SUFFIX = '([ui](8|16|32|64|128|size)|f(32|64))\?';
    var KEYWORDS =
      'abstract as async await become box break const continue crate do dyn ' +
      'else enum extern false final fn for if impl in let loop macro match mod ' +
      'move mut override priv pub ref return self Self static struct super ' +
      'trait true try type typeof unsafe unsized use virtual where while yield';
    var BUILTINS =
      // functions
      'drop ' +
      // types
      'i8 i16 i32 i64 i128 isize ' +
      'u8 u16 u32 u64 u128 usize ' +
      'f32 f64 ' +
      'str char bool ' +
      'Box Option Result String Vec ' +
      // traits
      'Copy Send Sized Sync Drop Fn FnMut FnOnce ToOwned Clone Debug ' +
      'PartialEq PartialOrd Eq Ord AsRef AsMut Into From Default Iterator ' +
      'Extend IntoIterator DoubleEndedIterator ExactSizeIterator ' +
      'SliceConcatExt ToString ' +
      // macros
      'assert! assert_eq! bitflags! bytes! cfg! col! concat! concat_idents! ' +
      'debug_assert! debug_assert_eq! env! panic! file! format! format_args! ' +
      'include_bin! include_str! line! local_data_key! module_path! ' +
      'option_env! print! println! select! stringify! try! unimplemented! ' +
      'unreachable! vec! write! writeln! macro_rules! assert_ne! debug_assert_ne!';
    return {
      name: 'Rust',
      aliases: ['rs'],
      keywords: {
        keyword:
          KEYWORDS,
        literal:
          'true false Some None Ok Err',
        built_in:
          BUILTINS
      },
      lexemes: hljs.IDENT_RE + '!?',
      illegal: '</',
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.COMMENT('/\\*', '\\*/', {contains: ['self']}),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: /b?"/, illegal: null}),
        {
          className: 'string',
          variants: [
             { begin: /r(#*)"(.|\n)*?"\1(?!#)/ },
             { begin: /b?'\\?(x\w{2}|u\w{4}|U\w{8}|.)'/ }
          ]
        },
        {
          className: 'symbol',
          begin: /'[a-zA-Z_][a-zA-Z0-9_]*/
        },
        {
          className: 'number',
          variants: [
            { begin: '\\b0b([01_]+)' + NUM_SUFFIX },
            { begin: '\\b0o([0-7_]+)' + NUM_SUFFIX },
            { begin: '\\b0x([A-Fa-f0-9_]+)' + NUM_SUFFIX },
            { begin: '\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)' +
                     NUM_SUFFIX
            }
          ],
          relevance: 0
        },
        {
          className: 'function',
          beginKeywords: 'fn', end: '(\\(|<)', excludeEnd: true,
          contains: [hljs.UNDERSCORE_TITLE_MODE]
        },
        {
          className: 'meta',
          begin: '#\\!?\\[', end: '\\]',
          contains: [
            {
              className: 'meta-string',
              begin: /"/, end: /"/
            }
          ]
        },
        {
          className: 'class',
          beginKeywords: 'type', end: ';',
          contains: [
            hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, {endsParent: true})
          ],
          illegal: '\\S'
        },
        {
          className: 'class',
          beginKeywords: 'trait enum struct union', end: '{',
          contains: [
            hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, {endsParent: true})
          ],
          illegal: '[\\w\\d]'
        },
        {
          begin: hljs.IDENT_RE + '::',
          keywords: {built_in: BUILTINS}
        },
        {
          begin: '->'
        }
      ]
    };
  }

  return rust;

  return module.exports.definer || module.exports;

}());
