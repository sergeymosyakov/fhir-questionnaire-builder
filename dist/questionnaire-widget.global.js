var FhirQuestionnaireWidget = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // js/renderer/index.js
  var index_exports = {};
  __export(index_exports, {
    QuestionnaireRenderer: () => QuestionnaireRenderer
  });

  // js/core/events/bus.js
  var EventBus = class {
    /** @param {EventTarget} [target]  defaults to `document` in the browser, else a fresh EventTarget */
    constructor(target) {
      this._target = target || (typeof document !== "undefined" ? document : new EventTarget());
    }
    /** Dispatch a named event carrying `detail`. */
    dispatch(name, detail) {
      this._target.dispatchEvent(new CustomEvent(name, { detail }));
    }
    /** Subscribe; returns an unsubscribe function. */
    on(name, cb, opts) {
      this._target.addEventListener(name, cb, opts);
      return () => this._target.removeEventListener(name, cb, opts);
    }
    off(name, cb, opts) {
      this._target.removeEventListener(name, cb, opts);
    }
    get target() {
      return this._target;
    }
  };
  var defaultBus = new EventBus();
  function createEventState(bus, statefulEvents) {
    const cache = /* @__PURE__ */ new Map();
    for (const name of statefulEvents) {
      bus.on(name, (e) => cache.set(name, e?.detail ?? {}));
    }
    return {
      get(name) {
        return cache.get(name);
      },
      // For testing only — seed the cache without dispatching an event.
      _set(name, detail) {
        cache.set(name, detail);
      }
    };
  }

  // js/utils.js
  var ITLH_NS = "e3a8c2f1-6b4d-4e9a-87c5";
  var ITLH_KEY_GROUP_OR = ITLH_NS + ":group-or";
  function destroyTree(nodes) {
    nodes.forEach((n) => n.destroy?.());
    nodes.splice(0);
  }
  function isDescendant(nodeId, group) {
    for (const ch of group.children) {
      if (ch.id === nodeId) return true;
      if (ch.children?.length && isDescendant(nodeId, ch)) return true;
    }
    return false;
  }
  function parseOption(s) {
    const eq = s.indexOf("=");
    if (eq === -1) return { code: s, display: s };
    return { code: s.slice(0, eq).trim(), display: s.slice(eq + 1).trim() };
  }
  function parseOptions(str) {
    return (str || "").split(",").map((s) => s.trim()).filter(Boolean).map(parseOption);
  }
  function rawOptsToPairs(rawOpts) {
    return (rawOpts || []).map((o) => {
      if (o.valueCoding) {
        const code = o.valueCoding.code || o.valueCoding.display || "";
        const display = o.valueCoding.display || o.valueCoding.code || "";
        return { code, display };
      }
      if (o.valueString !== void 0) return { code: o.valueString, display: o.valueString };
      if (o.valueInteger !== void 0) return { code: String(o.valueInteger), display: String(o.valueInteger) };
      if (o.valueDate !== void 0) return { code: o.valueDate, display: o.valueDate };
      if (o.valueTime !== void 0) return { code: o.valueTime, display: o.valueTime };
      if (o.valueReference) {
        const ref = typeof o.valueReference === "string" ? o.valueReference : o.valueReference.reference || "";
        const disp = typeof o.valueReference === "object" && o.valueReference.display || ref;
        return { code: ref, display: disp };
      }
      return null;
    }).filter(Boolean);
  }
  function highlightJson(raw) {
    const esc = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g,
      (match) => {
        let cls;
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "jv-k" : "jv-s";
        } else if (match === "true" || match === "false") {
          cls = "jv-b";
        } else if (match === "null") {
          cls = "jv-null";
        } else {
          cls = "jv-n";
        }
        return '<span class="' + cls + '">' + match + "</span>";
      }
    );
  }
  function highlightJsonWithSearch(raw, query) {
    if (!query) return { html: highlightJson(raw), count: 0 };
    const lq = query.toLowerCase();
    const lr = raw.toLowerCase();
    const positions = [];
    let pos = 0;
    while ((pos = lr.indexOf(lq, pos)) !== -1) {
      positions.push(pos);
      pos += lq.length;
    }
    if (positions.length === 0) return { html: highlightJson(raw), count: 0 };
    let marked = "";
    let last = 0;
    for (const start of positions) {
      marked += raw.slice(last, start) + "" + raw.slice(start, start + lq.length) + "";
      last = start + lq.length;
    }
    marked += raw.slice(last);
    let html = highlightJson(marked);
    html = html.split("").join('<mark class="search-match">');
    html = html.split("").join("</mark>");
    return { html, count: positions.length };
  }

  // js/events.js
  var AppEvents = Object.freeze({
    // ── Questionnaire lifecycle ───────────────────────────────────────────────
    QUESTIONNAIRE_LOADED: "questionnaire-loaded",
    QUESTIONNAIRE_CLEARED: "questionnaire-cleared",
    QUESTIONNAIRE_NEW: "questionnaire-new",
    QUESTIONNAIRE_CLEAR_REQUESTED: "questionnaire-clear-requested",
    QUESTIONNAIRE_RESET: "questionnaire-reset",
    QUESTIONNAIRE_META_CHANGED: "questionnaire-meta-changed",
    // Dispatched before opening a load dialog when tree may have unsaved items.
    // detail: { resolve: (proceed: boolean) => void }
    // loadConfirmModal resolves true if proceed, false if cancel.
    QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED: "questionnaire-load-confirm-requested",
    // detail: { data: object, fileName: string }
    QUESTIONNAIRE_LOAD_REQUESTED: "questionnaire-load-requested",
    // Dispatched once at app startup to register questDoc + answerStore singletons.
    // detail: { questDoc, answerStore } — does NOT trigger UI visibility changes.
    APP_CONTEXT_READY: "app:context-ready",
    // ── Builder ───────────────────────────────────────────────────────────────
    BUILDER_RERENDER: "builder:rerender",
    BUILDER_NAVIGATE: "builder:navigate",
    BUILDER_NAVIGATE_TO: "builder:navigate-to",
    BUILDER_EXPAND_ALL: "builder:expand-all",
    BUILDER_COLLAPSE_ALL: "builder:collapse-all",
    BUILDER_VIEW_MODE_CHANGE: "builder:view-mode-change",
    // detail: { visible: boolean } — toggle id/prefix meta row on builder nodes.
    // Stateful: EventState caches the last value so late subscribers read it.
    BUILDER_META_ROW_CHANGE: "builder:meta-row-change",
    // ── Preview / form ────────────────────────────────────────────────────────
    PREVIEW_NAVIGATE_TO: "preview:navigate-to",
    REINIT_FORM: "reinit-form",
    SHOW_JSON: "show-json",
    VIEW_PREF_CHANGE: "view-pref-change",
    PREVIEW_MODE_CHANGE: "preview-mode-change",
    // Dispatched by any preview control when the user changes a response value.
    // PreviewForm listens and triggers a re-render via _asyncRender.
    RESPONSE_CHANGED: "preview:response-changed",
    PREVIEW_RENDER_DONE: "preview:render-done",
    // ── SDC server operations ─────────────────────────────────────────────────
    // detail: { patientRef: string } — e.g. 'Patient/123'
    SDC_POPULATE_REQUESTED: "sdc:populate-requested",
    DEF_EXTRACT_REQUESTED: "sdc:def-extract-requested",
    BUILDER_RENDER_DONE: "builder:render-done",
    // ── Patient / QR ─────────────────────────────────────────────────────────
    PATIENT_CTX_APPLIED: "patient-ctx-applied",
    QR_LOADED: "qr-loaded",
    // ── Cloud ──────────────────────────────────────────────────────────────────
    CLOUD_SAVE_REQUESTED: "cloud-save-requested",
    CLOUD_LOAD_REQUESTED: "cloud-load-requested",
    // ── UI utilities ───────────────────────────────────────────────────────────
    CLOSE_DROPDOWNS: "close-dropdowns",
    // ── Translation ────────────────────────────────────────────────────────────
    // detail: { lang: string } — BCP-47 code, e.g. 'es', 'fr', '' = source lang
    LANGUAGE_CHANGED: "language-changed",
    TRANSLATE_REQUESTED: "translate-requested",
    FHIRPATH_TESTER_REQUESTED: "fhirpath-tester-requested",
    // ── Builder utilities ──────────────────────────────────────────────────────
    // Dispatched by nodes/modals when they change FHIR data that requires
    // FHIRPath calc expressions to be re-evaluated.  BuilderPanel listens and
    // runs evalCalcNodes + dispatches RESPONSE_CHANGED.
    CALC_RECALC_REQUESTED: "calc-recalc-requested",
    REFRESH_EXPR_ICONS: "refresh-expr-icons",
    REFRESH_CALC_BADGES: "refresh-calc-badges",
    COLLAPSE_ALL_PREVIEW: "collapse-all-preview",
    EXPAND_ALL_PREVIEW: "expand-all-preview",
    // ── Renumber ──────────────────────────────────────────────────────────────
    // detail: { format: 'numbers'|'roman'|'letters' }
    // Dispatched by RenumberControl when the user changes the prefix format.
    // NumberingService listens and updates its internal format.
    RENUMBER_FORMAT_CHANGED: "renumber-format-changed",
    // ── Renumber progress ─────────────────────────────────────────────────────
    RENUMBER_PROGRESS: "renumber-progress",
    RENUMBER_DONE: "renumber-done",
    // ── Validators ────────────────────────────────────────────────────────────
    // detail: { id: string, enabled: boolean }
    // 'id' matches Validator#id — dispatched by UI toggles; validators listen and set this.enabled
    VALIDATOR_TOGGLE: "validator-toggle",
    // ── Tooltip & autosave settings ──────────────────────────────────────────
    // Dispatched by tooltip.init() after reading persisted state.
    TIPS_INIT_DONE: "tips-init-done",
    // Dispatched by settings-menu tips checkbox; tooltip.js listens and calls setEnabled().
    TIPS_TOGGLED: "tips-toggled",
    // Dispatched by autosave.init() after reading persisted state.
    AUTOSAVE_INIT_DONE: "autosave-init-done",
    // Dispatched by settings-menu autosave checkbox; autosave.js listens and calls setEnabled().
    AUTOSAVE_TOGGLED: "autosave-toggled",
    // Dispatched by autosave._save() each time a draft is persisted. detail: { date: Date }
    AUTOSAVE_SAVED: "autosave-saved",
    // Dispatched by settings-menu Validate button; validate-modal.js listens and shows the report.
    VALIDATE_REQUESTED: "validate-requested",
    // ── Node actions ──────────────────────────────────────────────────────────
    // Dispatched by node delete buttons; BuilderPanel listens and handles
    // confirm + findAndRemove + rerender.  detail: { id: string, label: string }
    NODE_DELETE_REQUESTED: "node:delete-requested",
    // Dispatched by node copy/paste buttons; CopyPaste listens.
    // detail: { id: string }
    NODE_COPY_REQUESTED: "node:copy-requested",
    NODE_PASTE_AFTER_REQUESTED: "node:paste-after-requested",
    NODE_PASTE_BEFORE_REQUESTED: "node:paste-before-requested",
    // Dispatched by CopyPaste after clipboard changes (copy or clear).
    // detail: { hasClip: boolean }
    CLIPBOARD_CHANGED: "node:clipboard-changed",
    // ── Node patching ─────────────────────────────────────────────────────────
    // detail: { ids: string[], patch: object, nodeType?: 'group'|'item' }
    // Dispatched by modals to copy current settings to other nodes.
    // patch values: null = delete key from node, any other value = assign to node.
    // nodeType: if set, BaseNode skips nodes whose type doesn't match (type safety).
    COPY_TO_NODES: "copy-to-nodes",
    // ── Answer store ─────────────────────────────────────────────────────────
    // detail: { id: string, value: any }  — set one answer value
    ANSWER_SET: "answer:set",
    // detail: { id: string }              — delete one answer key
    ANSWER_DELETE: "answer:delete",
    // (no detail)                          — wipe all answers (import / reset)
    ANSWERS_CLEAR: "answer:clear",
    // Dispatched after every FHIRPath evaluation cycle.
    // detail: { fp, qr, env } — fhirpath engine, current QR, and variable env.
    FHIRPATH_CTX_UPDATED: "fhirpath:ctx-updated",
    // Dispatched when a set of SDC variables should be merged into the questionnaire.
    // detail: { variables: [{name: string, expression: string}] }
    // Receiver merges by name (upsert) without touching other variables.
    VARIABLES_APPLY: "variables:apply",
    // Dispatched by AnswersMenu when the user picks a QR file or sample response.
    // detail: { data: object } — raw QuestionnaireResponse JSON.
    QR_ANSWERS_REQUESTED: "qr:answers-requested",
    // Dispatched by FileNameDisplay when the displayed file name changes.
    // detail: { name: string } — current name; empty string when cleared.
    FILE_NAME_CHANGED: "file-name:changed",
    // ── Reset flow coordination ───────────────────────────────────────────────
    // Each event carries detail: { resolve: Function } — the listener calls
    // resolve(result) when the user has responded.
    //
    // CLEAR_CONFIRM_REQUESTED   resolve('proceed' | 'export' | 'cancel')
    // EXPORT_PROMPT_REQUESTED   resolve() when export is done or skipped
    // VALIDATE_EXPORT_REQUESTED resolve() when validate modal is dismissed
    // AUTOSAVE_CLEAR_DRAFT      (no resolve) — fire-and-forget
    CLEAR_CONFIRM_REQUESTED: "reset:clear-confirm-requested",
    EXPORT_PROMPT_REQUESTED: "reset:export-prompt-requested",
    VALIDATE_EXPORT_REQUESTED: "reset:validate-export-requested",
    AUTOSAVE_CLEAR_DRAFT: "reset:autosave-clear-draft",
    // ── FHIR version ─────────────────────────────────────────────────────────
    // detail: { versionId: 'R4'|'R4B'|'R5', fromVersionId?: 'R4'|'R4B'|'R5', source?: 'user' }
    // Dispatched by FhirVersionSelect when the user changes the target FHIR version
    // (source:'user', fromVersionId = previous version), and by
    // questionnaire-loader.js when a loaded file has meta.fhirVersion set (no source).
    // When source:'user' and the tree is non-empty, version-compat checkers run and
    // a warning toast is shown only if any checker produces a message.
    FHIR_VERSION_CHANGED: "fhir-version-changed",
    // Dispatched by MetadataCard "Edit" button; MetadataModal listens and opens.
    METADATA_EDIT_REQUESTED: "metadata-edit-requested"
  });
  var STATEFUL_EVENTS = /* @__PURE__ */ new Set([
    AppEvents.APP_CONTEXT_READY,
    AppEvents.QUESTIONNAIRE_LOADED,
    AppEvents.QUESTIONNAIRE_CLEARED,
    AppEvents.QUESTIONNAIRE_NEW,
    AppEvents.FHIR_VERSION_CHANGED,
    AppEvents.PREVIEW_MODE_CHANGE,
    AppEvents.BUILDER_VIEW_MODE_CHANGE,
    AppEvents.BUILDER_META_ROW_CHANGE,
    AppEvents.LANGUAGE_CHANGED
  ]);
  var EventState = createEventState(defaultBus, STATEFUL_EVENTS);

  // js/fhir/quest-document.js
  var QuestDocument = class {
    /** @type {import('../nodes/base-node.js').BaseNode[]} Root-level tree nodes. */
    tree = [];
    /** @type {object|null} Raw imported FHIR Questionnaire JSON; null if not loaded. */
    rawFhir = null;
    /** @type {object[]} Questionnaire.contained[] — preserved for round-trip. */
    contained = [];
    /** @type {{name:string, expression:string}[]} SDC questionnaire-level variables. */
    variables = [];
    /**
     * Questionnaire-level metadata — populated on import, edited via Properties modal.
     * Questionnaire-level metadata fields.
     */
    meta = {
      // Core (always visible in Properties modal)
      id: "",
      url: "",
      version: "",
      title: "",
      status: "draft",
      publisher: "",
      description: "",
      name: "",
      // Advanced (collapsible section in Properties modal)
      date: "",
      subjectType: [],
      purpose: "",
      copyright: "",
      approvalDate: "",
      lastReviewDate: "",
      effectivePeriodStart: "",
      effectivePeriodEnd: "",
      experimental: null,
      language: "",
      derivedFrom: [],
      replaces: [],
      copyrightLabel: "",
      _versionAlgorithmString: "",
      _versionAlgorithmCoding: null,
      // Business identifiers
      _rawIdentifier: [],
      // FHIR root fields — pass-through or limited edit
      _rawText: null,
      _rawContact: null,
      _rawUseContext: null,
      _rawJurisdiction: null,
      _rawCode: null,
      // meta.*
      _metaVersionId: "",
      _metaSource: "",
      _metaLastUpdated: "",
      _rawMetaProfile: [],
      _rawMetaTag: [],
      _rawMetaSecurity: [],
      // Extensions
      _rawQuestExtensions: [],
      preferredTermServer: "",
      _signatureRequired: [],
      _implicitRules: "",
      // Target FHIR version — drives UI gates and export meta.fhirVersion
      fhirTarget: "R4"
    };
    /**
     * Translation store — populated by the Translate modal or on import.
     * Structure: { [langCode]: { title?: string, items: { [linkId]: string },
     *              opts: { [linkId+'__'+code]: string } } }
     * - items: translated item.text per linkId
     * - opts:  translated answerOption labels, key = linkId + '__' + optionCode
     * - title: translated Questionnaire.title
     */
    translations = {};
    /** Convenience getter — same as meta.fhirTarget. */
    get fhirTarget() {
      return this.meta.fhirTarget;
    }
    /** Returns contained[] entries that are ValueSet resources. */
    get containedValueSets() {
      return this.contained.filter((r) => r.resourceType === "ValueSet");
    }
    /** @param {import('../core/events/bus.js').EventBus} [bus]  channel for VARIABLES_APPLY */
    constructor(bus = defaultBus) {
      bus.on(AppEvents.VARIABLES_APPLY, (e) => this.applyVariables(e.detail.variables));
    }
    /**
     * Merge-patch a set of SDC variables into this.variables.
     * Each entry is upserted by name without touching other variables.
     */
    applyVariables(variables) {
      for (const { name, expression } of variables) {
        const idx = this.variables.findIndex((v) => v.name === name);
        if (idx >= 0) this.variables[idx].expression = expression;
        else this.variables.push({ name, expression });
      }
    }
    /**
     * Reset to empty state — in-place mutation so all external array references
     * (tree, contained, variables) remain valid.
     */
    reset() {
      destroyTree(this.tree);
      this.rawFhir = null;
      this.contained.splice(0);
      this.variables.splice(0);
      Object.assign(this.meta, {
        id: "",
        url: "",
        version: "",
        title: "",
        status: "draft",
        publisher: "",
        description: "",
        name: "",
        date: "",
        subjectType: [],
        purpose: "",
        copyright: "",
        approvalDate: "",
        lastReviewDate: "",
        effectivePeriodStart: "",
        effectivePeriodEnd: "",
        experimental: null,
        language: "",
        derivedFrom: [],
        replaces: [],
        copyrightLabel: "",
        _versionAlgorithmString: "",
        _versionAlgorithmCoding: null,
        _rawIdentifier: [],
        _rawText: null,
        _rawContact: null,
        _rawUseContext: null,
        _rawJurisdiction: null,
        _rawCode: null,
        _metaVersionId: "",
        _metaSource: "",
        _metaLastUpdated: "",
        _rawMetaProfile: [],
        _rawMetaTag: [],
        _rawMetaSecurity: [],
        _rawQuestExtensions: [],
        preferredTermServer: "",
        _signatureRequired: [],
        _implicitRules: "",
        fhirTarget: "R4"
      });
    }
  };
  var questDoc = new QuestDocument();

  // js/answer-store.js
  var AnswerStore = class _AnswerStore {
    /** Internal tree { linkId: [row0, row1, …] } — access only via facade methods.
     *  A repeating group's linkId holds an array of INSTANCE MAPS ({ childId: [...] }),
     *  addressed by an instance path (array of { id, idx }). */
    data = {};
    /** Decode a row-address key into { base, kind: 'row'|'count', index }. */
    static _parse(key) {
      const m = /^(.+)\$\$(\d+|n)$/.exec(key);
      if (!m) return { base: key, kind: "row", index: 0 };
      if (m[2] === "n") return { base: m[1], kind: "count" };
      return { base: m[1], kind: "row", index: Number(m[2]) };
    }
    /** Resolve the answer map for an instance path (root when empty/undefined); null if missing. */
    _scope(path) {
      let cur = this.data;
      for (const seg of path || []) {
        const arr = cur[seg.id];
        const inst = Array.isArray(arr) ? arr[seg.idx] : void 0;
        if (!inst || typeof inst !== "object") return null;
        cur = inst;
      }
      return cur;
    }
    /** Resolve the answer map for a path, creating missing instance maps along the way. */
    _scopeOrCreate(path) {
      let cur = this.data;
      for (const seg of path || []) {
        let arr = cur[seg.id];
        if (!Array.isArray(arr)) arr = cur[seg.id] = [];
        if (!arr[seg.idx] || typeof arr[seg.idx] !== "object") arr[seg.idx] = {};
        cur = arr[seg.idx];
      }
      return cur;
    }
    /** Return the answer for a row-address ('id' → row 0, 'id$$i' → row i, 'id$$n' → count). */
    get(key, path) {
      const scope = this._scope(path);
      if (!scope) return void 0;
      const p = _AnswerStore._parse(key);
      const arr = scope[p.base];
      if (p.kind === "count") return Array.isArray(arr) ? Math.max(0, arr.length - 1) : 0;
      return Array.isArray(arr) ? arr[p.index] : void 0;
    }
    /** Return all defined answer rows for a linkId. */
    getAll(id, path) {
      const scope = this._scope(path);
      const arr = scope && scope[id];
      return Array.isArray(arr) ? arr.filter((v) => v !== void 0) : [];
    }
    /** Set a row value by row-address ('id', 'id$$i') or resize by count ('id$$n'). */
    set(key, v, path) {
      const scope = this._scopeOrCreate(path);
      const p = _AnswerStore._parse(key);
      const arr = scope[p.base] || (scope[p.base] = []);
      if (p.kind === "count") {
        const len = v + 1;
        if (arr.length > len) arr.length = len;
        else while (arr.length < len) arr.push(void 0);
        return;
      }
      arr[p.index] = v;
    }
    /** Remove by row-address: plain 'id' → all rows; 'id$$i' → one row; 'id$$n' → extra rows. */
    remove(key, path) {
      const scope = this._scope(path);
      if (!scope) return;
      const p = _AnswerStore._parse(key);
      if (p.kind === "count") {
        const arr2 = scope[p.base];
        if (arr2) arr2.length = 1;
        return;
      }
      if (key === p.base) {
        delete scope[p.base];
        return;
      }
      const arr = scope[p.base];
      if (arr) delete arr[p.index];
    }
    // ── Repeating-group instances ──────────────────────────────────────────────
    /** Number of instances of a repeating group at the given path. */
    instanceCount(groupId, path) {
      const scope = this._scope(path);
      const arr = scope && scope[groupId];
      return Array.isArray(arr) ? arr.length : 0;
    }
    /** Append a new (empty) instance to a repeating group; returns the new count. */
    addInstance(groupId, path) {
      const scope = this._scopeOrCreate(path);
      const arr = scope[groupId] || (scope[groupId] = []);
      arr.push({});
      return arr.length;
    }
    /** Remove instance `idx` of a repeating group at the given path. */
    removeInstance(groupId, idx, path) {
      const scope = this._scope(path);
      const arr = scope && scope[groupId];
      if (Array.isArray(arr)) arr.splice(idx, 1);
    }
    /** Remove all answers. */
    clear() {
      const d = this.data;
      Object.keys(d).forEach((k) => delete d[k]);
    }
    /** Return a tree snapshot { id: [rows] } for read-only pure consumers. */
    toValueMap() {
      const out = {};
      for (const k of Object.keys(this.data)) out[k] = this.data[k].slice();
      return out;
    }
    /** Merge a tree/scalar map into the current answers (scalars are wrapped as single rows). */
    merge(map) {
      for (const k of Object.keys(map)) {
        this.data[k] = Array.isArray(map[k]) ? map[k].slice() : [map[k]];
      }
    }
    /** Replace all answers with the given map (clear + merge). */
    replaceAll(map) {
      this.clear();
      this.merge(map);
    }
    constructor(bus = defaultBus) {
      bus.on(AppEvents.ANSWER_SET, (e) => this.set(e.detail.id, e.detail.value, e.detail.path));
      bus.on(AppEvents.ANSWER_DELETE, (e) => this.remove(e.detail.id, e.detail.path));
      bus.on(AppEvents.ANSWERS_CLEAR, () => this.clear());
    }
  };
  var answerStore = new AnswerStore();

  // js/core/session.js
  var QuestionnaireSession = class {
    constructor({ questDoc: questDoc2, answerStore: answerStore2, bus, config = {} }) {
      this.questDoc = questDoc2;
      this.answerStore = answerStore2;
      this.bus = bus;
      this.config = config;
    }
  };
  function createSession(config = {}) {
    const bus = new EventBus(new EventTarget());
    return new QuestionnaireSession({
      questDoc: new QuestDocument(bus),
      answerStore: new AnswerStore(bus),
      bus,
      config
    });
  }
  var defaultSession = new QuestionnaireSession({
    questDoc,
    answerStore,
    bus: defaultBus,
    config: {}
  });

  // js/fhir/ui-strings.js
  var UI_STRINGS = {
    add_another: "+ Add another",
    add_row: "+ Add another entry",
    more_info: "More info \u2197",
    or_separator: "OR",
    and_separator: "AND",
    select_placeholder: "select"
    // wrapped as \u2014 {value} \u2014 by custom-select
  };

  // js/preview/render-ctx.js
  function createRenderCtx() {
    return {
      // Session event bus (set by the renderer). Nodes wire preview-scoped listeners
      // (scroll-to, calc-badge refresh, collapse/expand) here so embedded widgets on
      // their own bus stay isolated from the page.
      bus: defaultBus,
      // Per-render-cycle (set at the start of each _asyncRender call):
      ctx: null,
      // { fp, qr, envVars } from _reCalc()
      resultMap: null,
      // Map(id → evalResult)
      cEnv: {},
      // ctx.envVars || {}
      visible: [],
      // visible eval results
      groupIconMap: null,
      // Map of group id → { icon, descendants, node }
      previewMode: "preview",
      // current preview mode string
      // Stable refs — set once by the renderer constructor:
      viewPrefs: null,
      // _viewPrefs object (mutated in-place on pref changes)
      lastCtx: null,
      // _lastCtx object (mutated in-place by _reCalc)
      buildControl: null,
      // function(node, iconEl, onAfterChange)
      updateGroupIcons: null,
      // function() — GroupNode.updateAll(_rc); used as callback in item-node.js
      // State helpers — injected to avoid circular imports in node classes:
      isMandatory: null,
      // function(node) → bool
      calcFormOk: null,
      // function(node) → bool
      evalConstraints: null,
      // function(node, fp, qr, env) → bool
      getValue: null,
      // function(id) → any
      getAll: null,
      // function(id) → any[]  (all answers incl. repeat rows)
      set: null,
      // function(id, v) — write a single answer (repeat rows)
      remove: null,
      // function(id) — delete a single answer (repeat rows)
      CHECKABLE_TYPES: null,
      // Set<string>
      // Repeating-group instance context (set during render):
      instancePath: [],
      // [{ id, idx }, …] — current repeating-group instance scope
      instanceCount: null,
      // function(groupId, path) → number
      addInstance: null,
      // function(groupId, path) → new count
      removeInstance: null,
      // function(groupId, idx, path)
      evalChildren: null,
      // function(children, path) → results[] — per-instance eval
      // Active translation language ('' = show original source language)
      activeLanguage: "",
      // translations store — same reference as questDoc.translations
      translations: null,
      // Surface-configurable chrome (default off; app shell opts in):
      showNavBtn: false,
      // '↗' go-to-builder arrow on preview rows
      showExplain: false
      // clickable Explain on calc badges / condition hints
    };
  }
  var _rc = createRenderCtx();
  function uiStr(key, rc) {
    const fallback = UI_STRINGS[key] ?? key;
    if (!rc?.activeLanguage) return fallback;
    return rc.translations?.[rc.activeLanguage]?.ui?.[key] ?? fallback;
  }

  // js/ui/toast.js
  var CONF = {
    error: { title: "Error", icon: "!" },
    warn: { title: "Warning", icon: "!" },
    info: { title: "Info", icon: "i" }
  };
  function _close(backdrop, onKey) {
    document.removeEventListener("keydown", onKey, true);
    backdrop.style.opacity = "0";
    backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
    setTimeout(() => {
      if (backdrop.isConnected) backdrop.remove();
    }, 300);
  }
  function showToast(message, type = "error") {
    const cfg = CONF[type] || CONF.error;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop notif-backdrop";
    backdrop.style.opacity = "0";
    const box = document.createElement("div");
    box.className = `modal-box notif-box notif--${type}`;
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-modal", "true");
    const header = document.createElement("div");
    header.className = "modal-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "notif-header-title";
    const iconEl = document.createElement("span");
    iconEl.className = "notif-title-icon";
    iconEl.textContent = cfg.icon;
    const labelEl = document.createElement("span");
    labelEl.className = "modal-title-label";
    labelEl.textContent = cfg.title;
    titleWrap.append(iconEl, labelEl);
    header.appendChild(titleWrap);
    const body = document.createElement("div");
    body.className = "modal-body";
    body.textContent = message;
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "modal-btn modal-btn--apply";
    btn.textContent = "OK";
    footer.appendChild(btn);
    box.append(header, body, footer);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    backdrop.getBoundingClientRect();
    backdrop.style.opacity = "1";
    btn.focus();
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter") _close(backdrop, onKey);
    };
    document.addEventListener("keydown", onKey, true);
    btn.onclick = () => _close(backdrop, onKey);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) _close(backdrop, onKey);
    });
  }
  var showError = (msg) => showToast(msg, "error");
  var showInfo = (msg) => showToast(msg, "info");

  // js/fhir/format-registry.js
  var FormatRegistry = class {
    /** @type {Map<string, object>} */
    _map = /* @__PURE__ */ new Map();
    /** @param {object} def - format definition (see shape above) */
    register(def) {
      this._map.set(def.id, def);
    }
    /** @returns {object|undefined} */
    get(id) {
      return this._map.get(id);
    }
    /** All registered formats in insertion order. */
    getAll() {
      return [...this._map.values()];
    }
    /** Only formats where isBuilderVersion === true (for version selector). */
    getBuilderVersions() {
      return this.getAll().filter((f) => f.isBuilderVersion);
    }
    /**
     * Detect the target FHIR version from an imported Questionnaire.
     *
     * Order of precedence:
     *   1. The builder-target-version extension on the Questionnaire (our own
     *      round-trip marker — FHIR's Meta type has no fhirVersion field, so the
     *      target version is carried in an extension instead).
     *   2. Feature-based heuristics: a native `disabledDisplay` or `answerConstraint`
     *      field implies R5 (both were added in R5).
     *   3. Fallback: R4.
     *
     * @param {object} data - parsed FHIR Questionnaire JSON
     * @returns {string} format id ('R4' | 'R4B' | 'R5')
     */
    detectVersion(data) {
      const ext = (data?.extension || []).find((e) => e?.url === BUILDER_VERSION_EXTENSION_URL);
      if (ext?.valueCode) {
        for (const def of this._map.values()) {
          if (def.metaVersion && def.metaVersion === ext.valueCode) return def.id;
        }
      }
      if (this._map.has("R5") && (_treeHasField(data?.item, "disabledDisplay") || _treeHasField(data?.item, "answerConstraint")))
        return "R5";
      return "R4";
    }
  };
  var BUILDER_VERSION_EXTENSION_URL = "https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version";
  var ITEM_ANSWER_CONSTRAINT_EXTENSION_URL = "https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-answerConstraint";
  var ITEM_DISABLED_DISPLAY_EXTENSION_URL = "https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-disabledDisplay";
  function setBuilderVersion(q, code) {
    q.extension = (q.extension || []).filter((e) => e?.url !== BUILDER_VERSION_EXTENSION_URL);
    q.extension.push({ url: BUILDER_VERSION_EXTENSION_URL, valueCode: code });
    if (q.extension.length === 0) delete q.extension;
  }
  function _treeHasField(items, field) {
    if (!Array.isArray(items)) return false;
    for (const item of items) {
      if (item?.[field] !== void 0) return true;
      if (_treeHasField(item?.item, field)) return true;
    }
    return false;
  }
  var formatRegistry = new FormatRegistry();

  // js/fhir/stu3-shim.js
  function _isStu3Version(ver) {
    return typeof ver === "string" && (ver.startsWith("3.") || ver.startsWith("1."));
  }
  function _itemHasStu3Fields(item) {
    if (!item) return false;
    if (item.type === "coding") return true;
    if (Array.isArray(item.option) && item.option.length) return true;
    if (item.options) return true;
    for (const ew of item.enableWhen || []) {
      if (ew.hasAnswer !== void 0) return true;
      if (!("operator" in ew) && _hasStu3AnswerField(ew)) return true;
    }
    if (_hasStu3InitialField(item)) return true;
    for (const child of item.item || []) {
      if (_itemHasStu3Fields(child)) return true;
    }
    return false;
  }
  function _hasStu3AnswerField(ew) {
    return Object.keys(ew).some((k) => k.startsWith("answer"));
  }
  var STU3_INITIAL_KEYS = [
    "initialBoolean",
    "initialDecimal",
    "initialInteger",
    "initialDate",
    "initialDateTime",
    "initialTime",
    "initialString",
    "initialUri",
    "initialAttachment",
    "initialCoding",
    "initialQuantity",
    "initialReference"
  ];
  function _hasStu3InitialField(item) {
    return STU3_INITIAL_KEYS.some((k) => item[k] !== void 0);
  }
  function isSTU3(fhirJson) {
    if (!fhirJson || fhirJson.resourceType !== "Questionnaire") return false;
    if ((fhirJson.extension || []).some((e) => e?.url === BUILDER_VERSION_EXTENSION_URL)) return false;
    if (_isStu3Version(fhirJson.fhirVersion)) return true;
    if (_isStu3Version(fhirJson.meta?.fhirVersion)) return true;
    for (const item of fhirJson.item || []) {
      if (_itemHasStu3Fields(item)) return true;
    }
    return false;
  }
  function _convertOptions(item) {
    if (Array.isArray(item.option) && !Array.isArray(item.answerOption)) {
      item.answerOption = item.option;
      delete item.option;
    }
  }
  function _convertOptionsRef(item) {
    if (item.options && typeof item.options === "object" && item.options.reference) {
      item.answerValueSet = item.options.reference;
      delete item.options;
    }
  }
  function _convertEnableWhen(ewArray) {
    if (!Array.isArray(ewArray)) return ewArray;
    return ewArray.map((ew) => {
      const out = { ...ew };
      if (out.hasAnswer !== void 0) {
        out.operator = "exists";
        out.answerBoolean = out.hasAnswer;
        delete out.hasAnswer;
        return out;
      }
      if (!out.operator) {
        const answerKey = Object.keys(out).find((k) => k.startsWith("answer"));
        if (answerKey) out.operator = "=";
      }
      return out;
    });
  }
  var STU3_INITIAL_MAP = {
    initialBoolean: "valueBoolean",
    initialDecimal: "valueDecimal",
    initialInteger: "valueInteger",
    initialDate: "valueDate",
    initialDateTime: "valueDateTime",
    initialTime: "valueTime",
    initialString: "valueString",
    initialUri: "valueUri",
    initialAttachment: "valueAttachment",
    initialCoding: "valueCoding",
    initialQuantity: "valueQuantity",
    initialReference: "valueReference"
  };
  function _convertInitial(item) {
    if (Array.isArray(item.initial)) return;
    for (const [stu3Key, r4Key] of Object.entries(STU3_INITIAL_MAP)) {
      if (item[stu3Key] !== void 0) {
        item.initial = [{ [r4Key]: item[stu3Key] }];
        delete item[stu3Key];
        return;
      }
    }
  }
  function _convertItemType(item) {
    if (item.type === "coding") item.type = "choice";
  }
  function _normaliseItem(item) {
    _convertItemType(item);
    _convertOptions(item);
    _convertOptionsRef(item);
    if (item.enableWhen) item.enableWhen = _convertEnableWhen(item.enableWhen);
    _convertInitial(item);
    for (const child of item.item || []) _normaliseItem(child);
  }
  function normaliseSTU3(fhirJson) {
    if (!isSTU3(fhirJson)) return fhirJson;
    const q = JSON.parse(JSON.stringify(fhirJson));
    for (const item of q.item || []) _normaliseItem(item);
    return q;
  }

  // js/id.js
  var _seq = 1;
  var nextId = () => "n" + _seq++;
  var resetSeq = () => {
    _seq = 1;
  };
  var _uidSeq = 1;
  var nextUid = (prefix = "uid") => prefix + "-" + _uidSeq++;

  // js/fhir/urls/fhir.js
  var HL7 = "http://hl7.org/fhir";
  var THL7 = "http://terminology.hl7.org";
  var SD = HL7 + "/StructureDefinition";
  var SDC = HL7 + "/uv/sdc/StructureDefinition";
  var SDCS = HL7 + "/uv/sdc/CodeSystem";
  var FHIR = {
    // Base for building dynamic StructureDefinition URLs, e.g. `${FHIR.sd}/${type}`.
    sd: SD,
    // Base for building FHIR ValueSet URIs, e.g. `${FHIR.vs}/marital-status`.
    vs: HL7 + "/ValueSet",
    // ── Core FHIR (questionnaire-*) extensions ────────────────────────────────
    itemControl: SD + "/questionnaire-itemControl",
    constraint: SD + "/questionnaire-constraint",
    unit: SD + "/questionnaire-unit",
    unitValueSet: SD + "/questionnaire-unitValueSet",
    unitOption: SD + "/questionnaire-unitOption",
    minOccurs: SD + "/questionnaire-minOccurs",
    maxOccurs: SD + "/questionnaire-maxOccurs",
    sliderStepValue: SD + "/questionnaire-sliderStepValue",
    supportLink: SD + "/questionnaire-supportLink",
    optionPrefix: SD + "/questionnaire-optionPrefix",
    optionExclusive: SD + "/questionnaire-optionExclusive",
    hidden: SD + "/questionnaire-hidden",
    usageMode: SD + "/questionnaire-usageMode",
    choiceOrientation: SD + "/questionnaire-choiceOrientation",
    displayCategory: SD + "/questionnaire-displayCategory",
    baseType: SD + "/questionnaire-baseType",
    fhirType: SD + "/questionnaire-fhirType",
    referenceResource: SD + "/questionnaire-referenceResource",
    referenceProfile: SD + "/questionnaire-referenceProfile",
    referenceFilter: SD + "/questionnaire-referenceFilter",
    signatureRequired: SD + "/questionnaire-signatureRequired",
    // ── Core FHIR (general) extensions ────────────────────────────────────────
    minValue: SD + "/minValue",
    maxValue: SD + "/maxValue",
    minLength: SD + "/minLength",
    maxSize: SD + "/maxSize",
    mimeType: SD + "/mimeType",
    regex: SD + "/regex",
    entryFormat: SD + "/entryFormat",
    ordinalValue: SD + "/ordinalValue",
    itemWeight: SD + "/itemWeight",
    designNote: SD + "/designNote",
    translation: SD + "/translation",
    maxDecimalPlaces: SD + "/maxDecimalPlaces",
    renderingXhtml: SD + "/rendering-xhtml",
    renderingStyle: SD + "/rendering-style",
    renderingMarkdown: SD + "/rendering-markdown",
    artifactVersionAlgorithm: SD + "/artifact-versionAlgorithm",
    artifactCopyrightLabel: SD + "/artifact-copyrightLabel",
    replaces: SD + "/replaces",
    // ── SDC (sdc-questionnaire-*) extensions ──────────────────────────────────
    calculatedExpression: SDC + "/sdc-questionnaire-calculatedExpression",
    initialExpression: SDC + "/sdc-questionnaire-initialExpression",
    enableWhenExpression: SDC + "/sdc-questionnaire-enableWhenExpression",
    answerExpression: SDC + "/sdc-questionnaire-answerExpression",
    candidateExpression: SDC + "/sdc-questionnaire-candidateExpression",
    variable: SDC + "/sdc-questionnaire-variable",
    launchContext: SDC + "/sdc-questionnaire-launchContext",
    itemMedia: SDC + "/sdc-questionnaire-itemMedia",
    answerMedia: SDC + "/sdc-questionnaire-answerMedia",
    isSubject: SDC + "/sdc-questionnaire-isSubject",
    entryFormatSdc: SDC + "/sdc-questionnaire-entryFormat",
    columnCount: SDC + "/sdc-questionnaire-columnCount",
    choiceColumn: SDC + "/sdc-questionnaire-choiceColumn",
    collapsible: SDC + "/sdc-questionnaire-collapsible",
    hiddenSdc: SDC + "/sdc-questionnaire-hidden",
    openLabel: SDC + "/sdc-questionnaire-openLabel",
    observationExtract: SDC + "/sdc-questionnaire-observationExtract",
    preferredTerminologyServer: SDC + "/sdc-questionnaire-preferredTerminologyServer",
    shortText: SDC + "/sdc-questionnaire-shortText",
    itemContext: SDC + "/sdc-questionnaire-itemContext",
    definitionExtract: SDC + "/sdc-questionnaire-definitionExtract",
    definitionExtractContext: SDC + "/sdc-questionnaire-definitionExtractContext",
    sdcQuestionnaire: SDC + "/sdc-questionnaire",
    sdcObservation: SDC + "/sdc-observation",
    launchContextCS: SDCS + "/launchContext",
    // ── FHIR code systems / value-set URIs (non-StructureDefinition) ──────────
    itemControlCS: HL7 + "/questionnaire-item-control",
    displayCategoryCS: HL7 + "/questionnaire-display-category",
    versionAlgorithm: HL7 + "/version-algorithm",
    icd10cm: HL7 + "/sid/icd-10-cm",
    // ── HL7 terminology.hl7.org code systems ──────────────────────────────────
    v3Confidentiality: THL7 + "/CodeSystem/v3-Confidentiality"
  };

  // js/fhir/urls/app.js
  var APP = "http://fhir-qb.app";
  var APP_URL = {
    redcapNs: APP + "/redcap/",
    uiTranslations: APP + "/StructureDefinition/ui-translations",
    xhtmlTranslations: APP + "/StructureDefinition/xhtml-translations",
    markdownTranslations: APP + "/StructureDefinition/markdown-translations"
  };

  // js/fhir/import-helpers.js
  var KNOWN_ITEM_EXTENSION_URLS = /* @__PURE__ */ new Set([
    FHIR.enableWhenExpression,
    FHIR.constraint,
    FHIR.itemControl,
    FHIR.referenceResource,
    FHIR.unit,
    FHIR.unitValueSet,
    FHIR.calculatedExpression,
    FHIR.initialExpression,
    FHIR.minLength,
    FHIR.entryFormatSdc,
    FHIR.entryFormat,
    FHIR.choiceOrientation,
    FHIR.displayCategory,
    FHIR.minValue,
    FHIR.maxValue,
    FHIR.minOccurs,
    FHIR.maxOccurs,
    FHIR.sliderStepValue,
    FHIR.supportLink,
    FHIR.hiddenSdc,
    FHIR.hidden,
    FHIR.observationExtract,
    FHIR.collapsible,
    FHIR.openLabel,
    FHIR.isSubject,
    FHIR.columnCount,
    ITEM_DISABLED_DISPLAY_EXTENSION_URL,
    ITEM_ANSWER_CONSTRAINT_EXTENSION_URL,
    FHIR.maxSize,
    FHIR.mimeType,
    FHIR.designNote,
    FHIR.answerExpression,
    FHIR.candidateExpression,
    FHIR.preferredTerminologyServer,
    FHIR.choiceColumn,
    FHIR.unitOption,
    FHIR.regex,
    FHIR.usageMode,
    FHIR.referenceFilter,
    FHIR.referenceProfile,
    FHIR.signatureRequired,
    FHIR.itemMedia,
    FHIR.itemWeight,
    FHIR.baseType,
    FHIR.fhirType
  ]);
  var ANSWER_SOURCE_EXPR_EXTS = [
    { url: FHIR.answerExpression, prop: "_answerExpression" },
    { url: FHIR.candidateExpression, prop: "_candidateExpression" }
  ];
  function _collectUnknownExtensions(fhirItem) {
    const unknown = (fhirItem.extension || []).filter((e) => !KNOWN_ITEM_EXTENSION_URLS.has(e.url));
    return unknown.length ? unknown.map((e) => JSON.parse(JSON.stringify(e))) : null;
  }
  function fhirTypeToItemType(t) {
    if (t === "boolean") return "checkbox";
    if (t === "integer") return "integer";
    if (t === "decimal") return "decimal";
    if (t === "quantity") return "quantity";
    if (t === "choice" || t === "coding") return "select";
    if (t === "open-choice") return "open-choice";
    if (t === "display") return "display";
    if (t === "date") return "date";
    if (t === "dateTime") return "dateTime";
    if (t === "time") return "time";
    if (t === "url") return "url";
    if (t === "attachment") return "attachment";
    if (t === "reference") return "reference";
    return "text";
  }
  function fhirOptsToStr(opts) {
    return (opts || []).map((o) => {
      if (o.valueCoding) {
        const code = o.valueCoding.code || "";
        const display = o.valueCoding.display || "";
        if (code && display && code !== display) return code + "=" + display;
        return display || code;
      }
      if (o.valueString !== void 0) return o.valueString;
      if (o.valueInteger !== void 0) return String(o.valueInteger);
      if (o.valueDate !== void 0) return o.valueDate;
      if (o.valueTime !== void 0) return o.valueTime;
      if (o.valueReference) {
        return typeof o.valueReference === "string" ? o.valueReference : o.valueReference.reference || "";
      }
      return "";
    }).filter(Boolean).join(", ");
  }
  function hasNonCodingOpts(opts) {
    return (opts || []).some((o) => !o.valueCoding);
  }
  function hasCommaInCodingOpts(opts) {
    return (opts || []).some((o) => o.valueCoding && [o.valueCoding.code, o.valueCoding.display].some((v) => typeof v === "string" && v.includes(",")));
  }
  function buildLinkIdMap(items, map = {}) {
    for (const item of items || []) {
      map[item.linkId] = item.text || item.linkId || "";
      buildLinkIdMap(item.item, map);
    }
    return map;
  }
  function humanEnableWhen(enableWhen, enableBehavior, linkIdMap) {
    if (!enableWhen || !enableWhen.length) return "";
    const joiner = enableBehavior === "any" ? " OR " : " AND ";
    const parts = enableWhen.map((ew) => {
      const qText = linkIdMap && linkIdMap[ew.question] || ew.question;
      if (ew.operator === "exists") return "\xAB" + qText + "\xBB has answer";
      let val;
      if (ew.answerBoolean !== void 0) val = ew.answerBoolean ? "Yes" : "No";
      else if (ew.answerString !== void 0) val = "\xAB" + ew.answerString + "\xBB";
      else if (ew.answerInteger !== void 0) val = ew.answerInteger;
      else if (ew.answerDecimal !== void 0) val = ew.answerDecimal;
      else if (ew.answerQuantity !== void 0) val = (ew.answerQuantity.value ?? "?") + (ew.answerQuantity.unit || ew.answerQuantity.code ? " " + (ew.answerQuantity.unit || ew.answerQuantity.code) : "");
      else if (ew.answerCoding) val = ew.answerCoding.display || ew.answerCoding.code || "?";
      else val = "?";
      const opLabel = { "=": "=", "!=": "\u2260", ">": ">", "<": "<", ">=": "\u2265", "<=": "\u2264" }[ew.operator] || ew.operator;
      return "\xAB" + qText + "\xBB " + opLabel + " " + val;
    });
    return parts.join(joiner);
  }
  function applyVisibility(node, fhirItem, linkIdMap) {
    if (fhirItem.enableWhen && fhirItem.enableWhen.length) {
      node.enableWhen = fhirItem.enableWhen.map((ew) => ({ ...ew }));
      node.enableBehavior = fhirItem.enableBehavior === "any" ? "any" : "all";
      node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, fhirItem.enableBehavior, linkIdMap);
    }
    const eweExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.enableWhenExpression
    );
    if (eweExt && eweExt.valueExpression) {
      node.enableWhenExpression = eweExt.valueExpression.expression || "";
    }
  }
  function applyConstraints(node, fhirItem) {
    const constraints = (fhirItem.extension || []).filter(
      (e) => e.url === FHIR.constraint
    );
    if (!constraints.length) return false;
    let hasOrGroup = false;
    node.constraint = constraints.map((ext) => ({
      key: ext.extension?.find((e) => e.url === "key")?.valueId || "",
      expression: ext.extension?.find((e) => e.url === "expression")?.valueString || "",
      human: ext.extension?.find((e) => e.url === "human")?.valueString || "",
      severity: ext.extension?.find((e) => e.url === "severity")?.valueCode || "error"
    })).filter((c) => {
      if (c.key === ITLH_KEY_GROUP_OR) {
        hasOrGroup = true;
        return false;
      }
      return c.expression;
    });
    return hasOrGroup;
  }
  function resolveContainedValueSet(contained, ref) {
    if (!ref || !ref.startsWith("#")) return "";
    const id = ref.slice(1);
    const vs = (contained || []).find((r) => r.resourceType === "ValueSet" && r.id === id);
    if (!vs) return "";
    const parts = [];
    for (const inc of vs.compose?.include || []) {
      for (const c of inc.concept || []) {
        if (c.code) parts.push(c.code + (c.display ? "=" + c.display : ""));
      }
    }
    return parts.join(",");
  }

  // js/nodes/registry.js
  var NODE_REGISTRY = /* @__PURE__ */ new Map();

  // js/ui/modals/modal-base.js
  var _registry = /* @__PURE__ */ new Map();
  if (typeof document !== "undefined") document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    let topCancel = null, topZ = -1;
    for (const [backdrop, cancel] of _registry) {
      if (backdrop.style.display === "none") continue;
      const z = parseInt(getComputedStyle(backdrop).zIndex, 10) || 0;
      if (z > topZ) {
        topZ = z;
        topCancel = cancel;
      }
    }
    if (topCancel) topCancel();
  });
  function _mk(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }
  var _FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var _modalSeq = 0;
  var Modal = class {
    /** Direct references to singleton document and answer store — always current. */
    static _svc = { get questDoc() {
      return questDoc;
    }, get answerStore() {
      return answerStore;
    } };
    /** Override in subclass to assign data-testid attributes to modal DOM elements. */
    getName() {
      return null;
    }
    constructor({ cancelLabel = "Cancel", applyLabel = "Apply", maxWidth = null, bodyClass = null } = {}) {
      this.backdrop = _mk("div", "modal-backdrop");
      this.backdrop.style.display = "none";
      const box = _mk("div", "modal-box");
      if (maxWidth) box.style.maxWidth = maxWidth;
      this.box = box;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.tabIndex = -1;
      const header = _mk("div", "modal-header");
      this.title = _mk("span");
      this.title.id = "modal-title-" + ++_modalSeq;
      box.setAttribute("aria-labelledby", this.title.id);
      this.closeBtn = _mk("button", "modal-close");
      this.closeBtn.type = "button";
      this.closeBtn.dataset.tipTitle = "Close";
      this.closeBtn.textContent = "\u2715";
      header.append(this.title, this.closeBtn);
      this.body = _mk("div", bodyClass ? `modal-body ${bodyClass}` : "modal-body");
      this.footer = _mk("div", "modal-footer");
      this.cancelBtn = null;
      this.applyBtn = null;
      if (cancelLabel !== null) {
        this.cancelBtn = _mk("button", "modal-btn modal-btn--cancel");
        this.cancelBtn.type = "button";
        this.cancelBtn.textContent = cancelLabel;
        this.footer.appendChild(this.cancelBtn);
      }
      if (applyLabel !== null) {
        this.applyBtn = _mk("button", "modal-btn modal-btn--apply");
        this.applyBtn.type = "button";
        this.applyBtn.textContent = applyLabel;
        this.footer.appendChild(this.applyBtn);
      }
      box.append(header, this.body, this.footer);
      this.backdrop.appendChild(box);
      const n = this.getName();
      if (n) {
        this.backdrop.dataset.testid = n;
        this.title.dataset.testid = n + "Title";
        this.closeBtn.dataset.testid = n + "Close";
        this.body.dataset.testid = n + "Body";
        if (this.cancelBtn) this.cancelBtn.dataset.testid = n + "Cancel";
        if (this.applyBtn) this.applyBtn.dataset.testid = n + "Apply";
      }
      this.closeBtn.addEventListener("click", () => this._cancel());
      if (this.cancelBtn) this.cancelBtn.addEventListener("click", () => this._cancel());
      if (this.applyBtn) this.applyBtn.addEventListener("click", () => this._apply());
      this.backdrop.addEventListener("click", (e) => {
        if (e.target === this.backdrop) this._cancel();
      });
      _registry.set(this.backdrop, () => this._cancel());
      document.body.appendChild(this.backdrop);
    }
    open() {
      this._prevFocus = typeof document !== "undefined" && document.activeElement || null;
      this.backdrop.style.display = "flex";
      if (!this._trapHandler) {
        this._trapHandler = (e) => this._onTrapKeydown(e);
        this.backdrop.addEventListener("keydown", this._trapHandler);
      }
      try {
        this.box.focus({ preventScroll: true });
      } catch {
      }
    }
    close() {
      this.backdrop.style.display = "none";
      if (this._trapHandler) {
        this.backdrop.removeEventListener("keydown", this._trapHandler);
        this._trapHandler = null;
      }
      const prev = this._prevFocus;
      this._prevFocus = null;
      if (prev && typeof prev.focus === "function" && prev.isConnected) {
        try {
          prev.focus({ preventScroll: true });
        } catch {
        }
      }
    }
    /** Keep Tab focus cycling inside the dialog (focus trap). */
    _onTrapKeydown(e) {
      if (e.key !== "Tab") return;
      const items = [...this.box.querySelectorAll(_FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        this.box.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === this.box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    /** Render the standard two-part title: bold label + muted subject. */
    setTitle(label, subject) {
      this.title.innerHTML = "";
      const l = _mk("span", "modal-title-label");
      l.textContent = label;
      this.title.appendChild(l);
      if (subject) {
        const s = _mk("span", "modal-title-subject");
        s.textContent = " \u2014 " + subject;
        this.title.appendChild(s);
      }
    }
    _apply() {
      this.close();
    }
    _cancel() {
      this.close();
    }
  };

  // js/fhir/fhir-model.js
  var fhirModel = () => typeof window !== "undefined" ? window.fhirpath_r4_model : void 0;

  // js/fhir/explain.js
  function splitOnOp(expr, op) {
    const parts = [];
    let depth = 0;
    let inStr = null;
    let start = 0;
    const kw = " " + op + " ";
    const kwl = kw.length;
    const len = expr.length;
    for (let i = 0; i < len; i++) {
      const ch = expr[i];
      if (inStr) {
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        inStr = ch;
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") {
        depth++;
        continue;
      }
      if (ch === ")" || ch === "]" || ch === "}") {
        depth--;
        continue;
      }
      if (depth === 0 && expr.slice(i, i + kwl).toLowerCase() === kw) {
        parts.push(expr.slice(start, i).trim());
        start = i + kwl;
        i += kwl - 1;
      }
    }
    if (parts.length > 0) {
      parts.push(expr.slice(start).trim());
      return parts;
    }
    return [];
  }
  function unwrapOuterParens(expr) {
    expr = expr.trim();
    if (!expr.startsWith("(")) return expr;
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") depth++;
      else if (expr[i] === ")") {
        depth--;
        if (depth === 0) {
          return i === expr.length - 1 ? expr.slice(1, -1).trim() : expr;
        }
      }
    }
    return expr;
  }
  function parseExprTree(rawExpr) {
    const expr = unwrapOuterParens(rawExpr.trim());
    const notMatch = /^not\s*\(([\s\S]+)\)$/i.exec(expr);
    if (notMatch) {
      return { type: "NOT", child: parseExprTree(notMatch[1]) };
    }
    const orParts = splitOnOp(expr, "or");
    if (orParts.length >= 2) {
      return { type: "OR", children: orParts.map((p) => parseExprTree(p)) };
    }
    const andParts = splitOnOp(expr, "and");
    if (andParts.length >= 2) {
      return { type: "AND", children: andParts.map((p) => parseExprTree(p)) };
    }
    return { type: "LEAF", expr };
  }
  function evaluateExprTree(node, fp, resource, env) {
    switch (node.type) {
      case "LEAF": {
        try {
          const raw = fp.evaluate(resource || {}, node.expr, env || {}, fhirModel());
          const first = Array.isArray(raw) ? raw[0] : raw;
          node.result = first === true || first === "true" || typeof first === "number" && first !== 0 ? true : first === false || first === "false" || first === 0 ? false : raw.length > 0 ? true : false;
        } catch (e) {
          node.result = null;
          node.error = e.message;
        }
        break;
      }
      case "NOT": {
        evaluateExprTree(node.child, fp, resource, env);
        node.result = node.child.result === null ? null : !node.child.result;
        break;
      }
      case "AND": {
        for (const c of node.children) evaluateExprTree(c, fp, resource, env);
        node.result = node.children.every((c) => c.result === true);
        break;
      }
      case "OR": {
        for (const c of node.children) evaluateExprTree(c, fp, resource, env);
        node.result = node.children.some((c) => c.result === true);
        break;
      }
    }
    return node;
  }

  // js/ui/modals/explain-modal.js
  var ExplainModal = class extends Modal {
    getName() {
      return "explainModal";
    }
    constructor() {
      super({ cancelLabel: "Close", applyLabel: null });
      this.setTitle("Expression Explain");
    }
    show(expr, fp, resource, env) {
      this.setTitle("Expression Explain");
      this.body.innerHTML = "";
      try {
        const tree = parseExprTree(expr);
        evaluateExprTree(tree, fp, resource, env);
        this.body.appendChild(_renderNode(tree, 0));
      } catch (e) {
        const errDiv = document.createElement("div");
        errDiv.className = "explain-parse-error";
        errDiv.textContent = "Could not parse expression: " + e.message;
        this.body.appendChild(errDiv);
      }
      const strip = document.createElement("div");
      strip.className = "explain-fhirpath";
      const label = document.createElement("span");
      label.className = "explain-fhirpath-label";
      label.textContent = "FHIRPath:";
      const code = document.createElement("code");
      code.className = "explain-full-expr";
      code.textContent = expr;
      strip.append(label, code);
      this.body.appendChild(strip);
      super.open();
    }
    // Show a standard enableWhen breakdown (no FHIRPath): why an item is hidden —
    // each condition with expected vs actual value and a ✓/✗ result.
    showAudit(title, data) {
      this.setTitle(title);
      this.body.innerHTML = "";
      const head = document.createElement("div");
      head.className = "explain-audit-head";
      head.textContent = `Shown only when ${data.logic} of these conditions are met:`;
      this.body.appendChild(head);
      for (const r of data.rows) {
        const row = document.createElement("div");
        row.className = "explain-row";
        row.style.setProperty("--explain-depth", 0);
        row.appendChild(_icon(r.ok));
        const span = document.createElement("span");
        span.className = "explain-expr";
        span.textContent = r.text;
        row.appendChild(span);
        this.body.appendChild(row);
      }
      super.open();
    }
    _cancel() {
      this.close();
    }
  };
  function _icon(result) {
    const span = document.createElement("span");
    span.className = "explain-icon" + (result === true ? " explain-icon--true" : result === false ? " explain-icon--false" : " explain-icon--err");
    span.textContent = result === true ? "\u2713" : result === false ? "\u2717" : "?";
    return span;
  }
  function _renderNode(node, depth) {
    const frag = document.createDocumentFragment();
    const row = document.createElement("div");
    row.className = "explain-row";
    row.style.setProperty("--explain-depth", depth);
    row.appendChild(_icon(node.result));
    if (node.type === "LEAF") {
      const code = document.createElement("code");
      code.className = "explain-expr";
      code.textContent = node.expr;
      row.appendChild(code);
      if (node.error) {
        const err = document.createElement("span");
        err.className = "explain-error";
        err.textContent = node.error;
        row.appendChild(err);
      }
    } else {
      const lbl = document.createElement("span");
      lbl.className = "explain-op explain-op--" + node.type.toLowerCase();
      lbl.textContent = node.type;
      row.appendChild(lbl);
    }
    frag.appendChild(row);
    if (node.type === "AND" || node.type === "OR") {
      for (const child of node.children) frag.appendChild(_renderNode(child, depth + 1));
    } else if (node.type === "NOT") {
      frag.appendChild(_renderNode(node.child, depth + 1));
    }
    return frag;
  }
  var _inst = null;
  var _modal = () => _inst ??= new ExplainModal();
  var show = (expr, fp, resource, env) => _modal().show(expr, fp, resource, env);
  var showAudit = (title, data) => _modal().showAudit(title, data);

  // js/eval.js
  function markAllDisabled(nodes, results) {
    for (const ch of nodes) {
      results.push({ node: ch, visible: true, ok: true, disabled: true });
      if (ch.children?.length) markAllDisabled(ch.children, results);
    }
  }
  function compareValue(val, ew) {
    if (ew.operator === "exists") {
      const hasVal = val !== void 0 && val !== null && val !== "";
      return ew.answerBoolean !== false ? hasVal : !hasVal;
    }
    if (ew.answerQuantity !== void 0) {
      const q = ew.answerQuantity || {};
      const curNum = Number(val && typeof val === "object" ? val.value : val);
      const ansNum = Number(q.value);
      const curUnit = val && typeof val === "object" ? val.unit || "" : "";
      const ansUnit = q.code || q.unit || "";
      const unitOk = !ansUnit || String(curUnit) === String(ansUnit);
      switch (ew.operator) {
        case "=":
          return curNum === ansNum && unitOk;
        case "!=":
          return !(curNum === ansNum && unitOk);
        case ">":
          return curNum > ansNum;
        case "<":
          return curNum < ansNum;
        case ">=":
          return curNum >= ansNum;
        case "<=":
          return curNum <= ansNum;
      }
      return false;
    }
    let answer;
    if (ew.answerBoolean !== void 0) answer = ew.answerBoolean;
    else if (ew.answerString !== void 0) answer = ew.answerString;
    else if (ew.answerInteger !== void 0) answer = ew.answerInteger;
    else if (ew.answerDecimal !== void 0) answer = ew.answerDecimal;
    else if (ew.answerCoding) answer = ew.answerCoding.code || ew.answerCoding.display || "";
    else return false;
    const coerced = String(answer);
    const current = val !== void 0 && val !== null ? String(val) : "";
    switch (ew.operator) {
      case "=":
        return current === coerced;
      case "!=":
        return current !== coerced;
      case ">":
        return Number(current) > Number(coerced);
      case "<":
        return Number(current) < Number(coerced);
      case ">=":
        return Number(current) >= Number(coerced);
      case "<=":
        return Number(current) <= Number(coerced);
    }
    return false;
  }
  function checkOneEnableWhen(ew, path, store) {
    let all = store.getAll(ew.question, path);
    if (all.length === 0 && path && path.length) all = store.getAll(ew.question);
    if (all.length === 0) return compareValue(void 0, ew);
    return all.some((v) => compareValue(v, ew));
  }
  function isNodeVisible(node, ctx, path) {
    const store = ctx?.answerStore || answerStore;
    if (node.enableWhen && node.enableWhen.length) {
      const checks = node.enableWhen.map((ew) => checkOneEnableWhen(ew, path, store));
      return node.enableBehavior === "any" ? checks.some(Boolean) : checks.every(Boolean);
    }
    if (node.enableWhenExpression && ctx && ctx.fp && ctx.qr) {
      try {
        const env = { resource: ctx.qr, ...ctx.envVars || {} };
        const result = ctx.fp.evaluate(ctx.qr, node.enableWhenExpression, env, fhirModel());
        return result[0] === true;
      } catch {
        return false;
      }
    }
    return true;
  }
  function evaluateNode(node, ctx, results, _insideHidden = false, path = []) {
    if (node._hidden || _insideHidden) {
      const isRoot = !!node._hidden && !_insideHidden;
      const hiddenEntry = { node, visible: true, ok: true, hidden: true, hiddenRoot: isRoot };
      results.push(hiddenEntry);
      if (node.children?.length) {
        for (const ch of node.children) evaluateNode(ch, ctx, results, true, path);
      }
      return { ok: true, visible: true, hidden: true };
    }
    const visible = isNodeVisible(node, ctx, path);
    if (!visible) {
      const showDimmed = !!(node.enableWhen && node.enableWhen.length) || !!node.enableWhenExpression;
      results.push({ node, visible: false, ok: node.mandatory === false, showDimmed });
      if (showDimmed && node.children?.length) {
        markAllDisabled(node.children, results);
      }
      return { ok: node.mandatory === false, visible: false, showDimmed };
    }
    if (node.type === "item") {
      results.push({ node, visible: true, ok: true });
      if (node.children?.length) {
        for (const ch of node.children) evaluateNode(ch, ctx, results, false, path);
      }
      return { ok: true, visible: true };
    }
    if (node.repeats) {
      results.push({ node, visible: true, ok: true, repeating: true });
      return { ok: true, visible: true };
    }
    const entry = { node, visible: true, ok: true };
    results.push(entry);
    const visKids = [];
    for (const ch of node.children) {
      const r = evaluateNode(ch, ctx, results, false, path);
      if (r.visible) visKids.push(r);
    }
    let groupOk;
    if (visKids.length === 0) {
      groupOk = node.mandatory === false;
    } else {
      groupOk = visKids[0].ok;
      for (let i = 1; i < visKids.length; i++) {
        groupOk = node.logicWithParent === "AND" ? groupOk && visKids[i].ok : groupOk || visKids[i].ok;
      }
    }
    entry.ok = groupOk;
    return { ok: groupOk, visible: true };
  }

  // js/fhir/render-style.js
  var RENDER_STYLE_ALLOWLIST = ["font-weight", "font-style", "color", "font-size", "text-decoration"];
  function parseRenderStyle(raw) {
    const out = {};
    if (!raw) return out;
    const allow = new Set(RENDER_STYLE_ALLOWLIST);
    raw.split(";").forEach((part) => {
      const sep = part.indexOf(":");
      if (sep < 1) return;
      const prop = part.slice(0, sep).trim().toLowerCase();
      const val = part.slice(sep + 1).trim();
      if (allow.has(prop) && val) out[prop] = val;
    });
    return out;
  }

  // js/nodes/base-node.js
  function buildEnableWhenRows(enableWhen, enableBehavior, getAll) {
    if (!getAll) return null;
    const logic = enableBehavior === "any" ? "ANY" : "ALL";
    const rows = enableWhen.map((ew) => {
      const all = getAll(ew.question);
      const actual = all.length === 0 ? "(no answer)" : all.map((v) => JSON.stringify(v)).join(", ");
      const expected = ew.operator === "exists" ? ew.answerBoolean !== false ? "exists" : "not exists" : JSON.stringify(
        ew.answerBoolean !== void 0 ? ew.answerBoolean : ew.answerString !== void 0 ? ew.answerString : ew.answerInteger !== void 0 ? ew.answerInteger : ew.answerDecimal !== void 0 ? ew.answerDecimal : ew.answerCoding !== void 0 ? ew.answerCoding.code || ew.answerCoding.display : "?"
      );
      const ok = all.length === 0 ? compareValue(void 0, ew) : all.some((v) => compareValue(v, ew));
      return { ok, text: `[${ew.question}] ${ew.operator} ${expected}  \u2192  actual: ${actual}` };
    });
    return { logic, rows };
  }
  function buildEnableWhenAudit(enableWhen, enableBehavior, getAll) {
    const data = buildEnableWhenRows(enableWhen, enableBehavior, getAll);
    if (!data) return null;
    const lines = data.rows.map((r) => `${r.ok ? "\u2713" : "\u2717"} ${r.text}`);
    return `Enable when (${data.logic}):
` + lines.join("\n");
  }
  function createWrap() {
    const wrap = document.createElement("span");
    wrap.className = "ctrl-wrap";
    return wrap;
  }
  function isRelevantItem(node, rc) {
    return rc.isMandatory(node) && rc.CHECKABLE_TYPES.has(node.itemType) || node._calculatedExpr && node._readOnly && node.itemType === "checkbox" || node.constraint?.length > 0 || (node._minValue !== void 0 || node._maxValue !== void 0);
  }
  function applyRenderStyle(el, raw) {
    const style = parseRenderStyle(raw);
    for (const prop of Object.keys(style)) el.style.setProperty(prop, style[prop]);
  }
  var BaseNode = class _BaseNode {
    /** Shared collapse state for all nodes with children (group and item). */
    static _collapseMap = /* @__PURE__ */ new Map();
    constructor(data = {}) {
      this.id = data.id ?? nextId();
      this.title = data.title ?? "";
      this.enableWhen = data.enableWhen ?? [];
      this.enableBehavior = data.enableBehavior ?? "all";
      this.enableWhenExpression = data.enableWhenExpression ?? "";
      this.mandatory = data.mandatory ?? false;
      this._previewCollapsed = false;
      if (typeof document !== "undefined") {
        this._ac = new AbortController();
        document.addEventListener(AppEvents.COPY_TO_NODES, (e) => {
          const { ids, patch, nodeType } = e.detail;
          if (!ids.includes(this.id)) return;
          if (nodeType && this.type !== nodeType) return;
          this.applyPatch(patch);
        }, { signal: this._ac.signal });
      }
    }
    // Preview-scoped listeners live on the render session bus (not `document`) so
    // embedded widgets on their own bus stay isolated. Wired lazily on first render
    // via renderPreview(); idempotent.
    _ensureBusListeners(rc) {
      if (this._busWired || !this._ac) return;
      this._busWired = true;
      const bus = rc?.bus || defaultBus;
      this._bus = bus;
      bus.on(AppEvents.REFRESH_CALC_BADGES, () => this._refreshCalcBadge?.(), { signal: this._ac.signal });
      bus.on(AppEvents.BUILDER_NAVIGATE, (e) => {
        if (!this._previewCollapsed) return;
        if (!isDescendant(e.detail.id, this)) return;
        this._previewCollapsed = false;
      }, { signal: this._ac.signal });
      bus.on(AppEvents.COLLAPSE_ALL_PREVIEW, () => {
        this._previewCollapsed = true;
      }, { signal: this._ac.signal });
      bus.on(AppEvents.EXPAND_ALL_PREVIEW, () => {
        this._previewCollapsed = false;
      }, { signal: this._ac.signal });
      this._initPreviewNavListener(bus);
    }
    /** Abort all document listeners owned by this node. */
    destroy() {
      this._ac?.abort();
      this._navAbort?.abort();
    }
    /**
     * Apply a patch object to this node.
     * null value = delete the key from node; any other value = assign to node.
     */
    applyPatch(patch) {
      for (const [key, val] of Object.entries(patch)) {
        if (val === null) delete this[key];
        else this[key] = val;
      }
    }
    // ── Builder service injection ─────────────────────────────────────────────
    // Nodes must not import application state or services directly.
    // confirmDelete  → dispatch NODE_DELETE_REQUESTED → BuilderPanel handles it
    // triggerCalcRecalc → dispatch AppEvents.CALC_RECALC_REQUESTED
    // formatSeg     → import numberingService from js/builder/numbering-service.js
    // copyNode/paste → dispatch NODE_COPY/PASTE_*_REQUESTED → CopyPaste handles it
    // domPurify/marked → window.DOMPurify / window.marked (loaded from lib/)
    // leftPanelBody → document.querySelector('.left-panel-body') (stable DOM element)
    /** True when CopyPaste has something in the clipboard. Updated via CLIPBOARD_CHANGED event. */
    static _hasClipboard = false;
    static {
      if (typeof document !== "undefined") {
        document.addEventListener(AppEvents.CLIPBOARD_CHANGED, (e) => {
          _BaseNode._hasClipboard = e.detail.hasClip;
        });
      }
    }
    /** Dispatch a preview:response-changed event so PreviewForm re-renders.
     *  @param {import('../core/events/bus.js').EventBus} [bus] session bus (falls back to page bus) */
    static notifyChanged(bus) {
      (bus || defaultBus).dispatch(AppEvents.RESPONSE_CHANGED);
    }
    // ── Static dispatcher ────────────────────────────────────────────────────
    // Every node has its correct class prototype throughout its lifecycle:
    //   - fhirItemToNode uses createItemNode/createGroupNode (correct class)
    //   - answer-type-modal.js calls Object.setPrototypeOf on type-change
    // So node.renderPreview() always dispatches to the right implementation.
    static dispatch(res, container, rc) {
      if (!res) return;
      res.node.renderPreview(res, container, rc);
    }
    // ── Preview rendering entry point ─────────────────────────────────────────
    // Called by BaseNode.dispatch(). rc = _rc from render-ctx.js.
    renderPreview(res, container, rc) {
      this._ensureBusListeners(rc);
      if (!res.visible && !res.showDimmed) return;
      const isPatient = rc.previewMode === "patient";
      if (res.hidden && (isPatient || !rc.viewPrefs.showHiddenItems)) return;
      if (rc.cellMode && this.type === "item") {
        if (!res.visible) return;
        const row2 = this._makePreviewRow("lform-item gtable-cell-item");
        res._iconEl = null;
        this._buildRowContent(row2, res, rc);
        container.appendChild(row2);
        return;
      }
      if (this._usageMode) {
        const m = this._usageMode;
        const hiddenInPatient = m === "display" || m === "display-non-empty";
        if (isPatient && hiddenInPatient) return;
        if (!isPatient && hiddenInPatient) res._usageModeHidden = true;
      }
      if (!res.visible && res.showDimmed) {
        if (!isPatient) this._renderDimmed(res, container, rc);
        return;
      }
      if (res.disabled) {
        this._renderDisabled(res, container, rc);
        return;
      }
      const row = this._createBaseRow(res, rc);
      this._buildRowContent(row, res, rc);
      const target = this._appendRow(row, res, container);
      this._renderChildren(res, target, rc);
    }
    // ── Dimmed state (enableWhen condition not yet met) ───────────────────────
    // Only reached in the builder/design preview (patient view removes disabled
    // items earlier). Every disabled item is shown dimmed here regardless of
    // disabledDisplay — the author always sees the full form. The hidden/protected
    // distinction only takes effect in patient view.
    _renderDimmed(res, container, rc) {
      const row = this._makePreviewRow("lform-item lform-waiting" + (rc.showNavBtn ? " preview-row--pointer" : ""));
      if (rc.showNavBtn) {
        row.dataset.tipTitle = "Click to navigate to builder node";
        row.addEventListener("click", () => rc.bus.dispatch(AppEvents.BUILDER_NAVIGATE_TO, { nodeId: this.id }));
      }
      const ph = document.createElement("span");
      ph.className = "preview-icon-ph";
      row.appendChild(ph);
      const label = document.createElement("span");
      label.className = "preview-label--dim";
      label.textContent = (this.type === "group" ? "Group: " : "Item: ") + this.title;
      row.appendChild(label);
      const hint = document.createElement("span");
      hint.className = "preview-condition-hint preview-condition-waiting";
      hint.dataset.testid = "preview-condition-hint";
      const dimText = this._enableWhenText || this.enableWhenExpression || "condition not met";
      hint.textContent = "\u{1F512} " + dimText;
      if (this.enableWhenExpression) {
        hint.dataset.tipTitle = "Visibility condition";
        hint.dataset.tipBody = "Not met. FHIRPath: " + this.enableWhenExpression + (rc.showExplain ? "\n\nClick to explain." : "");
        hint.dataset.tipFhir = "sdc-questionnaire-enableWhenExpression";
        hint.dataset.tipSpec = "SDC";
        if (rc.showExplain) {
          hint.classList.add("preview-condition-hint--explain");
          const expr = this.enableWhenExpression;
          hint.addEventListener("click", (e) => {
            e.stopPropagation();
            if (rc.lastCtx.fp) show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
          });
        }
      } else {
        const audit = buildEnableWhenAudit(this.enableWhen, this.enableBehavior, rc.getAll);
        hint.dataset.tipTitle = "Visibility condition";
        hint.dataset.tipBody = audit ? audit + "\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder." : "Not yet met: " + dimText + "\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.";
        hint.dataset.tipFhir = "Questionnaire.item.enableWhen[]";
        hint.dataset.tipSpec = "R4";
        this._attachEnableWhenAudit(hint, rc);
      }
      row.appendChild(hint);
      container.appendChild(row);
      this._renderDimmedChildren(res, container, rc);
    }
    // Make a standard-enableWhen condition hint clickable → open a modal explaining
    // why the item is hidden (each condition, expected vs actual). Useful in the
    // embedded widget where there is no builder Show When panel to inspect.
    _attachEnableWhenAudit(hint, rc) {
      if (!rc.showExplain || !this.enableWhen?.length) return;
      hint.classList.add("preview-condition-hint--explain");
      hint.addEventListener("click", (e) => {
        e.stopPropagation();
        const data = buildEnableWhenRows(this.enableWhen, this.enableBehavior, rc.getAll);
        if (data) showAudit("Visibility condition", data);
      });
    }
    // Override in GroupNode to render children even when dimmed (keeps counts in sync).
    _renderDimmedChildren(_res, _container, _rc2) {
    }
    // ── Disabled state (group conditionRule not met → N/A) ───────────────────
    _renderDisabled(res, container, rc) {
      if (rc.previewMode === "patient") return;
      const row = this._makePreviewRow("lform-item lform-disabled" + (rc.showNavBtn ? " preview-row--pointer" : ""));
      if (rc.showNavBtn) {
        row.addEventListener("click", () => rc.bus.dispatch(AppEvents.BUILDER_NAVIGATE_TO, { nodeId: this.id }));
      }
      const naIcon = document.createElement("span");
      naIcon.className = "icon-na";
      row.appendChild(naIcon);
      const label = document.createElement("span");
      if (this.type === "group") label.className = "group-label";
      label.textContent = (this.type === "group" ? "Group: " : "Item: ") + this.title;
      row.appendChild(label);
      container.appendChild(row);
      this._renderDisabledChildren(res, container, rc);
    }
    // Override in GroupNode.
    _renderDisabledChildren(_res, _container, _rc2) {
    }
    // ── Base row: nav btn + icon/ph + linkId + hidden badge + prefix ──────────
    _createBaseRow(res, rc) {
      const isPatient = rc.previewMode === "patient";
      const row = this._makePreviewRow("lform-item");
      if (res.hiddenRoot || res._usageModeHidden) row.classList.add("lform-item--hidden");
      if (!isPatient && rc.showNavBtn) {
        const navBtn = document.createElement("span");
        navBtn.className = "preview-nav-btn";
        navBtn.dataset.testid = "preview-nav-btn";
        navBtn.textContent = "\u2197";
        navBtn.dataset.tipTitle = "Go to builder node";
        navBtn.dataset.tipBody = "Scroll and highlight the corresponding node in the builder panel.";
        navBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          rc.bus.dispatch(AppEvents.BUILDER_NAVIGATE_TO, { nodeId: this.id });
        });
        row.appendChild(navBtn);
      }
      const { hasCondition, displayOk } = this._evalCondition(res, rc);
      let iconEl = null;
      if (!isPatient) {
        if (hasCondition && !res.hidden) {
          iconEl = document.createElement("span");
          iconEl.className = displayOk ? "icon-ok" : "icon-fail";
          iconEl.textContent = displayOk ? "\u2713" : "\u2717";
          row.appendChild(iconEl);
        } else {
          const ph = document.createElement("span");
          ph.className = "preview-icon-ph";
          row.appendChild(ph);
        }
      }
      res._iconEl = iconEl;
      this._iconEl = iconEl;
      if (rc.viewPrefs.showLinkId && !isPatient) row.appendChild(this._buildLinkIdTag(rc));
      if (res.hiddenRoot && !isPatient) {
        const b = document.createElement("span");
        b.className = "preview-hidden-badge";
        b.textContent = "HIDDEN";
        b.dataset.tipTitle = "sdc-questionnaire-hidden";
        b.dataset.tipBody = "This item is permanently hidden from patients. It still participates in calculatedExpression logic. Controls are disabled in preview.";
        b.dataset.tipFhir = "sdc-questionnaire-hidden";
        b.dataset.tipSpec = "SDC";
        row.appendChild(b);
      }
      if (this._usageMode && !isPatient) {
        const um = document.createElement("span");
        um.className = "preview-hidden-badge";
        um.textContent = this._usageMode;
        um.dataset.tipTitle = "questionnaire-usageMode";
        um.dataset.tipBody = `Usage mode: "${this._usageMode}". Controls when this item is shown:
\u2022 capture \u2014 only during data entry
\u2022 display \u2014 only when displaying completed data
\u2022 display-non-empty \u2014 display only if answered
\u2022 capture-display \u2014 both modes
\u2022 capture-display-non-empty \u2014 capture always, display only if answered`;
        um.dataset.tipFhir = "item.extension[questionnaire-usageMode].valueCode";
        um.dataset.tipSpec = "R4";
        row.appendChild(um);
      }
      if (this._shortText && !isPatient) {
        const st = document.createElement("span");
        st.className = "preview-short-text-badge";
        st.textContent = this._shortText;
        st.dataset.tipTitle = "sdc-questionnaire-shortText";
        st.dataset.tipBody = `Short Text: "${this._shortText}" \u2014 abbreviated label used in summary views.`;
        st.dataset.tipFhir = "item.extension[sdc-questionnaire-shortText].valueString";
        st.dataset.tipSpec = "SDC";
        row.appendChild(st);
      }
      if (this._signatureRequired?.length) {
        const labels = this._signatureRequired.map((s) => s.display || s.code).join(", ");
        const sb = document.createElement("span");
        sb.className = "preview-meta-badge preview-meta-badge--sig";
        sb.textContent = "\u{1F50F} " + labels;
        sb.dataset.tipTitle = "Signature required";
        sb.dataset.tipBody = "A digital signature is required for this item.\nType(s): " + labels;
        sb.dataset.tipFhir = "item.extension[questionnaire-signatureRequired].valueCodeableConcept";
        sb.dataset.tipSpec = "R4";
        row.appendChild(sb);
      }
      if (this._isSubject && !isPatient) {
        const sub = document.createElement("span");
        sub.className = "preview-meta-badge preview-meta-badge--subject";
        sub.dataset.testid = "preview-subject-badge";
        sub.textContent = "SUBJECT";
        sub.dataset.tipTitle = "sdc-questionnaire-isSubject";
        sub.dataset.tipBody = "This item\u2019s answer identifies the subject of the QuestionnaireResponse (QuestionnaireResponse.subject). Used by SDC servers when generating the response \u2014 has no effect on the patient-facing control.";
        sub.dataset.tipFhir = "item.extension[sdc-questionnaire-isSubject].valueBoolean";
        sub.dataset.tipSpec = "SDC";
        row.appendChild(sub);
      }
      if (this._prefix && rc.viewPrefs.showPrefix) {
        const pfx = document.createElement("span");
        pfx.className = "preview-prefix";
        if (this.type === "group") pfx.classList.add("preview-prefix--group");
        pfx.textContent = this._prefix;
        row.appendChild(pfx);
      }
      return row;
    }
    // Compute hasCondition / displayOk for the icon. Overridden in GroupNode and ItemNode.
    _evalCondition(_res, _rc2) {
      return { hasCondition: false, displayOk: true };
    }
    // True when this container's own children govern its aggregate pass/fail — i.e.
    // it has no calculatedExpression of its own AND has ≥1 enforceable descendant.
    // When false, the AND/OR "ALL/ANY items" badge and the child AND/OR separators
    // carry no meaning and are suppressed.
    _hasChildLogic(rc) {
      if (this._calculatedExpr) return false;
      return rc.visible.some((r) => r.node.type === "item" && !r.disabled && !r.hidden && isDescendant(r.node.id, this) && isRelevantItem(r.node, rc));
    }
    // Build linkId tag (same structure for all node types).
    _buildLinkIdTag(_rc2) {
      const it = this.itemType;
      const valExample = it === "checkbox" ? "true / false" : it === "integer" ? "42 (valueInteger)" : it === "decimal" ? "3.14 (valueDecimal)" : it === "number" ? "42" : it === "date" ? '"2024-01-15"' : it === "select" || it === "radio" || it === "open-choice" ? '"option-code"' : it === "quantity" ? '{ value: 70, unit: "kg" }' : '"text value"';
      const tag = document.createElement("span");
      tag.className = "preview-linkid";
      tag.dataset.testid = "preview-linkid";
      tag.textContent = this.id;
      tag.dataset.tipTitle = "linkId: " + this.id;
      tag.dataset.tipBody = "In visibility rules:  values['" + this.id + "']\nExpected value:  " + valExample + (it ? "\nItem type:  " + it : "") + "\nClick to copy linkId to clipboard.";
      tag.dataset.tipFhir = "Questionnaire.item.linkId";
      tag.dataset.tipSpec = "R4";
      tag.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(this.id).catch(() => {
        });
        tag.textContent = "\u2713 copied";
        setTimeout(() => {
          tag.textContent = this.id;
        }, 1200);
      });
      return tag;
    }
    // Apply XHTML / markdown / plain text to label element.
    // Priority: rendering-xhtml > rendering-markdown > translation > plain text.
    _applyLabelContent(el, rc) {
      const domPurify = window.DOMPurify;
      const marked = window.marked;
      const lang = rc?.activeLanguage;
      if (lang && rc?.translations?.[lang]?.xhtml?.[this.id] != null) {
        el.innerHTML = domPurify ? domPurify.sanitize(rc.translations[lang].xhtml[this.id]) : "";
        return;
      }
      if (lang && rc?.translations?.[lang]?.markdown?.[this.id] != null) {
        const md = rc.translations[lang].markdown[this.id];
        el.innerHTML = domPurify && marked ? domPurify.sanitize(marked.parseInline(md)) : md;
        return;
      }
      if (lang && rc?.translations?.[lang]?.items?.[this.id] != null) {
        el.textContent = rc.translations[lang].items[this.id];
        return;
      }
      if (this._renderXhtml && domPurify) {
        el.innerHTML = domPurify.sanitize(this._renderXhtml);
      } else if (this._renderMarkdown && domPurify && marked) {
        el.innerHTML = domPurify.sanitize(marked.parseInline(this._renderMarkdown));
      } else {
        el.textContent = this.title;
      }
    }
    // Build the label element. Overridden in GroupNode, ItemNode, DisplayNode.
    // rc is optional — passed during preview render for translation lookup.
    _buildLabel(_res, rc) {
      const el = document.createElement("span");
      this._applyLabelContent(el, rc);
      return el;
    }
    // Build support-link icons/buttons. Same logic for all node types.
    _buildSupportLinks(row, rc) {
      if (!this._supportLinks || !this._supportLinks.length) return;
      const validLinks = this._supportLinks.filter((u) => u && u.trim());
      const isPatient = rc.previewMode === "patient";
      for (const url of validLinks) {
        if (!/^https?:|^mailto:/i.test(url.trim())) continue;
        if (isPatient) {
          const btn = document.createElement("a");
          btn.className = "support-link-patient-btn";
          btn.dataset.testid = "support-link-patient-btn";
          btn.href = url;
          btn.target = "_blank";
          btn.rel = "noopener noreferrer";
          btn.textContent = uiStr("more_info", rc);
          row.appendChild(btn);
        } else {
          const icon = document.createElement("a");
          icon.className = "support-link-icon";
          icon.dataset.testid = "support-link-icon";
          icon.href = url;
          icon.target = "_blank";
          icon.rel = "noopener noreferrer";
          icon.textContent = "\u{1F517}";
          icon.dataset.tipTitle = "Support link";
          icon.dataset.tipBody = url;
          icon.dataset.tipFhir = "Questionnaire.item.extension[questionnaire-supportLink]";
          icon.dataset.tipSpec = "R4";
          icon.addEventListener("click", (e) => e.stopPropagation());
          row.appendChild(icon);
        }
      }
    }
    // Shared visibility-condition hint. Used by both GroupNode and ItemNode.
    _buildVisHint(row, rc) {
      const isPatient = rc.previewMode === "patient";
      const visText = this._enableWhenText || this.enableWhenExpression;
      if (!isPatient && visText) {
        const hint = document.createElement("span");
        hint.className = "preview-condition-hint";
        hint.dataset.testid = "preview-condition-hint";
        hint.textContent = "\u{1F441}\uFE0F " + visText;
        if (this.enableWhenExpression) {
          hint.dataset.tipTitle = "Visibility condition";
          hint.dataset.tipBody = "FHIRPath: " + this.enableWhenExpression + (rc.showExplain ? "\n\nClick to explain." : "");
          hint.dataset.tipFhir = "sdc-questionnaire-enableWhenExpression";
          hint.dataset.tipSpec = "SDC";
          if (rc.showExplain) {
            hint.classList.add("preview-condition-hint--explain");
            const expr = this.enableWhenExpression;
            hint.addEventListener("click", () => {
              if (rc.lastCtx.fp) show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
            });
          }
        } else {
          hint.dataset.tipTitle = "Visibility condition";
          hint.dataset.tipBody = "This item is shown only when: " + visText + "\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.";
          hint.dataset.tipFhir = "Questionnaire.item.enableWhen[]";
          hint.dataset.tipSpec = "R4";
          this._attachEnableWhenAudit(hint, rc);
        }
        row.appendChild(hint);
      }
    }
    // Add label + support links + vis hint. Override in subclasses to add more.
    _buildRowContent(row, res, rc) {
      const label = this._buildLabel(res, rc);
      if (this._renderStyle) applyRenderStyle(label, this._renderStyle);
      row.appendChild(label);
      this._buildSupportLinks(row, rc);
      this._buildVisHint(row, rc);
    }
    // Append row to container, handling hidden-group wrapper. Returns actual target element.
    _appendRow(row, res, container) {
      if ((res.hiddenRoot || res._usageModeHidden) && this.type === "group") {
        const wrap = document.createElement("div");
        wrap.className = "lform-item--hidden";
        container.appendChild(wrap);
        row.classList.remove("lform-item--hidden");
        wrap.appendChild(row);
        return wrap;
      }
      container.appendChild(row);
      return container;
    }
    // ── Preview collapse toggle (shared by GroupNode and ItemNode-with-children) ─
    // Inserts ▶/▼ as the first child of `row` when this node has children.
    _buildPreviewCollapseToggle(row) {
      if (!this.children?.length) return;
      const collapsed = this._previewCollapsed;
      const toggle = document.createElement("span");
      toggle.className = "preview-collapse-toggle";
      toggle.textContent = collapsed ? "\u25B6" : "\u25BC";
      toggle.dataset.tipTitle = collapsed ? "Expand section" : "Collapse section";
      const node = this;
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        node._previewCollapsed = !node._previewCollapsed;
        _BaseNode.notifyChanged(node._bus);
      });
      row.insertBefore(toggle, row.firstChild);
    }
    // Render children with AND/OR separators, skipping separators adjacent to display/info items.
    // Used by both GroupNode and ItemNode (when it has sub-items).
    _appendChildRows(nested, rc) {
      const logic = this.logicWithParent || "AND";
      const showSep = this._hasChildLogic(rc);
      let lastVisibleIsInfo = true;
      for (const ch of this.children) {
        const childRes = rc.resultMap.get(ch.id);
        if (childRes && childRes.hidden && (rc.previewMode === "patient" || !rc.viewPrefs.showHiddenItems)) continue;
        if (childRes && (childRes.visible || childRes.showDimmed)) {
          const isInfo = ch.itemType === "display" || ch.type === "group" && !ch.children?.length;
          if (showSep && !isInfo && !lastVisibleIsInfo && childRes.visible) {
            const sep = document.createElement("div");
            sep.className = "logic-separator logic-separator-" + logic.toLowerCase();
            sep.textContent = logic === "OR" ? uiStr("or_separator", rc) : uiStr("and_separator", rc);
            nested.appendChild(sep);
          }
          _BaseNode.dispatch(childRes, nested, rc);
          if (childRes.visible) lastVisibleIsInfo = isInfo;
        }
      }
    }
    // Simple nested children render — no separators, no repeating instances.
    // Used by GroupNode (dimmed/disabled paths) and ItemNode (always).
    _renderNestedChildren(_res, container, rc) {
      if (!this.children?.length) return;
      const nested = document.createElement("div");
      nested.className = "preview-nested";
      for (const ch of this.children) {
        const childRes = rc.resultMap.get(ch.id);
        if (childRes) _BaseNode.dispatch(childRes, nested, rc);
      }
      if (nested.childElementCount > 0) container.appendChild(nested);
    }
    // Render children into target. No-op in base; overridden in GroupNode and ItemNode.
    _renderChildren(_res, _target, _rc2) {
    }
    // ── DnD ownership ─────────────────────────────────────────────────────────
    /** Whether this node can be dragged. Override to return false to lock. */
    isDraggable() {
      return true;
    }
    // ── Collapse button (shared by GroupNode and ItemNode-with-children) ──────
    // `div` is the outer node card element; used to find `.node-body` on toggle.
    _buildCollapseBtn(div) {
      const collapsed = _BaseNode._collapseMap.get(this.id) || false;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "node-collapse-btn";
      btn.dataset.testid = "group-collapse-btn";
      btn.textContent = collapsed ? "\u25B6" : "\u25BC";
      btn.dataset.tipTitle = collapsed ? "Expand" : "Collapse";
      btn.onclick = (e) => {
        e.stopPropagation();
        const isNowCollapsed = !(_BaseNode._collapseMap.get(this.id) || false);
        _BaseNode._collapseMap.set(this.id, isNowCollapsed);
        btn.textContent = isNowCollapsed ? "\u25B6" : "\u25BC";
        btn.dataset.tipTitle = isNowCollapsed ? "Expand" : "Collapse";
        const body = div.querySelector(".node-body");
        if (body) body.style.display = isNowCollapsed ? "none" : "";
      };
      return btn;
    }
    // ── Builder event dispatch ─────────────────────────────────────────────────
    // Breaks circular imports: index.js and preview-form.js both import nodes,
    // so nodes cannot import back. Events decouple the call direction.
    /**
     * Wire the BUILDER_NAVIGATE_TO event for this node's root builder element.
     * Call once at the start of buildBuilder(), passing the node div.
     * Uses AbortController so each re-render cleanly replaces the previous listener.
     */
    _initNavListener(el) {
      this._navAbort?.abort();
      this._navAbort = new AbortController();
      document.addEventListener(AppEvents.BUILDER_NAVIGATE_TO, (e) => {
        if (e.detail?.nodeId !== this.id) return;
        const panel = document.querySelector(".left-panel-body");
        if (panel) {
          const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 10;
          panel.scrollTo({ top, behavior: "instant" });
        } else {
          el.scrollIntoView({ behavior: "instant", block: "start" });
        }
        el.classList.add("node-flash");
        setTimeout(() => el.classList.remove("node-flash"), 1e3);
      }, { signal: this._navAbort.signal });
    }
    /** Triggers renderTree() in builder/index.js */
    _dispatchRerender() {
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }
    /** Navigates the right-panel preview to this node */
    _dispatchNavigate() {
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE, { detail: { id: this.id } }));
    }
    // ── Preview row factory & scroll-to listener ───────────────────────────────
    /**
     * Create a preview row div, register it as this._previewEl, and return it.
     * All three render paths (_renderDimmed, _renderDisabled, _createBaseRow) go through
     * here so _previewEl always points to the most-recently rendered element.
     */
    _makePreviewRow(className) {
      const row = document.createElement("div");
      row.className = className;
      row.dataset.previewId = this.id;
      this._previewEl = row;
      if (this._scrollAfterRender) {
        this._scrollAfterRender = false;
        requestAnimationFrame(() => this._scrollIntoView());
      }
      return row;
    }
    _scrollIntoView() {
      if (!this._previewEl || !document.contains(this._previewEl)) return;
      this._previewEl.scrollIntoView({ behavior: "smooth", block: "center" });
      this._previewEl.classList.add("preview-flash");
      setTimeout(() => this._previewEl?.classList.remove("preview-flash"), 1e3);
    }
    /**
     * Wire the PREVIEW_NAVIGATE_TO listener for this node instance.
     * Called once from the constructor (with a DOM guard for test environments).
     * If _previewEl is already in DOM — scroll immediately.
     * Otherwise set _scrollAfterRender so _makePreviewRow scrolls after the next render.
     */
    _initPreviewNavListener(bus) {
      bus.on(AppEvents.PREVIEW_NAVIGATE_TO, (e) => {
        if (e.detail?.id !== this.id) return;
        if (this._previewEl && document.contains(this._previewEl)) {
          this._scrollIntoView();
        } else {
          this._scrollAfterRender = true;
          requestAnimationFrame(() => {
            if (this._scrollAfterRender && this._previewEl && document.contains(this._previewEl)) {
              this._scrollAfterRender = false;
              this._scrollIntoView();
            }
          });
        }
      }, { signal: this._ac.signal });
    }
  };

  // js/nodes/gtable-renderer.js
  var GTableRenderer = class {
    /** @param {import('./group-node.js').GroupNode} group */
    constructor(group) {
      this._group = group;
    }
    /**
     * Render the group as a table into `target`.
     * @param {HTMLElement} target
     * @param {object}      rc       render context from preview-form.js
     * @param {Array}       [instancePath=[]]  parent instance path (for nested groups)
     */
    render(target, rc, instancePath = []) {
      const group = this._group;
      const table = document.createElement("table");
      table.className = "gtable";
      table.dataset.testid = "gtable";
      table.dataset.gtableId = group.id;
      const thead = table.createTHead();
      const headerRow = thead.insertRow();
      const isPatient = rc.previewMode === "patient";
      for (const ch of group.children) {
        const th = document.createElement("th");
        th.className = "gtable-th";
        const titleSpan = document.createElement("span");
        titleSpan.className = "gtable-th-title";
        titleSpan.textContent = ch.title || ch.id;
        if (ch.mandatory === true) {
          const star = document.createElement("span");
          star.className = "gtable-required-star";
          star.textContent = " *";
          titleSpan.appendChild(star);
        }
        th.appendChild(titleSpan);
        if (!isPatient) {
          const indRow = document.createElement("div");
          indRow.className = "gtable-th-indicators";
          this._buildColIndicators(indRow, ch, rc);
          if (indRow.childElementCount > 0) th.appendChild(indRow);
        }
        headerRow.appendChild(th);
      }
      if (group.repeats) {
        const actionTh = document.createElement("th");
        actionTh.className = "gtable-th gtable-th-action";
        headerRow.appendChild(actionTh);
      }
      const tbody = table.createTBody();
      if (group.repeats) {
        this._renderRepeatingRows(tbody, rc, instancePath);
      } else {
        const tr = tbody.insertRow();
        this._appendCells(tr, rc);
      }
      if (group.repeats) {
        const count = rc.instanceCount(group.id, instancePath);
        const max = group._maxOccurs;
        const atMax = max !== void 0 && count >= max;
        const tfoot = table.createTFoot();
        const footTr = tfoot.insertRow();
        const footTd = document.createElement("td");
        footTd.colSpan = group.children.length + 1;
        footTd.className = "gtable-tfoot-td";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "repeat-add-btn gtable-add-btn";
        addBtn.dataset.testid = "gtable-add-btn";
        addBtn.textContent = "+ Add row";
        addBtn.disabled = atMax;
        if (atMax) {
          addBtn.dataset.tipTitle = `Maximum ${max} row${max === 1 ? "" : "s"} reached`;
        }
        addBtn.addEventListener("click", () => {
          if (!atMax) {
            rc.addInstance(group.id, instancePath);
            BaseNode.notifyChanged(rc.bus);
          }
        });
        footTd.appendChild(addBtn);
        footTr.appendChild(footTd);
      }
      target.appendChild(table);
    }
    // ── Repeating rows: one <tr> per instance ────────────────────────────────
    _renderRepeatingRows(tbody, rc, instancePath) {
      const group = this._group;
      const min = group._minOccurs != null && group._minOccurs > 0 ? group._minOccurs : 1;
      let count = rc.instanceCount(group.id, instancePath);
      while (count < min) {
        rc.addInstance(group.id, instancePath);
        count++;
      }
      const saved = { map: rc.resultMap, visible: rc.visible, path: rc.instancePath };
      for (let i = 0; i < count; i++) {
        const instPath = [...instancePath, { id: group.id, idx: i }];
        rc.instancePath = instPath;
        const instResults = rc.evalChildren(group.children, instPath);
        rc.resultMap = new Map(instResults.map((r) => [r.node.id, r]));
        rc.visible = instResults;
        const tr = tbody.insertRow();
        this._appendCells(tr, rc);
        const actionTd = document.createElement("td");
        actionTd.className = "gtable-td-action";
        if (count > min) {
          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "repeat-remove-btn gtable-rm-btn";
          rm.textContent = "\xD7";
          rm.dataset.testid = "gtable-remove-btn";
          rm.dataset.tipTitle = "Remove this row";
          const _i = i;
          rm.addEventListener("click", () => {
            rc.removeInstance(group.id, _i, instancePath);
            BaseNode.notifyChanged(rc.bus);
          });
          actionTd.appendChild(rm);
        }
        tr.appendChild(actionTd);
        rc.resultMap = saved.map;
        rc.visible = saved.visible;
        rc.instancePath = saved.path;
      }
    }
    // ── Cell rendering: one <td> per child ───────────────────────────────────
    _appendCells(tr, rc) {
      const prevCellMode = rc.cellMode;
      for (const ch of this._group.children) {
        const td = document.createElement("td");
        td.className = "gtable-td";
        const childRes = rc.resultMap.get(ch.id);
        if (childRes) {
          rc.cellMode = ch.type === "item";
          BaseNode.dispatch(childRes, td, rc);
        }
        tr.appendChild(td);
      }
      rc.cellMode = prevCellMode;
    }
    // ── Column header indicators: per-column static metadata ─────────────────
    // Shows small icon badges in the column <th> for properties that are the same
    // for every row: enableWhen condition, readOnly, calculatedExpression,
    // constraint, support links.
    _buildColIndicators(th, ch, _rc2) {
      if (ch.enableWhen?.length || ch.enableWhenExpression) {
        const ind = document.createElement("span");
        ind.className = "gtable-col-ind";
        ind.textContent = "\u{1F441}";
        ind.dataset.tipTitle = "Conditional column";
        ind.dataset.tipBody = ch._enableWhenText || ch.enableWhenExpression || "This column has a Show When (enableWhen) condition.";
        ind.dataset.tipFhir = "Questionnaire.item.enableWhen[]";
        ind.dataset.tipSpec = "R4";
        th.appendChild(ind);
      }
      if (ch._readOnly && !ch._calculatedExpr) {
        const ind = document.createElement("span");
        ind.className = "gtable-col-ind";
        ind.textContent = "\u{1F512}";
        ind.dataset.tipTitle = "Read-only column";
        ind.dataset.tipBody = "Values in this column are read-only (item.readOnly).";
        ind.dataset.tipFhir = "Questionnaire.item.readOnly";
        ind.dataset.tipSpec = "R4";
        th.appendChild(ind);
      }
      if (ch._calculatedExpr) {
        const ind = document.createElement("span");
        ind.className = "gtable-col-ind";
        ind.textContent = "\u26A1";
        ind.dataset.tipTitle = "Calculated column";
        ind.dataset.tipBody = "Values in this column are computed by: " + ch._calculatedExpr;
        ind.dataset.tipFhir = "sdc-questionnaire-calculatedExpression";
        ind.dataset.tipSpec = "SDC";
        th.appendChild(ind);
      }
      if (ch.constraint?.length) {
        const msgs = ch.constraint.map((c) => c.human || c.expression || c.key).filter(Boolean);
        const ind = document.createElement("span");
        ind.className = "gtable-col-ind";
        ind.textContent = "\u26A0\uFE0F";
        ind.dataset.tipTitle = "Has constraint";
        ind.dataset.tipBody = msgs.join("\n") || "questionnaire-constraint on this column";
        ind.dataset.tipFhir = "Questionnaire.item.extension[questionnaire-constraint]";
        ind.dataset.tipSpec = "R4";
        th.appendChild(ind);
      }
      if (ch._supportLinks?.length) {
        const validLinks = ch._supportLinks.filter((u) => u && /^https?:/i.test(u));
        for (const url of validLinks) {
          const a = document.createElement("a");
          a.className = "gtable-col-ind support-link-icon";
          a.textContent = "\u{1F517}";
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.dataset.tipTitle = "Support link";
          a.dataset.tipBody = url;
          a.dataset.tipFhir = "Questionnaire.item.extension[questionnaire-supportLink]";
          a.dataset.tipSpec = "R4";
          a.addEventListener("click", (e) => e.stopPropagation());
          th.appendChild(a);
        }
      }
      if (ch.mandatory === false && ch.type === "item") {
        const ind = document.createElement("span");
        ind.className = "gtable-col-ind gtable-col-ind--optional";
        ind.textContent = "optional";
        ind.dataset.tipTitle = "Optional column";
        ind.dataset.tipBody = "This field is not required (item.required: false).";
        ind.dataset.tipFhir = "Questionnaire.item.required";
        ind.dataset.tipSpec = "R4";
        th.appendChild(ind);
      }
    }
  };

  // js/nodes/group-node.js
  var GroupNode = class _GroupNode extends BaseNode {
    /** Backward-compat: delegates to BaseNode._collapseMap (shared with ItemNode). */
    static get _collapseMap() {
      return BaseNode._collapseMap;
    }
    constructor(data = {}) {
      super(data);
      this.type = "group";
      this.logicWithParent = data.logicWithParent ?? "AND";
      this.children = data.children ?? [];
      this.repeats = data.repeats ?? false;
    }
    /** Abort own listeners and recursively destroy children. */
    destroy() {
      super.destroy();
      this.children.forEach((c) => c.destroy());
    }
    // ── Condition icon logic for groups ──────────────────────────────────────
    _evalCondition(res, rc) {
      if (this._calculatedExpr) {
        if (this.constraint?.length) {
          const { ctx: rcCtx, cEnv: rcCEnv } = rc;
          return { hasCondition: true, displayOk: rc.evalConstraints(this, rcCtx.fp, rcCtx.qr, rcCEnv) };
        }
        return { hasCondition: false, displayOk: true };
      }
      const descendantItems = rc.visible.filter(
        (r) => r.node.type === "item" && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
      );
      const relevantItems = descendantItems.filter((r) => isRelevantItem(r.node, rc));
      if (relevantItems.length === 0) return { hasCondition: false, displayOk: true };
      const { ctx, cEnv } = rc;
      const itemOk = (k) => k.ok && rc.calcFormOk(k.node) && (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, cEnv));
      const displayOk = this.logicWithParent === "OR" ? relevantItems.some(itemOk) : relevantItems.every(itemOk);
      return { hasCondition: true, displayOk };
    }
    // ── Re-evaluate pass/fail icon for this group after a value change ────────
    // Called by render-node.js updateGroupIcons() which iterates groupIconMap.
    refreshIcon(rc) {
      const entry = rc.groupIconMap.get(this.id);
      if (!entry) return;
      const { icon, descendants } = entry;
      const { ctx } = rc;
      if (this._calculatedExpr) {
        if (this.constraint?.length) {
          const ok2 = rc.evalConstraints(this, ctx.fp, ctx.qr, ctx.envVars || {});
          icon.className = ok2 ? "icon-ok" : "icon-fail";
          icon.textContent = ok2 ? "\u2713" : "\u2717";
        } else {
          icon.className = "icon-ok";
          icon.textContent = "\u2713";
        }
        return;
      }
      const relevant = descendants.filter((r) => isRelevantItem(r.node, rc));
      if (relevant.length === 0) {
        icon.className = "icon-ok";
        icon.textContent = "\u2713";
        return;
      }
      const itemOk = (k) => k.ok && rc.calcFormOk(k.node) && (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
      const ok = this.logicWithParent === "OR" ? relevant.some(itemOk) : relevant.every(itemOk);
      icon.className = ok ? "icon-ok" : "icon-fail";
      icon.textContent = ok ? "\u2713" : "\u2717";
    }
    // ── Label: group-label class, XHTML support ───────────────────────────────
    _buildLabel(_res, rc) {
      const isEmptyGroup = this.children.length === 0;
      const el = document.createElement("span");
      el.className = isEmptyGroup ? "display-info-label" : "group-label";
      this._applyLabelContent(el, rc);
      return el;
    }
    // ── Row content: super + logic badge + collapse toggle (groups with children) ─
    _buildRowContent(row, res, rc) {
      super._buildRowContent(row, res, rc);
      const isPatient = rc.previewMode === "patient";
      const isEmptyGroup = this.children.length === 0;
      if (this._itemControl === "header" || this._itemControl === "footer") {
        row.classList.add("lform-group-" + this._itemControl);
        if (!isPatient) {
          const badge = document.createElement("span");
          badge.className = "preview-group-ctrl-badge";
          badge.textContent = this._itemControl;
          badge.dataset.tipTitle = this._itemControl === "header" ? "Group header" : "Group footer";
          badge.dataset.tipBody = this._itemControl === "header" ? "This group is rendered as a header \u2014 continuously visible at the top of the questionnaire." : "This group is rendered as a footer \u2014 continuously visible at the bottom of the questionnaire.";
          badge.dataset.tipFhir = "item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = " + this._itemControl;
          badge.dataset.tipSpec = "R4";
          row.appendChild(badge);
        }
      }
      if (this._itemControl === "gtable" && !isPatient) {
        const badge = document.createElement("span");
        badge.className = "preview-group-ctrl-badge preview-group-ctrl-badge--gtable";
        badge.textContent = "gtable";
        badge.dataset.testid = "gtable-badge";
        badge.dataset.tipTitle = "Group table layout (gtable)";
        badge.dataset.tipBody = "This group is rendered as a table \u2014 each child item is a column, each repeat instance is a row.";
        badge.dataset.tipFhir = "item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = gtable";
        badge.dataset.tipSpec = "R4 \xB7 SDC";
        row.appendChild(badge);
      }
      if (this.repeats && !isPatient) {
        const rb = document.createElement("span");
        rb.className = "preview-group-ctrl-badge";
        rb.textContent = "Repeatable";
        rb.dataset.tipTitle = "Repeatable group";
        rb.dataset.tipBody = "This group repeats \u2014 the respondent can add multiple entries.";
        rb.dataset.tipFhir = "Questionnaire.item.repeats";
        rb.dataset.tipSpec = "R4";
        row.appendChild(rb);
      }
      if (!isPatient && !isEmptyGroup) {
        if (this._hasChildLogic(rc)) {
          const isOr = this.logicWithParent === "OR";
          const lb = document.createElement("span");
          lb.className = "preview-logic-badge preview-logic-" + (isOr ? "or" : "and");
          lb.textContent = isOr ? "ANY item \u2713" : "ALL items \u2713";
          lb.dataset.tipTitle = isOr ? "Any item passes (OR)" : "All items required (AND)";
          lb.dataset.tipBody = isOr ? "Group is satisfied if at least one child item has a valid answer.\nStored in FHIR as a questionnaire-constraint with key e3a8c2f1\u2026:group-or." : "Group is satisfied only when all child items have valid answers.\nThis is the default FHIR behaviour \u2014 no extra constraint is generated.";
          lb.dataset.tipFhir = isOr ? "questionnaire-constraint (key: ITLH_NS:group-or)" : "item.required (default AND)";
          lb.dataset.tipSpec = "R4";
          row.appendChild(lb);
        }
      }
      if (!isEmptyGroup) {
        this._buildPreviewCollapseToggle(row);
      }
    }
    // ── Dimmed/disabled: also render children to keep counts in sync ─────────
    _renderDimmedChildren(res, container, rc) {
      if (this._previewCollapsed) return;
      this._renderNestedChildren(res, container, rc);
    }
    _renderDisabledChildren(res, container, rc) {
      if (this._previewCollapsed) return;
      this._renderNestedChildren(res, container, rc);
    }
    // ── Children: register groupIconMap, render expanded children with separators ─
    _renderChildren(res, target, rc) {
      if (this.children.length === 0) return;
      const iconEl = res._iconEl;
      const descendants = rc.visible.filter(
        (r) => r.node.type === "item" && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
      );
      if (iconEl) rc.groupIconMap.set(this.id, { icon: iconEl, descendants, node: this });
      if (this._previewCollapsed) return;
      if (this._itemControl === "gtable") {
        new GTableRenderer(this).render(target, rc, rc.instancePath || []);
        return;
      }
      if (this.repeats) {
        this._renderInstances(target, rc);
        return;
      }
      const nested = document.createElement("div");
      nested.className = "preview-nested";
      this._appendChildRows(nested, rc);
      if (nested.childElementCount > 0) target.appendChild(nested);
    }
    // Repeating group: render N instance blocks, each evaluated & rendered with its
    // own instance path so values / enableWhen / validation are scoped per entry.
    _renderInstances(target, rc) {
      const parentPath = rc.instancePath || [];
      const min = this._minOccurs && this._minOccurs > 0 ? this._minOccurs : 1;
      let count = rc.instanceCount(this.id, parentPath);
      while (count < min) {
        rc.addInstance(this.id, parentPath);
        count++;
      }
      const wrap = document.createElement("div");
      wrap.className = "preview-nested rg-instances";
      wrap.dataset.rgGroup = this.id;
      const saved = { map: rc.resultMap, visible: rc.visible, path: rc.instancePath };
      for (let i = 0; i < count; i++) {
        const instPath = [...parentPath, { id: this.id, idx: i }];
        const block = document.createElement("div");
        block.className = "rg-inst";
        if (count > min) {
          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "repeat-remove-btn rg-del";
          rm.textContent = "\xD7";
          rm.dataset.testid = "rg-remove-btn";
          rm.dataset.tipTitle = "Remove this entry";
          const _i = i;
          rm.onclick = () => {
            rc.removeInstance(this.id, _i, parentPath);
            BaseNode.notifyChanged(rc.bus);
          };
          block.appendChild(rm);
        }
        rc.instancePath = instPath;
        const instResults = rc.evalChildren(this.children, instPath);
        rc.resultMap = new Map(instResults.map((r) => [r.node.id, r]));
        rc.visible = instResults;
        this._appendChildRows(block, rc);
        rc.resultMap = saved.map;
        rc.visible = saved.visible;
        rc.instancePath = saved.path;
        wrap.appendChild(block);
      }
      const max = this._maxOccurs;
      const atMax = max !== void 0 && count >= max;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "repeat-add-btn";
      add.dataset.testid = "rg-add-btn";
      add.textContent = "+ Add another entry";
      if (atMax) {
        add.disabled = true;
        add.dataset.tipTitle = "Maximum " + max + " entr" + (max === 1 ? "y" : "ies") + " reached";
      }
      add.onclick = () => {
        if (!atMax) {
          rc.addInstance(this.id, parentPath);
          BaseNode.notifyChanged(rc.bus);
        }
      };
      wrap.appendChild(add);
      target.appendChild(wrap);
    }
    // Refresh pass/fail icons on every rendered group.
    // Called from preview-form.js via _rc.updateGroupIcons after a value change.
    static updateAll(rc) {
      for (const [, { node }] of rc.groupIconMap.entries()) {
        node.refreshIcon(rc);
      }
    }
    // Reset _previewCollapsed on every group node from its _collapsible FHIR value.
    // Called after import / clear so runtime UI state matches the FHIR default.
    static resetCollapsedFromTree(nodes) {
      for (const n of nodes) {
        BaseNode._collapseMap.delete(n.id);
        if (n.children?.length) {
          if (n.type === "group") n._previewCollapsed = n._collapsible === "default-closed";
          _GroupNode.resetCollapsedFromTree(n.children);
        }
      }
    }
  };
  NODE_REGISTRY.set("group", GroupNode);

  // js/nodes/item-node.js
  var ItemNode = class extends BaseNode {
    constructor(data = {}) {
      super(data);
      this.type = "item";
      this.repeats = data.repeats ?? false;
      this.options = data.options ?? "";
      this.constraint = data.constraint ?? [];
      this.children = data.children ?? [];
      this.logicWithParent = data.logicWithParent ?? "AND";
    }
    /** Abort own listeners and recursively destroy children. */
    destroy() {
      super.destroy();
      this.children.forEach((c) => c.destroy());
    }
    /** Build the interactive preview control element for this node.
     *  Overridden by every concrete subclass.
     *  @param {object} ctx  — { getValue, setValue, onChange, _reCalc }
     *  @returns {HTMLElement} wrapper span */
    buildControl(_ctx) {
      throw new Error(`buildControl() not implemented on ${this.constructor.name} (itemType: ${this.itemType})`);
    }
    /** Whether this item type supports repeats. Overridden by CheckboxNode and DisplayNode. */
    supportsRepeat() {
      return true;
    }
    /**
     * Whether repeats is intrinsic to the control (always true, not user-toggleable).
     * Checklist (multi-select check-box) expresses multiple answers via its own
     * checkboxes, so it is inherently repeats:true. Overridden by ChecklistNode.
     */
    impliesRepeats() {
      return false;
    }
    // ── Sub-item children (FHIR R4: non-group items may have item[]) ──────────
    _renderChildren(res, target, rc) {
      if (this._previewCollapsed) return;
      if (!this.children.length) return;
      const nested = document.createElement("div");
      nested.className = "preview-nested";
      this._appendChildRows(nested, rc);
      if (nested.childElementCount > 0) target.appendChild(nested);
    }
    _renderDimmedChildren(res, c, rc) {
      this._renderNestedChildren(res, c, rc);
    }
    _renderDisabledChildren(res, c, rc) {
      this._renderNestedChildren(res, c, rc);
    }
    // ── Condition icon logic for items ────────────────────────────────────────
    _evalCondition(res, rc) {
      const { ctx, cEnv } = rc;
      const constraintPass = this.constraint?.length ? rc.evalConstraints(this, ctx.fp, ctx.qr, cEnv) : true;
      const hasCondition = this.itemType !== "display" && (rc.CHECKABLE_TYPES.has(this.itemType) && (rc.isMandatory(this) || this.itemType === "url") || this._calculatedExpr && this._readOnly && this.itemType === "checkbox" || this.constraint?.length > 0 || (this._minValue !== void 0 || this._maxValue !== void 0) || this._maxDecimalPlaces !== void 0 || this._regex);
      const displayOk = res.ok && rc.calcFormOk(this) && constraintPass;
      return { hasCondition, displayOk };
    }
    // ── Label: XHTML or plain text ────────────────────────────────────────────
    _buildLabel(_res, rc) {
      const el = document.createElement("span");
      this._applyLabelContent(el, rc);
      return el;
    }
    // ── Row content: label + badges + control ─────────────────────────────────
    _buildRowContent(row, res, rc) {
      const isPatient = rc.previewMode === "patient";
      if (rc.cellMode) {
        this._buildControl(row, res, rc);
        this._buildReadOnlyValue(row, rc);
        return;
      }
      const label = this._buildLabel(res, rc);
      if (this._renderStyle) applyRenderStyle(label, this._renderStyle);
      let optionalBadge = null;
      if (this.itemType !== "display" && !this._readOnly) {
        if (this.mandatory === false) {
          if (!isPatient) {
            optionalBadge = document.createElement("span");
            optionalBadge.className = "preview-optional-badge";
            optionalBadge.dataset.testid = "preview-optional-badge";
            optionalBadge.textContent = "optional";
            optionalBadge.dataset.tipTitle = "Optional field";
            optionalBadge.dataset.tipBody = "This field is not required \u2014 the questionnaire response is valid without an answer.";
            optionalBadge.dataset.tipFhir = "item.required: false";
            optionalBadge.dataset.tipSpec = "R4";
          }
        } else {
          const star = document.createElement("span");
          star.className = "preview-required-star";
          star.dataset.testid = "preview-required-star";
          star.textContent = "*";
          star.dataset.tipTitle = "Required field";
          star.dataset.tipBody = "This item is marked as required (item.required = true) and must be answered.";
          star.dataset.tipFhir = "Questionnaire.item.required";
          star.dataset.tipSpec = "R4";
          label.appendChild(star);
        }
      }
      row.appendChild(label);
      if (optionalBadge) row.appendChild(optionalBadge);
      this._buildSupportLinks(row, rc);
      this._buildVisHint(row, rc);
      this._buildConstraintBadge(row, rc);
      this._buildReadOnlyBadge(row, rc);
      this._buildInitialBadge(row, rc);
      this._buildItemMedia(row);
      this._buildControl(row, res, rc);
      this._buildReadOnlyValue(row, rc);
      this._buildCalcBadge(row, res, rc);
      this._buildPreviewCollapseToggle(row);
    }
    _buildConstraintBadge(row, rc) {
      if (!this.constraint?.length) return;
      const isPatient = rc.previewMode === "patient";
      if (isPatient) return;
      const { ctx, cEnv } = rc;
      const constraintOk = rc.evalConstraints(this, ctx.fp, ctx.qr, cEnv);
      const cb = document.createElement("span");
      cb.className = "preview-constraint-badge" + (constraintOk ? "" : " preview-constraint-badge--fail");
      const msgs = this.constraint.filter((c) => c.severity === "error").map((c) => c.human || c.expression || c.key).filter(Boolean);
      cb.textContent = constraintOk ? "\u26A0\uFE0F constraint" : "\u2718 constraint";
      cb.dataset.tipTitle = constraintOk ? "Has constraint" : "Constraint: FAIL";
      cb.dataset.tipBody = msgs.length ? msgs.join("\n") : "questionnaire-constraint on this item";
      cb.dataset.tipFhir = "Questionnaire.item.extension[questionnaire-constraint]";
      cb.dataset.tipSpec = "R4";
      const firstExpr = this.constraint.find((c) => c.expression?.trim())?.expression;
      if (firstExpr && rc.showExplain) {
        cb.classList.add("preview-condition-hint--explain");
        cb.dataset.tipBody += "\n\nClick to explain.";
        cb.addEventListener("click", () => {
          if (rc.lastCtx.fp) show(firstExpr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
        });
      }
      row.appendChild(cb);
    }
    _buildReadOnlyBadge(row, rc) {
      if (rc.previewMode === "patient") return;
      if (!this._readOnly || this._calculatedExpr) return;
      const rb = document.createElement("span");
      rb.className = "preview-meta-badge";
      rb.textContent = "\u{1F512} read-only";
      rb.dataset.tipTitle = "Read-only field";
      rb.dataset.tipBody = "This field is marked readOnly in the FHIR Questionnaire. It cannot be edited by the user.";
      rb.dataset.tipFhir = "Questionnaire.item.readOnly";
      rb.dataset.tipSpec = "R4";
      row.appendChild(rb);
    }
    _buildInitialBadge(row, rc) {
      if (rc.previewMode === "patient") return;
      if (this._initialValue === void 0 || this._initialValue === "") return;
      const ib = document.createElement("span");
      ib.className = "preview-meta-badge preview-meta-badge--init";
      ib.textContent = "\u21BA default";
      ib.dataset.tipTitle = "Has default value";
      ib.dataset.tipBody = "Pre-filled from Questionnaire.item.initial[]. User can change it unless the field is readOnly.";
      ib.dataset.tipFhir = "Questionnaire.item.initial[]";
      ib.dataset.tipSpec = "R4";
      row.appendChild(ib);
    }
    // Render itemMedia (image / audio / video) inline before the control.
    _buildItemMedia(row) {
      if (!this._itemMedia?.url) return;
      const att = this._itemMedia;
      const ct = att.contentType || "";
      const el = ct.startsWith("audio/") ? Object.assign(document.createElement("audio"), { src: att.url, controls: true }) : ct.startsWith("video/") ? Object.assign(document.createElement("video"), { src: att.url, controls: true, style: "max-width:100%;max-height:240px" }) : Object.assign(document.createElement("img"), { src: att.url, alt: att.title || "", style: "max-width:100%;max-height:200px" });
      el.className = "preview-item-media";
      el.dataset.testid = "preview-item-media";
      row.appendChild(el);
    }
    // Build interactive control (or repeat controls).
    _buildControl(row, res, rc) {
      if (this._readOnly || this._calculatedExpr) return;
      if (this.repeats && this.supportsRepeat()) {
        row.appendChild(this._buildRepeatContainer(res._iconEl, () => rc.updateGroupIcons(), rc));
      } else {
        row.appendChild(rc.buildControl(this, res._iconEl, () => rc.updateGroupIcons()));
      }
      if (rc.previewMode === "patient" && this._previewEl) {
        this._previewEl.classList.toggle("lform-item--invalid", !rc.calcFormOk(this));
      }
    }
    // Render N+1 repeat rows with add/remove buttons.
    _buildRepeatContainer(iconEl, onAfterChange, rc) {
      const id = this.id;
      const rowKey = (i) => i === 0 ? id : id + "$$" + i;
      const n = rc.getValue(id + "$$n") || 0;
      const wrap = document.createElement("div");
      wrap.className = "repeat-wrap";
      for (let i = 0; i <= n; i++) {
        const rk = rowKey(i);
        const fakeNode = i === 0 ? this : Object.assign(Object.create(Object.getPrototypeOf(this)), this, { id: rk });
        const rowEl = document.createElement("div");
        rowEl.className = "repeat-row";
        rowEl.appendChild(rc.buildControl(fakeNode, i === 0 ? iconEl : null, onAfterChange));
        if (n > 0) {
          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "repeat-remove-btn";
          rm.textContent = "\xD7";
          rm.dataset.tipTitle = "Remove this answer";
          rm.dataset.testid = "repeat-remove-btn";
          const _i = i;
          rm.onclick = () => {
            for (let j = _i; j < n; j++) rc.set(rowKey(j), rc.getValue(rowKey(j + 1)));
            rc.remove(rowKey(n));
            rc.set(id + "$$n", n - 1);
            BaseNode.notifyChanged(rc.bus);
          };
          rowEl.appendChild(rm);
        }
        wrap.appendChild(rowEl);
      }
      const maxOccurs = this._maxOccurs;
      const atMax = maxOccurs !== void 0 && n + 1 >= maxOccurs;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "repeat-add-btn";
      addBtn.textContent = uiStr("add_another", rc);
      addBtn.dataset.testid = "repeat-add-btn";
      if (atMax) {
        addBtn.disabled = true;
        addBtn.dataset.tipTitle = "Maximum " + maxOccurs + " answer" + (maxOccurs === 1 ? "" : "s") + " reached";
      }
      addBtn.onclick = () => {
        if (!atMax) {
          rc.set(id + "$$n", n + 1);
          BaseNode.notifyChanged(rc.bus);
        }
      };
      wrap.appendChild(addBtn);
      return wrap;
    }
    _buildReadOnlyValue(row, rc) {
      if (!this._readOnly || this._calculatedExpr) return;
      const val = rc.getValue(this.id);
      const vb = document.createElement("span");
      vb.className = "preview-readonly-value";
      vb.dataset.testid = "preview-readonly-value";
      vb.textContent = val !== void 0 && val !== null && val !== "" ? String(val) : "\u2014";
      row.appendChild(vb);
    }
    _buildCalcBadge(row, res, rc) {
      if (!this._calculatedExpr || !this._readOnly) return;
      const isPatient = rc.previewMode === "patient";
      const badge = document.createElement("span");
      badge.dataset.calcId = this.id;
      badge.dataset.calcType = this.itemType;
      if (isPatient) {
        const s = rc.getValue(this.id);
        badge.className = "preview-calc-value";
        badge.textContent = s !== void 0 && s !== "" ? String(s) : "\u2014";
        this._attachCalcExplain(badge, rc);
      } else if (this.itemType === "checkbox") {
        const calcVal = rc.getValue(this.id);
        badge.className = "calc-badge " + (calcVal ? "calc-true" : "calc-false") + (rc.showExplain ? " calc-badge--explain" : "");
        badge.textContent = calcVal ? "\u2713 true" : "\u2717 false";
        badge.dataset.tipTitle = "Calculated value";
        badge.dataset.tipBody = "FHIRPath: " + this._calculatedExpr + (rc.showExplain ? "\n\nClick to explain." : "");
        badge.dataset.tipFhir = "sdc-questionnaire-calculatedExpression";
        badge.dataset.tipSpec = "SDC";
        if (rc.showExplain) {
          const expr = this._calculatedExpr;
          badge.addEventListener("click", () => {
            if (rc.lastCtx.fp) show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
          });
        }
      } else {
        const s = rc.getValue(this.id);
        badge.className = "preview-calc-value";
        badge.textContent = s !== void 0 && s !== "" ? String(s) : "\u2014";
        this._attachCalcExplain(badge, rc);
      }
      this._refreshCalcBadge = () => {
        if (this.itemType === "checkbox" && rc.previewMode !== "patient") {
          const v = rc.getValue(this.id);
          badge.className = "calc-badge " + (v ? "calc-true" : "calc-false") + (rc.showExplain ? " calc-badge--explain" : "");
          badge.textContent = v ? "\u2713 true" : "\u2717 false";
        } else {
          const s = rc.getValue(this.id);
          badge.className = "preview-calc-value" + (rc.showExplain && this._calculatedExpr ? " preview-calc-value--explain" : "");
          badge.textContent = s !== void 0 && s !== "" ? String(s) : "\u2014";
        }
      };
      row.appendChild(badge);
    }
    // Make a plain calc value (`.preview-calc-value`, e.g. a numeric BMI) clickable
    // to open the FHIRPath Explain modal — only when the surface enables Explain.
    _attachCalcExplain(badge, rc) {
      if (!rc.showExplain || !this._calculatedExpr) return;
      badge.classList.add("preview-calc-value--explain");
      badge.dataset.tipTitle = "Calculated value";
      badge.dataset.tipBody = "FHIRPath: " + this._calculatedExpr + "\n\nClick to explain.";
      badge.dataset.tipFhir = "sdc-questionnaire-calculatedExpression";
      badge.dataset.tipSpec = "SDC";
      const expr = this._calculatedExpr;
      badge.addEventListener("click", () => {
        if (rc.lastCtx.fp) show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
      });
    }
    // Override _appendRow to also disable hidden-item inputs.
    _appendRow(row, res, container) {
      if (res.hidden && this.type === "item") {
        row.querySelectorAll("input, select, textarea").forEach((el) => {
          el.disabled = true;
        });
      }
      return super._appendRow(row, res, container);
    }
  };

  // js/nodes/text-node.js
  var TextNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "text";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      wrap.className = "ctrl-wrap ctrl-wrap--text";
      const el = document.createElement("textarea");
      el.className = "ctrl-input--text";
      el.rows = node._itemControl === "text-area" ? 3 : 1;
      el.value = getValue(node.id) !== void 0 ? getValue(node.id) : "";
      if (node._maxLength) el.maxLength = node._maxLength;
      if (node._minLength) el.minLength = node._minLength;
      if (node._entryFormat) el.placeholder = node._entryFormat;
      const autoResize = () => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      };
      let counter = null;
      if (node._maxLength) {
        counter = document.createElement("span");
        counter.className = "ctrl-char-counter";
        counter.dataset.testid = "char-counter";
        const updateCounter = () => {
          counter.textContent = el.value.length + "\xA0/\xA0" + node._maxLength;
        };
        updateCounter();
        el.addEventListener("input", updateCounter);
      }
      let errMinLen = null;
      if (node._minLength) {
        errMinLen = document.createElement("span");
        errMinLen.className = "ctrl-err ctrl-err--ml";
        errMinLen.dataset.testid = "minlength-err";
        errMinLen.textContent = "Min\xA0" + node._minLength + "\xA0chars";
        const validateMinLen = () => {
          errMinLen.style.display = el.value.length > 0 && el.value.length < node._minLength ? "inline" : "none";
        };
        if (node._interacted) {
          validateMinLen();
        } else {
          errMinLen.style.display = "none";
        }
      }
      let errRegex = null;
      const _re = node._regex ? (() => {
        try {
          return new RegExp(node._regex);
        } catch {
          return null;
        }
      })() : null;
      if (node._regex) {
        errRegex = document.createElement("span");
        errRegex.className = "ctrl-err ctrl-err--regex";
        errRegex.dataset.testid = "regex-err";
        errRegex.textContent = "Does not match pattern";
        const validateRegex = () => {
          errRegex.style.display = _re && el.value.length > 0 && !_re.test(el.value) ? "inline" : "none";
        };
        if (node._interacted) {
          validateRegex();
        } else {
          errRegex.style.display = "none";
        }
      }
      el.addEventListener("blur", () => {
        node._interacted = true;
        if (errMinLen) {
          errMinLen.style.display = el.value.length > 0 && el.value.length < node._minLength ? "inline" : "none";
        }
        if (errRegex) {
          errRegex.style.display = _re && el.value.length > 0 && !_re.test(el.value) ? "inline" : "none";
        }
      });
      let _debounce = null;
      el.oninput = () => {
        setValue(node.id, el.value);
        autoResize();
        clearTimeout(_debounce);
        _debounce = setTimeout(() => {
          _reCalc();
          onChange();
        }, 200);
      };
      el.onchange = () => {
        BaseNode.notifyChanged(ctx.bus);
      };
      wrap.appendChild(el);
      if (counter) wrap.appendChild(counter);
      if (errMinLen) wrap.appendChild(errMinLen);
      if (errRegex) wrap.appendChild(errRegex);
      if (el.value) requestAnimationFrame(autoResize);
      return wrap;
    }
  };
  NODE_REGISTRY.set("text", TextNode);

  // js/nodes/number-node.js
  var NumberNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = data.itemType ?? "number";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      if (node._sliderStep !== void 0 || node._itemControl === "slider") {
        const sl = document.createElement("input");
        sl.type = "range";
        sl.className = "ctrl-input--slider";
        sl.dataset.testid = "slider-input";
        sl.min = node._minValue !== void 0 ? String(node._minValue) : "0";
        sl.max = node._maxValue !== void 0 ? String(node._maxValue) : "100";
        sl.step = String(node._sliderStep);
        const initVal = getValue(node.id);
        sl.value = initVal !== void 0 && initVal !== "" ? String(initVal) : sl.min;
        const valLabel = document.createElement("span");
        valLabel.className = "ctrl-slider-value";
        valLabel.dataset.testid = "slider-value";
        valLabel.textContent = sl.value;
        sl.oninput = () => {
          const v = parseFloat(sl.value);
          setValue(node.id, v);
          valLabel.textContent = sl.value;
          _reCalc();
          onChange();
        };
        sl.onchange = () => {
          BaseNode.notifyChanged(ctx.bus);
        };
        wrap.appendChild(sl);
        wrap.appendChild(valLabel);
        return wrap;
      }
      const el = document.createElement("input");
      el.type = "number";
      el.className = "ctrl-input--number";
      el.value = getValue(node.id) !== void 0 ? getValue(node.id) : "";
      if (node._minValue !== void 0) el.min = String(node._minValue);
      if (node._maxValue !== void 0) el.max = String(node._maxValue);
      if (node._maxDecimalPlaces !== void 0) el.step = String(Math.pow(10, -node._maxDecimalPlaces));
      if (node._entryFormat) el.placeholder = node._entryFormat;
      const errMsg = document.createElement("span");
      errMsg.className = "ctrl-err ctrl-err--ml";
      errMsg.dataset.testid = "numeric-err";
      errMsg.style.display = "none";
      const validate = (v) => {
        if (v === void 0 || v === "" || v === null) {
          errMsg.style.display = "none";
          return;
        }
        const num = Number(v);
        if (node._minValue !== void 0 && num < node._minValue) {
          errMsg.textContent = "Min: " + node._minValue;
          errMsg.style.display = "inline";
        } else if (node._maxValue !== void 0 && num > node._maxValue) {
          errMsg.textContent = "Max: " + node._maxValue;
          errMsg.style.display = "inline";
        } else if (node._maxDecimalPlaces !== void 0) {
          const parts = String(v).split(".");
          if (parts.length > 1 && parts[1].length > node._maxDecimalPlaces) {
            errMsg.textContent = "Max " + node._maxDecimalPlaces + " decimal place" + (node._maxDecimalPlaces !== 1 ? "s" : "");
            errMsg.style.display = "inline";
          } else {
            errMsg.style.display = "none";
          }
        } else {
          errMsg.style.display = "none";
        }
      };
      el.oninput = () => {
        const v = el.value === "" ? void 0 : node.itemType === "integer" ? parseInt(el.value, 10) : parseFloat(el.value);
        setValue(node.id, v);
        validate(v);
        _reCalc();
        onChange();
      };
      el.onchange = () => {
        BaseNode.notifyChanged(ctx.bus);
      };
      validate(getValue(node.id));
      wrap.appendChild(el);
      if (node._minValue !== void 0 || node._maxValue !== void 0 || node._maxDecimalPlaces !== void 0) wrap.appendChild(errMsg);
      return wrap;
    }
  };
  NODE_REGISTRY.set("number", NumberNode);
  NODE_REGISTRY.set("integer", NumberNode);
  NODE_REGISTRY.set("decimal", NumberNode);

  // js/fhir/server-config.js
  var CONFIG_KEYS = {
    CORS_PROXY: "corsProxyUrl",
    TERMINOLOGY_SERVER: "terminologyServer",
    NLM_API_BASE: "nlmApiBaseUrl",
    FHIR_BASE: "fhirBaseUrl",
    // for patient / resource search
    SDC_SERVER: "sdcServerUrl",
    // for SDC operations ($populate, $extract)
    VALIDATORS: "validators",
    // JSON array string
    TRANSLATE_API: "translateApiUrl",
    // translation endpoint (provider-specific)
    TRANSLATE_PROVIDER: "translateProvider",
    // active machine-translation provider id
    TRANSLATE_API_KEY: "translateApiKey"
    // API key for key-based providers (DeepL/OpenAI)
  };
  var ServerConfigProvider = class {
    /** @param {string} _key @returns {string|null} */
    get(_key) {
      return null;
    }
    /** @param {string} _key @param {string|null} _value */
    set(_key, _value) {
    }
    get writable() {
      return false;
    }
    /** Human-readable label shown in settings UI */
    get label() {
      return "Unknown";
    }
  };
  var DefaultConfigProvider = class extends ServerConfigProvider {
    constructor(cfg = {}) {
      super();
      this._cfg = cfg;
    }
    get(key) {
      const v = this._cfg[key];
      if (v == null) return null;
      return typeof v === "string" ? v : JSON.stringify(v);
    }
    get label() {
      return "Default (config.json)";
    }
  };
  function _makeServerConfig() {
    const _providers = [];
    let _ready = null;
    return {
      /**
       * Register a provider. Last registered = highest priority.
       * @param {ServerConfigProvider} provider
       */
      register(provider) {
        _providers.unshift(provider);
      },
      /**
       * Fetch config.json, create DefaultConfigProvider from it and register it
       * as the lowest-priority provider. Returns the loaded config object.
       * @param {string} [url='./config.json']
       * @returns {Promise<object>}
       */
      load(url = "./config.json") {
        if (_ready) return _ready;
        _ready = fetch(url).then((r) => r.json()).then((cfg) => {
          _providers.push(new DefaultConfigProvider(cfg));
          return cfg;
        }).catch(() => {
          _providers.push(new DefaultConfigProvider({}));
          return {};
        });
        return _ready;
      },
      /**
       * Wait for config.json to load (if load() was called).
       * Resolves immediately if load() was never called.
       */
      ready() {
        return _ready ?? Promise.resolve({});
      },
      /**
       * Get a config value. First non-null result from providers in priority order.
       * @param {string} key
       * @returns {string|null}
       */
      get(key) {
        for (const p of _providers) {
          const v = p.get(key);
          if (v != null) return v;
        }
        return null;
      },
      /**
       * Get parsed value. Returns array for CONFIG_KEYS.VALIDATORS, string otherwise.
       * @param {string} key
       * @returns {any}
       */
      getParsed(key) {
        const v = this.get(key);
        if (v == null) return null;
        if (key === CONFIG_KEYS.VALIDATORS) {
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        }
        return v;
      },
      /**
       * Write to the first writable provider (highest priority writable).
       * @param {string} key
       * @param {string|null} value  null = clear/reset to default
       */
      set(key, value) {
        for (const p of _providers) {
          if (p.writable) {
            p.set(key, value);
            return;
          }
        }
      },
      /**
       * Clear a user override — removes from the first writable provider.
       * Falls back to next provider's value on next get().
       * @param {string} key
       */
      reset(key) {
        this.set(key, null);
      },
      /**
       * Returns all registered providers (for display in settings UI).
       * @returns {ServerConfigProvider[]}
       */
      getProviders() {
        return [..._providers];
      },
      /**
       * Returns true if any writable provider has an override for this key.
       * @param {string} key
       */
      hasOverride(key) {
        for (const p of _providers) {
          if (p.writable && p.get(key) != null) return true;
        }
        return false;
      },
      /** FOR TESTS ONLY — clears all providers and resets the ready promise. */
      _clear() {
        _providers.length = 0;
        _ready = null;
      }
    };
  }
  var serverConfig = _makeServerConfig();

  // js/fhir/terminology-service.js
  var FALLBACK_TERMINOLOGY_SERVER = "https://tx.fhir.org/r4";
  function _corsProxy() {
    return (serverConfig.get(CONFIG_KEYS.CORS_PROXY) || "").replace(/\/$/, "");
  }
  function _termServer() {
    return (serverConfig.get(CONFIG_KEYS.TERMINOLOGY_SERVER) || FALLBACK_TERMINOLOGY_SERVER).replace(/\/$/, "");
  }
  function _nlmApiBase() {
    return (serverConfig.get(CONFIG_KEYS.NLM_API_BASE) || "https://clinicaltables.nlm.nih.gov/api").replace(/\/$/, "");
  }
  var EXPAND_COUNT = 500;
  var FETCH_TIMEOUT = 15e3;
  var TEST_TIMEOUT = 8e3;
  var RETRY_STATUSES = /* @__PURE__ */ new Set([429, 500, 503, 504]);
  var RETRY_DELAY_MS = 700;
  var MAX_RETRIES = 2;
  var MAX_RETRY_AFTER_MS = 3e4;
  function _retryDelayMs(res, attempt) {
    const header = res.headers.get("Retry-After");
    if (header) {
      const secs = Number(header);
      if (!isNaN(secs) && secs > 0) return Math.min(secs * 1e3, MAX_RETRY_AFTER_MS);
      const date = new Date(header);
      if (!isNaN(date.getTime())) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
    }
    return RETRY_DELAY_MS * (attempt + 1);
  }
  async function _fetchWithRetry(url, options, timeout, onRetry) {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res;
      try {
        res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          onRetry?.();
        }
        continue;
      }
      if (!RETRY_STATUSES.has(res.status)) return res;
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, _retryDelayMs(res, attempt)));
        onRetry?.();
      }
    }
    throw lastErr;
  }
  function _collectExternalVsNodes(nodes, out = []) {
    for (const node of nodes) {
      if (node._answerValueSet && !node._answerValueSet.startsWith("#") && node._itemControl !== "lookup") out.push(node);
      if (node.children?.length) _collectExternalVsNodes(node.children, out);
    }
    return out;
  }
  function _collectUnitVsNodes(nodes, out = []) {
    for (const node of nodes) {
      if (node._unitValueSet) out.push(node);
      if (node.children?.length) _collectUnitVsNodes(node.children, out);
    }
    return out;
  }
  var TerminologyService = class {
    /** Wrap a target URL through the CORS proxy if configured. */
    _proxyUrl(url) {
      const proxy = _corsProxy();
      return proxy ? `${proxy}?url=${encodeURIComponent(url)}` : url;
    }
    /**
     * Return a direct (non-proxied) URL for an NLM Clinical Tables API path.
     * clinicaltables.nlm.nih.gov already sends Access-Control-Allow-Origin: *,
     * so routing through the CORS proxy is unnecessary and causes 403 errors.
     * The base URL is read from config.json (key: nlmApiBaseUrl).
     * @param {string} relativePath  Path + query string relative to the NLM API base (no leading slash).
     * @returns {Promise<string>}
     */
    async nlmUrl(relativePath) {
      await serverConfig.ready();
      return `${_nlmApiBase()}/${relativePath}`;
    }
    /** Resolve the server URL for a node using the full fallback chain. */
    getServer(node, questMeta) {
      const url = node?._preferredTermServer || questMeta?.preferredTermServer || _termServer();
      return url.replace(/\/$/, "");
    }
    /**
     * Expand a ValueSet from a FHIR terminology server.
     * @param {string} vsUrl      Canonical ValueSet URL to expand.
     * @param {string} serverUrl  Base URL of the FHIR terminology server.
     * @returns {Promise<Array<{code: string, display: string, system: string}>>}
     */
    async expandValueSet(vsUrl, serverUrl) {
      await serverConfig.ready();
      const base = (serverUrl || _termServer()).replace(/\/$/, "");
      const reqUrl = this._proxyUrl(`${base}/ValueSet/$expand?url=${encodeURIComponent(vsUrl)}&_count=${EXPAND_COUNT}`);
      const res = await _fetchWithRetry(reqUrl, {
        headers: { Accept: "application/fhir+json" }
      }, FETCH_TIMEOUT);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (body.resourceType !== "ValueSet") throw new Error("Response is not a FHIR ValueSet");
      return (body.expansion?.contains || []).map((c) => ({
        code: c.code ?? "",
        display: c.display || c.code || "",
        system: c.system || ""
      }));
    }
    /**
     * Expand a ValueSet with an optional text filter for live server-side lookup.
     * Uses the FHIR $expand operation with a `filter` parameter.
     * @param {string} vsUrl       Canonical ValueSet URL to expand.
     * @param {string} serverUrl   Base URL of the FHIR terminology server.
     * @param {string} [filter]    Optional search text (sent as $expand?filter=).
     * @param {number} [count=50]  Max results to return.
     * @returns {Promise<Array<{code: string, display: string, system: string}>>}
     */
    async expandWithFilter(vsUrl, serverUrl, filter = "", count = 50) {
      await serverConfig.ready();
      const base = (serverUrl || _termServer()).replace(/\/$/, "");
      const params = new URLSearchParams({ url: vsUrl, _count: String(count) });
      if (filter && filter.trim()) params.set("filter", filter.trim());
      const reqUrl = this._proxyUrl(`${base}/ValueSet/$expand?${params}`);
      const res = await _fetchWithRetry(reqUrl, {
        headers: { Accept: "application/fhir+json" }
      }, FETCH_TIMEOUT);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (body.resourceType !== "ValueSet") throw new Error("Response is not a FHIR ValueSet");
      return (body.expansion?.contains || []).map((c) => ({
        code: c.code ?? "",
        display: c.display || c.code || "",
        system: c.system || ""
      }));
    }
    /**
     * Test whether a URL points to a reachable FHIR terminology server.
     * Fetches /metadata and checks for a CapabilityStatement response.
     * @returns {Promise<{ok: boolean, message: string}>}
     */
    async testServer(serverUrl, { onRetry } = {}) {
      await serverConfig.ready();
      const base = (serverUrl || "").trim().replace(/\/$/, "");
      if (!base) return { ok: false, message: "No URL provided" };
      try {
        const res = await _fetchWithRetry(this._proxyUrl(`${base}/metadata`), {
          headers: { Accept: "application/fhir+json" }
        }, TEST_TIMEOUT, onRetry);
        if (!res.ok) return { ok: false, message: `HTTP ${res.status} ${res.statusText}` };
        const body = await res.json();
        if (body.resourceType !== "CapabilityStatement") {
          return { ok: false, message: "Not a FHIR server (no CapabilityStatement)" };
        }
        const name = [body.software?.name, body.software?.version].filter(Boolean).join(" ") || "OK";
        return { ok: true, message: name };
      } catch (err) {
        return { ok: false, message: err.message };
      }
    }
    /**
     * Test whether a specific ValueSet URL can be expanded by a terminology server.
     * Returns the number of codes on success, or an error message on failure.
     * @param {string} vsUrl      Canonical ValueSet URL to expand.
     * @param {string} [serverUrl] Terminology server base URL (falls back to default).
     * @returns {Promise<{ok: boolean, message: string, count?: number}>}
     */
    async testExpand(vsUrl, serverUrl) {
      if (!vsUrl) return { ok: false, message: "No URL provided" };
      try {
        const codes = await this.expandValueSet(vsUrl, serverUrl || _termServer());
        return { ok: true, message: `${codes.length} code${codes.length !== 1 ? "s" : ""}`, count: codes.length };
      } catch (err) {
        return { ok: false, message: err.message };
      }
    }
    /**
     * Expand all external answerValueSets in the tree and cache results on each node.
     * Results are stored in node._vsCache (array of options, empty on failure).
     * @param {Array}  treeNodes  Root nodes of the questionnaire tree.
     * @param {object} questMeta  questMeta object (for questionnaire-level server).
     * @returns {Promise<Array<{node, vsUrl, server, error}>>} List of failures (empty = all OK).
     */
    async expandAll(treeNodes, questMeta) {
      const nodes = _collectExternalVsNodes(treeNodes);
      const unitNodes = _collectUnitVsNodes(treeNodes);
      if (!nodes.length && !unitNodes.length) return [];
      const failures = [];
      for (const node of nodes) {
        const server = this.getServer(node, questMeta);
        try {
          node._vsCache = await this.expandValueSet(node._answerValueSet, server);
        } catch (err) {
          node._vsCache = [];
          const isCors = err instanceof TypeError && err.message.includes("fetch");
          const msg = isCors ? `Network error (possible CORS restriction \u2014 the server may not allow browser requests): ${err.message}` : err.message;
          failures.push({ node, vsUrl: node._answerValueSet, server, error: msg });
        }
      }
      for (const node of unitNodes) {
        const server = this.getServer(node, questMeta);
        try {
          node._unitVsCache = await this.expandValueSet(node._unitValueSet, server);
        } catch (err) {
          node._unitVsCache = [];
          const isCors = err instanceof TypeError && err.message.includes("fetch");
          const msg = isCors ? `Network error (possible CORS restriction \u2014 the server may not allow browser requests): ${err.message}` : err.message;
          failures.push({ node, vsUrl: node._unitValueSet, server, error: msg });
        }
      }
      return failures;
    }
  };
  var terminologyService = new TerminologyService();

  // js/nodes/choice-helpers.js
  function _nodeOpts(node) {
    if (node._rawAnswerOptions) return rawOptsToPairs(node._rawAnswerOptions);
    return parseOptions(node.options);
  }
  function _evalAnswerOpts(node, fpCtx) {
    const expr = node._answerExpression || node._candidateExpression;
    if (!expr) {
      if (node._answerValueSet && !node._answerValueSet.startsWith("#")) {
        return node._vsCache ?? [];
      }
      return _nodeOpts(node);
    }
    if (!fpCtx || !fpCtx.fp || !fpCtx.qr) return _nodeOpts(node);
    return _evalExpr(node, expr, fpCtx);
  }
  function siblingSelectedCodes(baseId, ownId, getValue) {
    const n = Number(getValue(baseId + "$$n")) || 0;
    const set = /* @__PURE__ */ new Set();
    for (let j = 0; j <= n; j++) {
      const rowId = j === 0 ? baseId : baseId + "$$" + j;
      if (rowId === ownId) continue;
      const v = getValue(rowId);
      if (v) set.add(v);
    }
    return set;
  }
  function filterSiblingSelected(opts, ownValue, siblingSet) {
    if (!siblingSet || !siblingSet.size) return opts;
    return opts.filter((o) => o.code === ownValue || !siblingSet.has(o.code));
  }
  function baseRowId(id) {
    return String(id).replace(/\$\$\d+$/, "");
  }
  function _evalExpr(node, expr, fpCtx) {
    try {
      const raw = fpCtx.fp.evaluate(fpCtx.qr, expr, fpCtx.env || {}, fhirModel());
      if (!raw || !raw.length) return _nodeOpts(node);
      return raw.map((v) => {
        if (v === null || v === void 0) return null;
        if (typeof v === "string") return { code: v, display: v };
        if (typeof v === "number") return { code: String(v), display: String(v) };
        if (typeof v === "boolean") return { code: String(v), display: v ? "Yes" : "No" };
        if (typeof v === "object") {
          if (v.code !== void 0) return { code: String(v.code), display: v.display || String(v.code) };
          if (v.value !== void 0) return { code: String(v.value), display: v.display || String(v.value) };
        }
        return { code: String(v), display: String(v) };
      }).filter(Boolean);
    } catch {
      return _nodeOpts(node);
    }
  }
  function _resolveColValue(rawOpt, code, display, path) {
    if (rawOpt) {
      const obj = rawOpt.valueCoding || rawOpt.valueReference || rawOpt;
      if (obj && obj[path] !== void 0) return String(obj[path]);
    }
    if (path === "code") return code;
    if (path === "display") return display || "";
    return "";
  }
  function _findRawOpt(node, code) {
    if (!node._rawAnswerOptions) return null;
    return node._rawAnswerOptions.find((o) => {
      const c = o.valueCoding || o.valueReference;
      if (c && (c.code === code || c.reference === code)) return true;
      if (o.valueString === code) return true;
      if (o.valueInteger !== void 0 && String(o.valueInteger) === code) return true;
      if (o.valueDate === code) return true;
      if (o.valueTime === code) return true;
      return false;
    }) || null;
  }
  function _getColDisplayLabel(node, code, displayFallback) {
    if (!node._choiceColumns || !node._choiceColumns.length) return displayFallback;
    const fdCol = node._choiceColumns.find((c) => c.forDisplay);
    if (!fdCol) return displayFallback;
    const rawOpt = _findRawOpt(node, code);
    const val = _resolveColValue(rawOpt, code, displayFallback, fdCol.path);
    return val || displayFallback;
  }
  function _buildColHeader(columns) {
    const row = document.createElement("div");
    row.className = "oc-col-header";
    for (const col of columns) {
      const cell = document.createElement("span");
      cell.className = "oc-col-cell";
      cell.textContent = col.label || col.path;
      if (col.width) cell.style.width = col.width.value + (col.width.unit || col.width.code || "%");
      row.appendChild(cell);
    }
    return row;
  }
  function _buildColRow(columns, rawOpt, code, display) {
    const row = document.createElement("div");
    row.className = "oc-opt oc-col-row";
    for (const col of columns) {
      const cell = document.createElement("span");
      cell.className = "oc-col-cell";
      cell.textContent = _resolveColValue(rawOpt, code, display, col.path);
      if (col.width) cell.style.width = col.width.value + (col.width.unit || col.width.code || "%");
      row.appendChild(cell);
    }
    return row;
  }
  function _appendOptionExtras(lbl, node, code) {
    if (node._optionWeights && node._optionWeights[code] !== void 0) {
      const w = document.createElement("span");
      w.className = "option-weight";
      w.textContent = "\xA0[w:" + node._optionWeights[code] + "]";
      w.dataset.tipTitle = "Item weight";
      w.dataset.tipBody = "Scoring weight for this answer option (itemWeight).";
      w.dataset.tipFhir = "answerOption.extension[itemWeight].valueDecimal";
      w.dataset.tipSpec = "SDC";
      lbl.appendChild(w);
    }
    if (node._answerMedias && node._answerMedias[code]) {
      const att = node._answerMedias[code];
      const ct = att.contentType || "";
      const el = ct.startsWith("audio/") ? Object.assign(document.createElement("audio"), { src: att.url, controls: true }) : ct.startsWith("video/") ? Object.assign(document.createElement("video"), { src: att.url, controls: true, style: "max-width:200px;max-height:120px" }) : Object.assign(document.createElement("img"), { src: att.url, alt: att.title || "", style: "max-width:120px;max-height:80px;vertical-align:middle;margin-left:6px" });
      el.className = "preview-answer-media";
      lbl.appendChild(el);
    }
  }

  // js/nodes/choice-node.js
  var ChoiceNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "select";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      let selected = getValue(node.id) || "";
      let opts = _evalAnswerOpts(node, ctx._fpCtx);
      if (node.repeats) {
        opts = filterSiblingSelected(opts, selected, siblingSelectedCodes(baseRowId(node.id), node.id, getValue));
      }
      if (!node._lookupDisplayCache) node._lookupDisplayCache = {};
      const trigger = document.createElement("div");
      trigger.className = "sc-trigger";
      trigger.tabIndex = 0;
      trigger.setAttribute("role", "combobox");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      {
        const nm = String(node.title || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (nm) trigger.setAttribute("aria-label", nm);
      }
      const textSpan = document.createElement("span");
      textSpan.className = "sc-trigger-text";
      trigger.appendChild(textSpan);
      const setLabel = () => {
        const found = opts.find((o) => o.code === selected);
        if (found) {
          let label = _getColDisplayLabel(node, found.code, found.display || found.code);
          if (node._optionPrefixes && node._optionPrefixes[found.code] !== void 0)
            label = node._optionPrefixes[found.code] + "\xA0" + label;
          if (node._optionOrdinals && node._optionOrdinals[found.code] !== void 0)
            label += "\xA0(" + node._optionOrdinals[found.code] + ")";
          textSpan.textContent = label;
          trigger.classList.remove("sc-trigger--empty");
        } else if (selected && node._lookupDisplayCache[selected]) {
          textSpan.textContent = node._lookupDisplayCache[selected];
          trigger.classList.remove("sc-trigger--empty");
        } else {
          textSpan.textContent = "\u2014 select \u2014";
          trigger.classList.add("sc-trigger--empty");
        }
      };
      setLabel();
      let dropEl = null;
      let _open = false;
      let _activeIdx = -1;
      const _uid = nextUid("csel");
      const close = () => {
        if (dropEl) {
          dropEl.remove();
          dropEl = null;
        }
        _open = false;
        _activeIdx = -1;
        trigger.setAttribute("aria-expanded", "false");
        trigger.removeAttribute("aria-activedescendant");
        document.removeEventListener("mousedown", _onOutside, true);
        document.removeEventListener("keydown", _onKey, true);
      };
      const _onOutside = (e) => {
        if (!wrap.contains(e.target) && !dropEl?.contains(e.target)) close();
      };
      const _pick = (code) => {
        selected = code;
        setValue(node.id, code);
        setLabel();
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
        close();
        trigger.focus();
      };
      const _optEls = () => dropEl ? [...dropEl.querySelectorAll('[role="option"]')] : [];
      const _setActive = (idx) => {
        const optEls = _optEls();
        if (!optEls.length) return;
        _activeIdx = Math.max(0, Math.min(idx, optEls.length - 1));
        optEls.forEach((o, i) => {
          if (!o.id) o.id = _uid + "-opt-" + i;
          o.classList.toggle("oc-opt--active", i === _activeIdx);
        });
        trigger.setAttribute("aria-activedescendant", optEls[_activeIdx].id);
        optEls[_activeIdx].scrollIntoView({ block: "nearest" });
      };
      const _onKey = (e) => {
        if (!_open) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
          trigger.focus();
          return;
        }
        const optEls = _optEls();
        if (!optEls.length) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          _setActive(_activeIdx + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          _setActive(_activeIdx - 1);
        } else if (e.key === "Home") {
          e.preventDefault();
          e.stopPropagation();
          _setActive(0);
        } else if (e.key === "End") {
          e.preventDefault();
          e.stopPropagation();
          _setActive(optEls.length - 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const el = optEls[_activeIdx] || opts[0];
          if (el && el.dataset.code !== void 0) _pick(el.dataset.code);
        }
      };
      const _buildOpts = (container, filter = "") => {
        const q = filter.toLowerCase();
        const cols = node._choiceColumns;
        if (cols && cols.length) container.appendChild(_buildColHeader(cols));
        for (const { code, display } of opts) {
          const label = display || code;
          if (q && !label.toLowerCase().includes(q) && !code.toLowerCase().includes(q)) continue;
          if (cols && cols.length) {
            const rawOpt = _findRawOpt(node, code);
            const row = _buildColRow(cols, rawOpt, code, display);
            row.setAttribute("role", "option");
            row.setAttribute("aria-selected", String(code === selected));
            row.dataset.code = code;
            if (code === selected) row.classList.add("oc-opt--sel");
            row.addEventListener("mousedown", (e) => {
              e.preventDefault();
              _pick(code);
            });
            container.appendChild(row);
          } else {
            const opt = document.createElement("div");
            opt.className = "oc-opt";
            opt.setAttribute("role", "option");
            opt.setAttribute("aria-selected", String(code === selected));
            opt.dataset.code = code;
            if (node._optionPrefixes && node._optionPrefixes[code] !== void 0) {
              const pfx = document.createElement("span");
              pfx.className = "option-prefix";
              pfx.textContent = node._optionPrefixes[code] + "\xA0";
              opt.appendChild(pfx);
            }
            if (node._optionOrdinals && node._optionOrdinals[code] !== void 0) {
              opt.appendChild(document.createTextNode(label));
              const ord = document.createElement("span");
              ord.className = "option-ordinal";
              ord.textContent = "\xA0(" + node._optionOrdinals[code] + ")";
              opt.appendChild(ord);
            } else {
              opt.appendChild(document.createTextNode(label));
            }
            _appendOptionExtras(opt, node, code);
            if (code === selected) opt.classList.add("oc-opt--sel");
            opt.addEventListener("mousedown", (e) => {
              e.preventDefault();
              _pick(code);
            });
            container.appendChild(opt);
          }
        }
      };
      const _fillDropDefault = () => {
        _buildOpts(dropEl);
      };
      const _fillDropAutocomplete = () => {
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "oc-search";
        searchInput.placeholder = "Search\u2026";
        searchInput.dataset.testid = "autocomplete-search";
        const listBox = document.createElement("div");
        _buildOpts(listBox);
        searchInput.addEventListener("input", () => {
          listBox.innerHTML = "";
          _buildOpts(listBox, searchInput.value);
        });
        dropEl.appendChild(searchInput);
        dropEl.appendChild(listBox);
        requestAnimationFrame(() => searchInput.focus());
      };
      const _fillDropLookup = () => {
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "oc-search";
        searchInput.placeholder = "Search codes\u2026";
        searchInput.dataset.testid = "lookup-search";
        const statusEl = document.createElement("div");
        statusEl.className = "oc-lookup-status";
        statusEl.dataset.testid = "lookup-status";
        statusEl.style.display = "none";
        const listBox = document.createElement("div");
        let _lookupTimer = null;
        const _doLookup = (filter) => {
          clearTimeout(_lookupTimer);
          statusEl.textContent = "Searching\u2026";
          statusEl.style.display = "";
          listBox.innerHTML = "";
          _lookupTimer = setTimeout(async () => {
            if (!node._answerValueSet) {
              statusEl.textContent = "No ValueSet configured";
              statusEl.style.display = "";
              return;
            }
            try {
              const serverUrl = terminologyService.getServer(node, null);
              const results = await terminologyService.expandWithFilter(node._answerValueSet, serverUrl, filter);
              statusEl.textContent = results.length ? "" : "No results";
              statusEl.style.display = results.length ? "none" : "";
              listBox.innerHTML = "";
              for (const { code, display } of results) {
                const opt = document.createElement("div");
                opt.className = "oc-opt";
                opt.textContent = display || code;
                if (code === selected) opt.classList.add("oc-opt--sel");
                opt.addEventListener("mousedown", (e) => {
                  e.preventDefault();
                  node._lookupDisplayCache[code] = display || code;
                  _pick(code);
                });
                listBox.appendChild(opt);
              }
              _reposition();
            } catch (err) {
              statusEl.textContent = "\u2717 " + (err.message || "Search failed");
              statusEl.style.display = "";
              listBox.innerHTML = "";
            }
          }, filter.trim() ? 300 : 0);
        };
        searchInput.addEventListener("input", () => _doLookup(searchInput.value));
        dropEl.appendChild(searchInput);
        dropEl.appendChild(statusEl);
        dropEl.appendChild(listBox);
        requestAnimationFrame(() => {
          searchInput.focus();
          _doLookup("");
        });
      };
      const _reposition = () => {
        if (!dropEl) return;
        const rect = trigger.getBoundingClientRect();
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom - 4;
        const spaceAbove = rect.top - 4;
        const maxAllowed = 200;
        dropEl.style.left = rect.left + "px";
        if (node._choiceColumns && node._choiceColumns.length) {
          dropEl.style.minWidth = rect.width + "px";
          dropEl.style.width = "auto";
        } else {
          dropEl.style.width = rect.width + "px";
        }
        if (spaceBelow >= Math.min(maxAllowed, spaceAbove)) {
          const cap = Math.min(maxAllowed, Math.max(spaceBelow, 60));
          dropEl.style.maxHeight = cap + "px";
          dropEl.style.top = rect.bottom + 2 + "px";
        } else {
          const cap = Math.min(maxAllowed, Math.max(spaceAbove, 60));
          dropEl.style.maxHeight = cap + "px";
          dropEl.style.top = rect.top - Math.min(cap, dropEl.offsetHeight || cap) - 2 + "px";
        }
      };
      const openDrop = () => {
        if (dropEl) {
          close();
          return;
        }
        dropEl = document.createElement("div");
        dropEl.className = "oc-drop";
        dropEl.setAttribute("role", "listbox");
        switch (node._itemControl) {
          case "autocomplete":
            _fillDropAutocomplete();
            break;
          case "lookup":
            _fillDropLookup();
            break;
          default:
            _fillDropDefault();
            break;
        }
        document.body.appendChild(dropEl);
        _open = true;
        trigger.setAttribute("aria-expanded", "true");
        trigger.setAttribute("aria-controls", dropEl.id || (dropEl.id = _uid + "-list"));
        _reposition();
        document.addEventListener("mousedown", _onOutside, true);
        if (node._itemControl !== "autocomplete" && node._itemControl !== "lookup") {
          document.addEventListener("keydown", _onKey, true);
          const optEls = _optEls();
          const sel = optEls.findIndex((o) => o.dataset.code === selected);
          _setActive(sel >= 0 ? sel : 0);
        }
      };
      trigger.addEventListener("click", openDrop);
      trigger.addEventListener("keydown", (e) => {
        if (_open) return;
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          openDrop();
        }
      });
      wrap.appendChild(trigger);
      return wrap;
    }
  };
  var RadioNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "radio";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const opts = _evalAnswerOpts(node, ctx._fpCtx);
      if (!opts.length) {
        const msg = document.createElement("span");
        msg.className = "radio-no-opts";
        msg.textContent = "(no options)";
        wrap.appendChild(msg);
        return wrap;
      }
      if (node._columnCount > 1) {
        wrap.classList.add("ctrl-wrap--columns");
        wrap.style.setProperty("--col-count", node._columnCount);
      } else if (node._choiceOrientation === "vertical") wrap.classList.add("ctrl-wrap--vertical");
      else if (node._choiceOrientation === "horizontal") wrap.classList.add("ctrl-wrap--horizontal");
      const rbName = "radio_" + node.id;
      for (const { code, display } of opts) {
        const lbl = document.createElement("label");
        lbl.className = "radio-label";
        const rb = document.createElement("input");
        rb.type = "radio";
        rb.name = rbName;
        rb.value = code;
        rb.checked = getValue(node.id) === code;
        rb.onchange = () => {
          if (rb.checked) {
            setValue(node.id, code);
            _reCalc();
            onChange();
            BaseNode.notifyChanged(ctx.bus);
          }
        };
        lbl.appendChild(rb);
        if (node._optionPrefixes && node._optionPrefixes[code] !== void 0) {
          const pfx = document.createElement("span");
          pfx.className = "option-prefix";
          pfx.textContent = node._optionPrefixes[code] + "\xA0";
          lbl.appendChild(pfx);
        }
        lbl.appendChild(document.createTextNode(display));
        if (node._optionOrdinals && node._optionOrdinals[code] !== void 0) {
          const ord = document.createElement("span");
          ord.className = "option-ordinal";
          ord.textContent = "\xA0(" + node._optionOrdinals[code] + ")";
          lbl.appendChild(ord);
        }
        _appendOptionExtras(lbl, node, code);
        wrap.appendChild(lbl);
      }
      return wrap;
    }
  };
  var OpenChoiceNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "open-choice";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const parsed = _evalAnswerOpts(node, ctx._fpCtx);
      const box = document.createElement("div");
      box.className = "oc-wrap";
      const el = document.createElement("input");
      el.type = "text";
      el.className = "oc-input";
      el.placeholder = node._openLabel || "Choose or type\u2026";
      el.value = getValue(node.id) !== void 0 ? getValue(node.id) : "";
      el.autocomplete = "off";
      const optionsOnly = node._answerConstraint === "optionsOnly";
      if (optionsOnly) {
        el.readOnly = true;
        el.placeholder = node._openLabel || "Choose\u2026";
        el.classList.add("choice-open-readonly");
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "oc-btn";
      btn.innerHTML = "&#x25BE;";
      btn.dataset.tipTitle = "Show options";
      box.appendChild(el);
      box.appendChild(btn);
      let dropEl = null;
      let _open = false;
      const close = () => {
        if (dropEl) {
          dropEl.remove();
          dropEl = null;
        }
        _open = false;
        document.removeEventListener("mousedown", _onOutside, true);
      };
      const _onOutside = (e) => {
        if (!box.contains(e.target) && !dropEl?.contains(e.target)) close();
      };
      const _pick = (display) => {
        el.value = display;
        setValue(node.id, display);
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
        close();
        el.focus();
      };
      const openDrop = (filter = "") => {
        if (dropEl) dropEl.remove();
        const q = filter.toLowerCase();
        const matches = q ? parsed.filter(({ display, code }) => (display || code).toLowerCase().includes(q)) : parsed;
        if (!matches.length) {
          _open = false;
          return;
        }
        dropEl = document.createElement("div");
        dropEl.className = "oc-drop";
        for (const { display, code } of matches) {
          const label = display || code;
          const opt = document.createElement("div");
          opt.className = "oc-opt";
          opt.textContent = label;
          if (label === el.value) opt.classList.add("oc-opt--sel");
          opt.addEventListener("mousedown", (e) => {
            e.preventDefault();
            _pick(label);
          });
          dropEl.appendChild(opt);
        }
        document.body.appendChild(dropEl);
        _open = true;
        const rect = el.getBoundingClientRect();
        dropEl.style.left = rect.left + "px";
        dropEl.style.minWidth = rect.width + "px";
        const dropH = dropEl.offsetHeight;
        if (rect.bottom + dropH + 4 <= window.innerHeight) {
          dropEl.style.top = rect.bottom + 2 + "px";
        } else {
          dropEl.style.top = Math.max(4, rect.top - dropH - 2) + "px";
        }
        document.addEventListener("mousedown", _onOutside, true);
      };
      el.addEventListener("input", () => {
        if (optionsOnly) return;
        setValue(node.id, el.value);
        _reCalc();
        onChange();
        openDrop(el.value);
      });
      el.addEventListener("change", () => {
        BaseNode.notifyChanged(ctx.bus);
      });
      el.addEventListener("focus", () => {
        if (parsed.length) openDrop(el.value);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (_open) {
          close();
        } else {
          el.focus();
          openDrop(el.value);
        }
      });
      wrap.appendChild(box);
      return wrap;
    }
  };
  var ChecklistNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "checklist";
      this.repeats = true;
    }
    supportsRepeat() {
      return false;
    }
    impliesRepeats() {
      return true;
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const opts = _evalAnswerOpts(node, ctx._fpCtx);
      if (!opts.length) {
        const msg = document.createElement("span");
        msg.className = "radio-no-opts";
        msg.textContent = "(no options)";
        wrap.appendChild(msg);
        return wrap;
      }
      if (node._columnCount > 1) {
        wrap.classList.add("ctrl-wrap--columns");
        wrap.style.setProperty("--col-count", node._columnCount);
      } else if (node._choiceOrientation === "horizontal") wrap.classList.add("ctrl-wrap--horizontal");
      else wrap.classList.add("ctrl-wrap--vertical");
      const parseSelected = () => {
        const raw = getValue(node.id);
        if (!raw || raw === "") return /* @__PURE__ */ new Set();
        return new Set(String(raw).split(","));
      };
      const serializeSelected = (set) => [...set].join(",");
      const exclusives = node._optionExclusives || {};
      const allCheckboxes = [];
      for (const { code, display } of opts) {
        const lbl = document.createElement("label");
        lbl.className = "radio-label";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = code;
        cb.checked = parseSelected().has(code);
        allCheckboxes.push(cb);
        cb.onchange = () => {
          const sel = parseSelected();
          if (cb.checked) {
            if (exclusives[code]) {
              sel.clear();
              sel.add(code);
              for (const other of allCheckboxes) {
                other.checked = other.value === code;
              }
            } else {
              sel.add(code);
              for (const exCode of Object.keys(exclusives)) {
                sel.delete(exCode);
              }
              for (const other of allCheckboxes) {
                if (exclusives[other.value]) other.checked = false;
              }
            }
          } else {
            sel.delete(code);
          }
          const v = serializeSelected(sel);
          setValue(node.id, v || void 0);
          _reCalc();
          onChange();
          BaseNode.notifyChanged(ctx.bus);
        };
        lbl.appendChild(cb);
        if (node._optionPrefixes && node._optionPrefixes[code] !== void 0) {
          const pfx = document.createElement("span");
          pfx.className = "option-prefix";
          pfx.textContent = node._optionPrefixes[code] + "\xA0";
          lbl.appendChild(pfx);
        }
        lbl.appendChild(document.createTextNode(display));
        if (node._optionOrdinals && node._optionOrdinals[code] !== void 0) {
          const ord = document.createElement("span");
          ord.className = "option-ordinal";
          ord.textContent = "\xA0(" + node._optionOrdinals[code] + ")";
          lbl.appendChild(ord);
        }
        _appendOptionExtras(lbl, node, code);
        wrap.appendChild(lbl);
      }
      return wrap;
    }
  };
  NODE_REGISTRY.set("select", ChoiceNode);
  NODE_REGISTRY.set("radio", RadioNode);
  NODE_REGISTRY.set("checklist", ChecklistNode);
  NODE_REGISTRY.set("open-choice", OpenChoiceNode);

  // js/ui/date-picker.js
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  var DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  function _parseISO(s) {
    if (!s || s.length < 10) return null;
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(5, 7), 10) - 1;
    const d = parseInt(s.slice(8, 10), 10);
    const h = s.length >= 16 ? parseInt(s.slice(11, 13), 10) || 0 : 0;
    const min = s.length >= 16 ? parseInt(s.slice(14, 16), 10) || 0 : 0;
    return isNaN(y) || isNaN(m) || isNaN(d) ? null : { y, m, d, h, min };
  }
  function _toISO(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function _formatDisplay(iso, withTime) {
    const p = _parseISO(iso);
    if (!p) return "";
    const base = `${p.d} ${MONTH_NAMES[p.m]} ${p.y}`;
    if (!withTime) return base;
    return `${base} \xB7 ${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
  }
  function createDatePicker({ value = "", onChange, className = "", testid, placeholder, withTime = false } = {}) {
    const _ph = placeholder || (withTime ? "\u2014 date & time \u2014" : "\u2014 date \u2014");
    let _value = value;
    let _handler = onChange || null;
    const trigger = document.createElement("div");
    trigger.className = "sc-trigger dp-trigger" + (className ? " " + className : "");
    trigger.tabIndex = 0;
    if (testid) trigger.dataset.testid = testid;
    const textSpan = document.createElement("span");
    textSpan.className = "sc-trigger-text";
    trigger.appendChild(textSpan);
    const _updateLabel = () => {
      const disp = _formatDisplay(_value, withTime);
      textSpan.textContent = disp || _ph;
      trigger.classList.toggle("sc-trigger--empty", !disp);
      trigger.dataset.value = _value;
    };
    _updateLabel();
    let calEl = null;
    let _viewY = 0, _viewM = 0;
    let _pendY = null, _pendM = null, _pendD = null;
    let _pendH = 0, _pendMin = 0;
    const _close2 = () => {
      if (calEl) {
        calEl.remove();
        calEl = null;
      }
      document.removeEventListener("mousedown", _onOutside, true);
      document.removeEventListener("keydown", _onEsc, true);
    };
    const _onOutside = (e) => {
      if (!trigger.contains(e.target) && !calEl?.contains(e.target)) _close2();
    };
    const _onEsc = (e) => {
      if (e.key === "Escape") {
        _close2();
        trigger.focus();
      }
    };
    const _open = () => {
      if (calEl) {
        _close2();
        return;
      }
      const parsed = _parseISO(_value);
      const today = /* @__PURE__ */ new Date();
      _viewY = parsed ? parsed.y : today.getFullYear();
      _viewM = parsed ? parsed.m : today.getMonth();
      _pendY = parsed ? parsed.y : null;
      _pendM = parsed ? parsed.m : null;
      _pendD = parsed ? parsed.d : null;
      _pendH = parsed ? parsed.h : 0;
      _pendMin = parsed ? parsed.min : 0;
      calEl = document.createElement("div");
      calEl.className = "dp-cal" + (withTime ? " dp-cal--dt" : "");
      document.body.appendChild(calEl);
      _renderCal();
      _position2();
      document.addEventListener("mousedown", _onOutside, true);
      document.addEventListener("keydown", _onEsc, true);
    };
    const _position2 = () => {
      if (!calEl) return;
      const rect = trigger.getBoundingClientRect();
      calEl.style.left = rect.left + "px";
      const calH = calEl.offsetHeight;
      if (rect.bottom + calH + 4 <= window.innerHeight) {
        calEl.style.top = rect.bottom + 2 + "px";
      } else {
        calEl.style.top = Math.max(4, rect.top - calH - 2) + "px";
      }
    };
    const _renderCal = () => {
      calEl.innerHTML = "";
      const y = _viewY, m = _viewM;
      const today = /* @__PURE__ */ new Date();
      const todayY = today.getFullYear();
      const todayM = today.getMonth();
      const todayD = today.getDate();
      const selParsed = withTime ? _pendY !== null ? { y: _pendY, m: _pendM, d: _pendD } : null : _parseISO(_value);
      const hdr = document.createElement("div");
      hdr.className = "dp-hdr";
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "dp-nav-btn";
      prevBtn.textContent = "\u2039";
      prevBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (_viewM === 0) {
          _viewM = 11;
          _viewY--;
        } else {
          _viewM--;
        }
        _renderCal();
      });
      const monthLbl = document.createElement("span");
      monthLbl.className = "dp-month-lbl";
      monthLbl.textContent = `${MONTH_NAMES[m]} ${y}`;
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "dp-nav-btn";
      nextBtn.textContent = "\u203A";
      nextBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (_viewM === 11) {
          _viewM = 0;
          _viewY++;
        } else {
          _viewM++;
        }
        _renderCal();
      });
      hdr.append(prevBtn, monthLbl, nextBtn);
      calEl.appendChild(hdr);
      const dayNamesRow = document.createElement("div");
      dayNamesRow.className = "dp-grid";
      for (const dn of DAY_NAMES) {
        const cell = document.createElement("div");
        cell.className = "dp-dn";
        cell.textContent = dn;
        dayNamesRow.appendChild(cell);
      }
      calEl.appendChild(dayNamesRow);
      const grid = document.createElement("div");
      grid.className = "dp-grid";
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement("div");
        blank.className = "dp-day dp-day--blank";
        grid.appendChild(blank);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        const isToday = y === todayY && m === todayM && d === todayD;
        const isSel = selParsed && y === selParsed.y && m === selParsed.m && d === selParsed.d;
        cell.className = "dp-day" + (isToday ? " dp-day--today" : "") + (isSel ? " dp-day--sel" : "");
        cell.textContent = d;
        const _y = y, _m = m, _d = d;
        cell.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (!withTime) {
            _value = _toISO(_y, _m, _d);
            _updateLabel();
            if (_handler) _handler(_value);
            _close2();
            trigger.focus();
          } else {
            _pendY = _y;
            _pendM = _m;
            _pendD = _d;
            _renderCal();
          }
        });
        grid.appendChild(cell);
      }
      calEl.appendChild(grid);
      const footer = document.createElement("div");
      footer.className = "dp-footer";
      if (withTime) {
        const timeRow = document.createElement("div");
        timeRow.className = "dp-time-row";
        const hInp = document.createElement("input");
        hInp.type = "number";
        hInp.min = "0";
        hInp.max = "23";
        hInp.step = "1";
        hInp.className = "dp-time-inp";
        hInp.value = String(_pendH).padStart(2, "0");
        hInp.addEventListener("mousedown", (e) => e.stopPropagation());
        hInp.addEventListener("input", () => {
          _pendH = Math.min(23, Math.max(0, parseInt(hInp.value, 10) || 0));
        });
        hInp.addEventListener("blur", () => {
          hInp.value = String(_pendH).padStart(2, "0");
        });
        const sep = document.createElement("span");
        sep.className = "dp-time-sep";
        sep.textContent = ":";
        const minInp = document.createElement("input");
        minInp.type = "number";
        minInp.min = "0";
        minInp.max = "59";
        minInp.step = "1";
        minInp.className = "dp-time-inp";
        minInp.value = String(_pendMin).padStart(2, "0");
        minInp.addEventListener("mousedown", (e) => e.stopPropagation());
        minInp.addEventListener("input", () => {
          _pendMin = Math.min(59, Math.max(0, parseInt(minInp.value, 10) || 0));
        });
        minInp.addEventListener("blur", () => {
          minInp.value = String(_pendMin).padStart(2, "0");
        });
        timeRow.append(hInp, sep, minInp);
        footer.appendChild(timeRow);
        const setBtn = document.createElement("button");
        setBtn.type = "button";
        setBtn.className = "dp-footer-btn dp-footer-btn--set";
        setBtn.textContent = "Set";
        setBtn.disabled = _pendY === null;
        setBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (_pendY === null) return;
          _value = `${_toISO(_pendY, _pendM, _pendD)}T${String(_pendH).padStart(2, "0")}:${String(_pendMin).padStart(2, "0")}:00`;
          _updateLabel();
          if (_handler) _handler(_value);
          _close2();
          trigger.focus();
        });
        const clearDtBtn = document.createElement("button");
        clearDtBtn.type = "button";
        clearDtBtn.className = "dp-footer-btn dp-footer-btn--clear";
        clearDtBtn.textContent = "Clear";
        clearDtBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          _value = "";
          _updateLabel();
          if (_handler) _handler("");
          _close2();
          trigger.focus();
        });
        footer.append(setBtn, clearDtBtn);
      } else {
        const todayBtn = document.createElement("button");
        todayBtn.type = "button";
        todayBtn.className = "dp-footer-btn";
        todayBtn.textContent = "Today";
        todayBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          _value = _toISO(todayY, todayM, todayD);
          _updateLabel();
          if (_handler) _handler(_value);
          _close2();
          trigger.focus();
        });
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "dp-footer-btn dp-footer-btn--clear";
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          _value = "";
          _updateLabel();
          if (_handler) _handler("");
          _close2();
          trigger.focus();
        });
        footer.append(todayBtn, clearBtn);
      }
      calEl.appendChild(footer);
      setTimeout(_position2, 0);
    };
    trigger.addEventListener("click", _open);
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        _open();
      }
      if (e.key === "Escape") _close2();
    });
    trigger._dpSetValue = (v) => {
      _value = v || "";
      _updateLabel();
      if (_handler) _handler(_value);
    };
    return {
      el: trigger,
      getValue() {
        return _value;
      },
      setValue(v) {
        _value = v || "";
        _updateLabel();
      }
    };
  }

  // js/nodes/date-node.js
  var DateNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "date";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const dp = createDatePicker({
        value: getValue(node.id) || "",
        onChange: (v) => {
          setValue(node.id, v || void 0);
          _reCalc();
          onChange();
          BaseNode.notifyChanged(ctx.bus);
        },
        className: "ctrl-input--date",
        testid: "date-input"
      });
      wrap.appendChild(dp.el);
      return wrap;
    }
  };
  var DateTimeNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "dateTime";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const dp = createDatePicker({
        value: getValue(node.id) || "",
        onChange: (v) => {
          setValue(node.id, v || void 0);
          _reCalc();
          onChange();
          BaseNode.notifyChanged(ctx.bus);
        },
        withTime: true,
        className: "ctrl-input--date",
        testid: "datetime-input"
      });
      wrap.appendChild(dp.el);
      return wrap;
    }
  };
  var TimeNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "time";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const el = document.createElement("input");
      el.type = "time";
      el.className = "ctrl-input ctrl-input--time";
      el.dataset.testid = "time-input";
      const stored = getValue(node.id);
      el.value = stored ? String(stored).slice(0, 5) : "";
      el.addEventListener("change", () => {
        const v = el.value;
        setValue(node.id, v ? v + ":00" : void 0);
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
      });
      wrap.appendChild(el);
      return wrap;
    }
  };
  NODE_REGISTRY.set("date", DateNode);
  NODE_REGISTRY.set("dateTime", DateTimeNode);
  NODE_REGISTRY.set("time", TimeNode);

  // js/nodes/checkbox-node.js
  var CheckboxNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "checkbox";
    }
    supportsRepeat() {
      return false;
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const el = document.createElement("input");
      el.type = "checkbox";
      const initialVal = getValue(node.id);
      if (initialVal === void 0) {
        el.indeterminate = true;
        el.dataset.testid = "checkbox-indeterminate";
      } else {
        el.checked = initialVal === true;
      }
      el.onchange = () => {
        setValue(node.id, el.checked);
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
      };
      wrap.appendChild(el);
      return wrap;
    }
  };
  NODE_REGISTRY.set("checkbox", CheckboxNode);

  // js/nodes/url-node.js
  var UrlNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "url";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      wrap.className = "ctrl-wrap ctrl-wrap--text";
      const el = document.createElement("textarea");
      el.className = "ctrl-input--text";
      el.rows = 1;
      el.placeholder = node._entryFormat || "https://";
      el.value = getValue(node.id) !== void 0 ? getValue(node.id) : "";
      const autoResize = () => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      };
      const isValidUrl = (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      };
      if (node._maxLength) el.maxLength = node._maxLength;
      if (node._minLength) el.minLength = node._minLength;
      const errMsg = document.createElement("span");
      errMsg.className = "ctrl-err ctrl-err--ml";
      errMsg.textContent = "Invalid URL";
      errMsg.style.display = "none";
      const _regexObj = (() => {
        if (!node._regex) return null;
        try {
          return new RegExp(node._regex);
        } catch {
          return null;
        }
      })();
      const validateErr = () => {
        if (node._minLength && el.value.length > 0 && el.value.length < node._minLength) {
          errMsg.textContent = "Min\xA0" + node._minLength + "\xA0chars";
          errMsg.style.display = "inline";
        } else if (_regexObj && el.value.length > 0 && !_regexObj.test(el.value)) {
          errMsg.textContent = "Does not match pattern";
          errMsg.style.display = "inline";
        } else {
          errMsg.textContent = "Invalid URL";
          errMsg.style.display = el.value === "" || isValidUrl(el.value) ? "none" : "inline";
        }
      };
      if (node._interacted || el.value && !isValidUrl(el.value)) validateErr();
      let counter = null;
      if (node._maxLength) {
        counter = document.createElement("span");
        counter.className = "ctrl-char-counter";
        counter.dataset.testid = "char-counter";
        const updateCounter = () => {
          counter.textContent = el.value.length + "\xA0/\xA0" + node._maxLength;
        };
        updateCounter();
        el.addEventListener("input", updateCounter);
      }
      let _debounce = null;
      el.oninput = () => {
        setValue(node.id, el.value);
        autoResize();
        clearTimeout(_debounce);
        _debounce = setTimeout(() => {
          _reCalc();
          onChange();
        }, 200);
      };
      el.onchange = () => {
        BaseNode.notifyChanged(ctx.bus);
      };
      el.addEventListener("blur", () => {
        node._interacted = true;
        validateErr();
      });
      wrap.appendChild(el);
      wrap.appendChild(errMsg);
      if (counter) wrap.appendChild(counter);
      if (el.value) requestAnimationFrame(autoResize);
      return wrap;
    }
  };
  NODE_REGISTRY.set("url", UrlNode);

  // js/nodes/attachment-node.js
  var AttachmentNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "attachment";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const el = document.createElement("input");
      el.type = "file";
      el.className = "file-input-hidden";
      if (node._mimeTypes && node._mimeTypes.length) el.accept = node._mimeTypes.join(",");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-file";
      btn.textContent = "Choose file";
      btn.onclick = () => el.click();
      const nameTag = document.createElement("span");
      nameTag.className = "file-name-tag";
      nameTag.textContent = getValue(node.id) ? getValue(node.id).name : "No file chosen";
      const sizeHint = document.createElement("span");
      sizeHint.className = "file-size-hint";
      if (node._maxFileSizeMB !== void 0) sizeHint.textContent = `Max ${node._maxFileSizeMB} MB`;
      const mimeHint = document.createElement("span");
      mimeHint.className = "file-size-hint";
      mimeHint.dataset.testid = "mime-hint";
      if (node._mimeTypes && node._mimeTypes.length) mimeHint.textContent = node._mimeTypes.join(", ");
      el.onchange = () => {
        const file = el.files[0] || null;
        if (file && node._maxFileSizeMB !== void 0 && file.size > node._maxFileSizeMB * 1024 * 1024) {
          showError(`File too large \u2014 max ${node._maxFileSizeMB} MB allowed`);
          el.value = "";
          setValue(node.id, null);
          _reCalc();
          onChange();
          BaseNode.notifyChanged(ctx.bus);
          return;
        }
        nameTag.classList.remove("file-name-tag--error");
        setValue(node.id, file ? { name: file.name, size: file.size, type: file.type } : null);
        nameTag.textContent = file ? file.name : "No file chosen";
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
      };
      wrap.appendChild(el);
      wrap.appendChild(btn);
      wrap.appendChild(nameTag);
      if (node._maxFileSizeMB !== void 0) wrap.appendChild(sizeHint);
      if (node._mimeTypes && node._mimeTypes.length) wrap.appendChild(mimeHint);
      return wrap;
    }
  };
  NODE_REGISTRY.set("attachment", AttachmentNode);

  // js/ui/custom-select.js
  function createCustomSelect({ items = [], value = "", onChange, className = "", testid, searchable, ariaLabel } = {}) {
    let _items = items.slice();
    let _value = value;
    let _handler = onChange || null;
    let _activeIdx = -1;
    const _uid = nextUid("csel");
    const trigger = document.createElement("div");
    trigger.className = "sc-trigger" + (className ? " " + className : "");
    trigger.tabIndex = 0;
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);
    if (testid) trigger.dataset.testid = testid;
    const textSpan = document.createElement("span");
    textSpan.className = "sc-trigger-text";
    trigger.appendChild(textSpan);
    const _updateLabel = () => {
      const found = _items.find((it) => it.value === _value);
      textSpan.textContent = found ? found.label : "\u2014 " + (_value || "select") + " \u2014";
      trigger.classList.toggle("sc-trigger--empty", !found);
      trigger.dataset.value = _value;
    };
    _updateLabel();
    let dropEl = null;
    const _close2 = () => {
      if (dropEl) {
        dropEl.remove();
        dropEl = null;
      }
      _activeIdx = -1;
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      document.removeEventListener("mousedown", _onOutside, true);
      document.removeEventListener("keydown", _onKey, true);
    };
    const _onOutside = (e) => {
      if (!trigger.contains(e.target) && !dropEl?.contains(e.target)) _close2();
    };
    const _visibleOpts = () => dropEl ? [...dropEl.querySelectorAll(".oc-opt")].filter((o) => o.style.display !== "none") : [];
    const _setActive = (idx) => {
      const opts = _visibleOpts();
      if (!opts.length) return;
      _activeIdx = Math.max(0, Math.min(idx, opts.length - 1));
      opts.forEach((o, i) => o.classList.toggle("oc-opt--active", i === _activeIdx));
      const el = opts[_activeIdx];
      trigger.setAttribute("aria-activedescendant", el.id);
      el.scrollIntoView({ block: "nearest" });
    };
    const _onKey = (e) => {
      if (e.key === "Escape") {
        _close2();
        trigger.focus();
        return;
      }
      const opts = _visibleOpts();
      if (!opts.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _setActive(_activeIdx + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _setActive(_activeIdx - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        _setActive(0);
      } else if (e.key === "End") {
        e.preventDefault();
        _setActive(opts.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const el = opts[_activeIdx] || opts[0];
        const item = _items.find((it) => it.value === el.dataset.val);
        if (item) _pick(item);
      }
    };
    const _pick = (item) => {
      _value = item.value;
      _updateLabel();
      if (_handler) _handler(item.value, item);
      _close2();
      trigger.focus();
    };
    const _open = () => {
      if (dropEl) {
        _close2();
        return;
      }
      const useSearch = searchable !== void 0 ? searchable : _items.length > 8;
      dropEl = document.createElement("div");
      dropEl.className = "oc-drop csel-drop";
      dropEl.dataset.testid = "csel-drop";
      dropEl.id = _uid + "-list";
      dropEl.setAttribute("role", "listbox");
      trigger.setAttribute("aria-controls", dropEl.id);
      trigger.setAttribute("aria-expanded", "true");
      const _initActive = () => {
        const opts = _visibleOpts();
        const sel = opts.findIndex((o) => o.dataset.val === _value);
        _setActive(sel >= 0 ? sel : 0);
      };
      if (useSearch) {
        const searchInp = document.createElement("input");
        searchInp.type = "text";
        searchInp.className = "vis-q-sel-search";
        searchInp.placeholder = "Search\u2026";
        searchInp.addEventListener("mousedown", (ev) => ev.stopPropagation());
        dropEl.appendChild(searchInp);
        const opts = _renderOpts(dropEl);
        searchInp.addEventListener("input", () => {
          const q = searchInp.value.toLowerCase();
          for (const opt of opts) {
            const match = !q || opt.dataset.val.toLowerCase().includes(q) || opt.textContent.toLowerCase().includes(q);
            opt.style.display = match ? "" : "none";
          }
          _setActive(0);
        });
        document.body.appendChild(dropEl);
        _position2();
        _initActive();
        document.addEventListener("mousedown", _onOutside, true);
        document.addEventListener("keydown", _onKey, true);
        setTimeout(() => searchInp.focus(), 0);
      } else {
        _renderOpts(dropEl);
        document.body.appendChild(dropEl);
        _position2();
        _initActive();
        document.addEventListener("mousedown", _onOutside, true);
        document.addEventListener("keydown", _onKey, true);
      }
    };
    const _renderOpts = (container) => {
      const created = [];
      _items.forEach((item, i) => {
        const opt = document.createElement("div");
        opt.className = "oc-opt" + (item.value === _value ? " oc-opt--sel" : "");
        opt.id = _uid + "-opt-" + i;
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", String(item.value === _value));
        opt.textContent = item.label;
        opt.dataset.val = item.value;
        if (item.title) opt.dataset.tipTitle = item.title;
        opt.addEventListener("mousedown", (e) => {
          e.preventDefault();
          _pick(item);
        });
        container.appendChild(opt);
        created.push(opt);
      });
      return created;
    };
    const _position2 = () => {
      const rect = trigger.getBoundingClientRect();
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom - 4;
      const spaceAbove = rect.top - 4;
      const maxAllowed = 200;
      dropEl.style.left = rect.left + "px";
      dropEl.style.minWidth = rect.width + "px";
      if (spaceBelow >= Math.min(maxAllowed, spaceAbove)) {
        const cap = Math.min(maxAllowed, Math.max(spaceBelow, 60));
        dropEl.style.maxHeight = cap + "px";
        dropEl.style.top = rect.bottom + 2 + "px";
      } else {
        const cap = Math.min(maxAllowed, Math.max(spaceAbove, 60));
        dropEl.style.maxHeight = cap + "px";
        dropEl.style.top = rect.top - Math.min(cap, dropEl.offsetHeight || cap) - 2 + "px";
      }
    };
    trigger.addEventListener("click", _open);
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!dropEl) _open();
      } else if (e.key === "Escape") {
        _close2();
      }
    });
    return {
      el: trigger,
      getValue() {
        return _value;
      },
      setValue(v) {
        _value = v;
        _updateLabel();
        if (dropEl) {
          for (const opt of dropEl.querySelectorAll(".oc-opt")) {
            const sel = opt.dataset.val === _value;
            opt.classList.toggle("oc-opt--sel", sel);
            opt.setAttribute("aria-selected", String(sel));
          }
        }
      },
      setOptions(newItems) {
        _items = newItems.slice();
        const prev = _value;
        if (!_items.find((it) => it.value === prev)) _value = _items[0]?.value ?? "";
        _updateLabel();
        if (dropEl) {
          _close2();
        }
      },
      setOnChange(fn) {
        _handler = fn;
      }
    };
  }

  // js/fhir/fhir-search.js
  var CORS_ENABLED_HOSTS = [
    "hapi.fhir.org",
    "r4.smarthealthit.org",
    "launch.smarthealthit.org",
    "test.ahdis.ch",
    // Matchbox SDC server
    "terminology.hl7.org"
    // HL7 terminology server
  ];
  function proxiedUrl(url, corsProxy) {
    const proxy = ((corsProxy ?? serverConfig.get(CONFIG_KEYS.CORS_PROXY)) || "").replace(/\/$/, "");
    if (!proxy) return url;
    try {
      const { hostname } = new URL(url);
      if (CORS_ENABLED_HOSTS.includes(hostname)) return url;
    } catch {
    }
    return `${proxy}?url=${encodeURIComponent(url)}`;
  }
  function displayName(resource) {
    const type = resource.resourceType;
    if (["Patient", "Practitioner", "RelatedPerson", "Person"].includes(type)) {
      const name = resource.name?.[0];
      if (name) {
        const family = name.family || "";
        const given = (name.given || []).join(" ");
        return [family, given].filter(Boolean).join(", ") || name.text || resource.id;
      }
    }
    if (["Organization", "Location", "HealthcareService"].includes(type)) return resource.name || resource.id;
    if (["Encounter", "EpisodeOfCare"].includes(type)) {
      const patName = resource.subject?.display || resource.patient?.display || "";
      const status = resource.status ? `[${resource.status}]` : "";
      const date = resource.period?.start?.slice(0, 10) || "";
      return [patName, date, status].filter(Boolean).join(" ") || resource.id;
    }
    if (["Condition", "Observation", "Procedure"].includes(type)) {
      const code = resource.code?.coding?.[0]?.display || resource.code?.text || "";
      const patient = resource.subject?.display || "";
      return [code, patient].filter(Boolean).join(" \u2014 ") || resource.id;
    }
    return resource.name || resource.title || resource.id;
  }
  function _searchParam(resourceType) {
    if (["Patient", "Practitioner", "RelatedPerson", "Person"].includes(resourceType)) return "name";
    if (["Organization", "Location", "HealthcareService", "Medication"].includes(resourceType)) return "name";
    if ([
      "Encounter",
      "EpisodeOfCare",
      "Condition",
      "Observation",
      "Procedure",
      "DiagnosticReport",
      "MedicationRequest",
      "ServiceRequest"
    ].includes(resourceType)) return "patient.name";
    if (["Medication", "Substance"].includes(resourceType)) return "code";
    return "_id";
  }
  async function searchFhir(resourceType, query, count = 10, opts = {}) {
    const base = ((opts.fhirBase ?? serverConfig.get(CONFIG_KEYS.FHIR_BASE)) || "").replace(/\/$/, "");
    if (!base || !resourceType || !query.trim()) return [];
    const params = new URLSearchParams({ _count: String(count) });
    params.set(_searchParam(resourceType), query);
    const url = proxiedUrl(`${base}/${resourceType}?${params}`, opts.corsProxy);
    const res = await fetch(url, {
      headers: { Accept: "application/fhir+json" },
      signal: AbortSignal.timeout(6e3)
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const oo = await res.json();
        const diag = oo?.issue?.[0]?.diagnostics;
        if (diag) msg += " \u2014 " + diag.substring(0, 120);
      } catch {
      }
      throw new Error(msg);
    }
    const bundle = await res.json();
    return (bundle.entry || []).map((e) => ({ id: e.resource?.id || "", display: displayName(e.resource) })).filter((r) => r.id);
  }

  // js/fhir/form-checks.js
  var CHECKABLE_TYPES = /* @__PURE__ */ new Set(["checkbox", "text", "number", "date", "dateTime", "time", "url", "attachment", "open-choice", "decimal", "integer", "quantity", "reference", "radio", "select", "checklist"]);
  var NONEMPTY_TYPES = /* @__PURE__ */ new Set(["text", "number", "date", "dateTime", "time", "open-choice", "decimal", "integer", "radio", "select", "checklist"]);
  var isMandatory = (node) => node.mandatory === true;
  function evalConstraints(node, fp, qr, varEnv) {
    if (!node.constraint || !node.constraint.length) return true;
    if (!fp || !qr) return true;
    const env = { resource: qr, ...varEnv };
    for (const c of node.constraint) {
      if (!c.expression || c.severity !== "error") continue;
      try {
        const result = fp.evaluate(qr, c.expression, env, fhirModel());
        if (!result || result.length === 0 || result[0] === false) return false;
      } catch {
        return false;
      }
    }
    return true;
  }
  function _isValidUrl(s) {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  }
  function refTypeMismatch(value, allowedType) {
    if (!allowedType) return false;
    const ref = value && typeof value === "object" ? value.reference : "";
    if (!ref) return false;
    const t = String(ref).split("/")[0];
    return !!t && t !== allowedType;
  }
  function calcFormOk(node, store, path) {
    if (path && path.length) {
      const base = store;
      store = { get: (id) => base.get(id, path) };
    }
    if (node._calculatedExpr && node._readOnly) {
      if (node.itemType !== "checkbox") return true;
      return store.get(node.id) === true;
    }
    if (node.itemType === "reference" && node.referenceResource && refTypeMismatch(store.get(node.id), node.referenceResource)) {
      return false;
    }
    if (node.itemType === "checkbox" && isMandatory(node)) {
      const val = store.get(node.id);
      return val === true || val === false;
    }
    if (node.itemType === "url") {
      const val = store.get(node.id);
      if (!val || val === "") return !isMandatory(node);
      if (!_isValidUrl(val)) return false;
      if (node._regex) {
        try {
          if (!new RegExp(node._regex).test(val)) return false;
        } catch {
        }
      }
      return true;
    }
    if (node.itemType === "attachment") {
      const val = store.get(node.id);
      if (val && node._maxFileSizeMB !== void 0) {
        if (val.size > node._maxFileSizeMB * 1024 * 1024) return false;
      }
      if (!isMandatory(node)) return true;
      return val != null;
    }
    if (node.itemType === "integer" || node.itemType === "decimal" || node.itemType === "number") {
      const val = store.get(node.id);
      if (val !== void 0 && val !== "" && val !== null) {
        const num = Number(val);
        if (!isFinite(num)) return false;
        if (node._minValue !== void 0 && num < Number(node._minValue)) return false;
        if (node._maxValue !== void 0 && num > Number(node._maxValue)) return false;
        if (node._maxDecimalPlaces !== void 0) {
          const parts = String(val).split(".");
          if (parts.length > 1 && parts[1].length > node._maxDecimalPlaces) return false;
        }
      }
      if (isMandatory(node)) return val !== void 0 && val !== "" && val !== null;
      return true;
    }
    if (node.mandatory === false) return true;
    if (node.itemType === "reference") {
      if (!isMandatory(node)) return true;
      const val = store.get(node.id);
      return val != null && typeof val === "object" && !!val.reference;
    }
    if (node.itemType === "quantity") {
      if (!isMandatory(node)) return true;
      const val = store.get(node.id);
      return val != null && typeof val === "object" && val.value !== void 0 && !!val.unit;
    }
    if (node._minLength) {
      const val = store.get(node.id);
      if (val && String(val).length > 0 && String(val).length < node._minLength) return false;
    }
    if (node._regex) {
      const val = store.get(node.id);
      if (val && String(val).length > 0) {
        try {
          if (!new RegExp(node._regex).test(String(val))) return false;
        } catch {
        }
      }
    }
    if (isMandatory(node) && NONEMPTY_TYPES.has(node.itemType)) {
      const val = store.get(node.id);
      return val !== void 0 && val !== "" && val !== null;
    }
    return true;
  }

  // js/nodes/reference-node.js
  var FHIR_R4_RESOURCES = [
    "Account",
    "ActivityDefinition",
    "AdverseEvent",
    "AllergyIntolerance",
    "Appointment",
    "AppointmentResponse",
    "AuditEvent",
    "Basic",
    "Binary",
    "BiologicallyDerivedProduct",
    "BodyStructure",
    "Bundle",
    "CapabilityStatement",
    "CarePlan",
    "CareTeam",
    "ChargeItem",
    "ChargeItemDefinition",
    "Claim",
    "ClaimResponse",
    "ClinicalImpression",
    "CodeSystem",
    "Communication",
    "CommunicationRequest",
    "CompartmentDefinition",
    "Composition",
    "ConceptMap",
    "Condition",
    "Consent",
    "Contract",
    "Coverage",
    "CoverageEligibilityRequest",
    "CoverageEligibilityResponse",
    "DetectedIssue",
    "Device",
    "DeviceDefinition",
    "DeviceMetric",
    "DeviceRequest",
    "DeviceUseStatement",
    "DiagnosticReport",
    "DocumentManifest",
    "DocumentReference",
    "Encounter",
    "Endpoint",
    "EnrollmentRequest",
    "EnrollmentResponse",
    "EpisodeOfCare",
    "EventDefinition",
    "ExplanationOfBenefit",
    "FamilyMemberHistory",
    "Flag",
    "Goal",
    "Group",
    "GuidanceResponse",
    "HealthcareService",
    "ImagingStudy",
    "Immunization",
    "ImmunizationEvaluation",
    "ImmunizationRecommendation",
    "ImplementationGuide",
    "InsurancePlan",
    "Invoice",
    "Library",
    "Linkage",
    "List",
    "Location",
    "Measure",
    "MeasureReport",
    "Media",
    "Medication",
    "MedicationAdministration",
    "MedicationDispense",
    "MedicationKnowledge",
    "MedicationRequest",
    "MedicationStatement",
    "MessageDefinition",
    "MessageHeader",
    "MolecularSequence",
    "NamingSystem",
    "NutritionOrder",
    "Observation",
    "ObservationDefinition",
    "OperationDefinition",
    "OperationOutcome",
    "Organization",
    "OrganizationAffiliation",
    "Parameters",
    "Patient",
    "PaymentNotice",
    "PaymentReconciliation",
    "Person",
    "PlanDefinition",
    "Practitioner",
    "PractitionerRole",
    "Procedure",
    "Provenance",
    "Questionnaire",
    "QuestionnaireResponse",
    "RelatedPerson",
    "RequestGroup",
    "ResearchStudy",
    "ResearchSubject",
    "RiskAssessment",
    "Schedule",
    "SearchParameter",
    "ServiceRequest",
    "Slot",
    "Specimen",
    "SpecimenDefinition",
    "StructureDefinition",
    "StructureMap",
    "Subscription",
    "Substance",
    "SupplyDelivery",
    "SupplyRequest",
    "Task",
    "TerminologyCapabilities",
    "TestReport",
    "TestScript",
    "ValueSet",
    "VerificationResult",
    "VisionPrescription"
  ];
  var ReferenceNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "reference";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      wrap.classList.add("ctrl-wrap--joined");
      const current = getValue(node.id);
      const existing = current ? current.reference || "" : "";
      const slashIdx = existing.indexOf("/");
      const initType = slashIdx > -1 ? existing.slice(0, slashIdx) : node.referenceResource || "";
      const initId = slashIdx > -1 ? existing.slice(slashIdx + 1) : "";
      const typeItems = node.referenceResource ? [{ value: node.referenceResource, label: node.referenceResource }] : [{ value: "", label: "\u2014 type \u2014" }, ...FHIR_R4_RESOURCES.map((r) => ({ value: r, label: r }))];
      const sel = createCustomSelect({
        items: typeItems,
        value: initType || "",
        className: "ref-type-sel",
        onChange: () => {
          update();
          BaseNode.notifyChanged(ctx.bus);
        }
      });
      const sep = document.createElement("span");
      sep.textContent = "/";
      sep.className = "ref-sep";
      const idInput = document.createElement("input");
      idInput.type = "text";
      idInput.placeholder = ctx.fhirBase ? "search or enter id" : "id";
      idInput.value = initId;
      idInput.className = "ref-id-input";
      const errMsg = document.createElement("span");
      errMsg.className = "ctrl-err ctrl-err--ml";
      errMsg.textContent = "id is required";
      const typeErr = document.createElement("span");
      typeErr.className = "ctrl-err ctrl-err--ml";
      typeErr.dataset.testid = "ref-type-error";
      typeErr.style.display = "none";
      const refreshTypeErr = () => {
        const cur = getValue(node.id);
        const mismatch = !!node.referenceResource && refTypeMismatch(cur, node.referenceResource);
        typeErr.textContent = mismatch ? `Expected ${node.referenceResource}` : "";
        typeErr.style.display = mismatch ? "inline" : "none";
      };
      const update = () => {
        const type = sel.getValue();
        const id = idInput.value.trim();
        errMsg.style.display = type && !id ? "inline" : "none";
        setValue(node.id, type && id ? { reference: type + "/" + id } : void 0);
        refreshTypeErr();
        _reCalc();
        onChange();
      };
      idInput.oninput = update;
      idInput.onchange = () => {
        BaseNode.notifyChanged(ctx.bus);
      };
      if (ctx.fhirBase) {
        const searchWrap = document.createElement("div");
        searchWrap.className = "ref-search-wrap";
        const dropdown = document.createElement("div");
        dropdown.className = "ref-search-drop";
        dropdown.style.display = "none";
        document.body.appendChild(dropdown);
        const positionDrop = () => {
          const r = idInput.getBoundingClientRect();
          const dropW = 240;
          dropdown.style.position = "fixed";
          dropdown.style.top = r.bottom + 4 + "px";
          dropdown.style.width = dropW + "px";
          dropdown.style.maxHeight = "220px";
          const left = r.right - dropW;
          dropdown.style.left = Math.max(4, left) + "px";
        };
        let _debounceTimer = null;
        const closeDropdown = () => {
          dropdown.style.display = "none";
        };
        const openDropdown = () => {
          positionDrop();
          dropdown.style.display = "block";
        };
        const showResults = (results, query) => {
          dropdown.innerHTML = "";
          if (results.length === 0) {
            const empty = document.createElement("div");
            empty.className = "ref-search-empty";
            empty.textContent = query.trim() ? "No results" : "Type to search\u2026";
            dropdown.appendChild(empty);
          } else {
            results.forEach((r) => {
              const item = document.createElement("button");
              item.type = "button";
              item.className = "ref-search-item";
              const nameSpan = document.createElement("span");
              nameSpan.className = "ref-search-name";
              nameSpan.textContent = r.display;
              const idSpan = document.createElement("span");
              idSpan.className = "ref-search-id";
              idSpan.textContent = r.id;
              item.append(nameSpan, idSpan);
              item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                idInput.value = r.id;
                update();
                BaseNode.notifyChanged(ctx.bus);
                closeDropdown();
              });
              dropdown.appendChild(item);
            });
          }
          openDropdown();
        };
        const doSearch = async (query) => {
          const resourceType = sel.getValue();
          if (!resourceType) {
            closeDropdown();
            return;
          }
          const loading = document.createElement("div");
          loading.className = "ref-search-empty";
          loading.textContent = "Searching\u2026";
          dropdown.innerHTML = "";
          dropdown.appendChild(loading);
          openDropdown();
          try {
            const results = await searchFhir(resourceType, query, 10, { fhirBase: ctx.fhirBase, corsProxy: ctx.corsProxy });
            showResults(results, query);
          } catch (e) {
            const err = document.createElement("div");
            err.className = "ref-search-empty ref-search-error";
            err.textContent = e.message || "Search failed";
            dropdown.innerHTML = "";
            dropdown.appendChild(err);
          }
        };
        idInput.addEventListener("input", () => {
          clearTimeout(_debounceTimer);
          const q = idInput.value.trim();
          if (!q) {
            closeDropdown();
            return;
          }
          _debounceTimer = setTimeout(() => doSearch(q), 350);
        });
        idInput.addEventListener("focus", () => {
          if (idInput.value.trim()) doSearch(idInput.value.trim());
        });
        idInput.addEventListener("blur", () => {
          setTimeout(closeDropdown, 150);
        });
        if (node._ac?.signal) {
          node._ac.signal.addEventListener("abort", () => {
            dropdown.remove();
          }, { once: true });
        }
        searchWrap.appendChild(idInput);
        wrap.appendChild(sel.el);
        wrap.appendChild(sep);
        wrap.appendChild(searchWrap);
      } else {
        wrap.appendChild(sel.el);
        wrap.appendChild(sep);
        wrap.appendChild(idInput);
      }
      wrap.appendChild(errMsg);
      wrap.appendChild(typeErr);
      refreshTypeErr();
      if (node._referenceProfiles?.length) {
        const info = document.createElement("span");
        info.className = "ctrl-ref-info";
        info.textContent = "Profile: " + node._referenceProfiles.join(", ");
        info.dataset.tipTitle = "questionnaire-referenceProfile";
        info.dataset.tipBody = "Allowed profiles:\n" + node._referenceProfiles.join("\n");
        info.dataset.tipFhir = "item.extension[questionnaire-referenceProfile].valueCanonical";
        info.dataset.tipSpec = "R4";
        wrap.appendChild(info);
      }
      if (node._referenceFilter) {
        const info = document.createElement("span");
        info.className = "ctrl-ref-info";
        info.textContent = "Filter: " + node._referenceFilter;
        info.dataset.tipTitle = "questionnaire-referenceFilter";
        info.dataset.tipBody = "Server-side filter expression:\n" + node._referenceFilter;
        info.dataset.tipFhir = "item.extension[questionnaire-referenceFilter].valueString";
        info.dataset.tipSpec = "R4";
        wrap.appendChild(info);
      }
      return wrap;
    }
  };
  NODE_REGISTRY.set("reference", ReferenceNode);

  // js/nodes/quantity-node.js
  var QUANTITY_UNITS = [
    { label: "\u2500\u2500 Mass \u2500\u2500", disabled: true },
    { label: "kg", value: "kg" },
    { label: "g", value: "g" },
    { label: "lb", value: "[lb_av]" },
    { label: "oz", value: "[oz_av]" },
    { label: "mg", value: "mg" },
    { label: "\xB5g", value: "ug" },
    { label: "\u2500\u2500 Length \u2500\u2500", disabled: true },
    { label: "cm", value: "cm" },
    { label: "m", value: "m" },
    { label: "mm", value: "mm" },
    { label: "in", value: "[in_i]" },
    { label: "ft", value: "[ft_i]" },
    { label: "\u2500\u2500 Volume \u2500\u2500", disabled: true },
    { label: "mL", value: "mL" },
    { label: "L", value: "L" },
    { label: "dL", value: "dL" },
    { label: "\u2500\u2500 Temperature \u2500\u2500", disabled: true },
    { label: "\xB0C", value: "Cel" },
    { label: "\xB0F", value: "[degF]" },
    { label: "\u2500\u2500 Pressure \u2500\u2500", disabled: true },
    { label: "mmHg", value: "mm[Hg]" },
    { label: "kPa", value: "kPa" },
    { label: "\u2500\u2500 Indices \u2500\u2500", disabled: true },
    { label: "kg/m\xB2", value: "kg/m2" },
    { label: "%", value: "%" },
    { label: "\u2500\u2500 Rates \u2500\u2500", disabled: true },
    { label: "/min", value: "/min" },
    { label: "beats/min", value: "{beats}/min" },
    { label: "breaths/min", value: "{breaths}/min" },
    { label: "\u2500\u2500 Time \u2500\u2500", disabled: true },
    { label: "min", value: "min" },
    { label: "h", value: "h" },
    { label: "d", value: "d" },
    { label: "wk", value: "wk" },
    { label: "mo", value: "mo" },
    { label: "a (year)", value: "a" },
    { label: "\u2500\u2500 Lab \u2500\u2500", disabled: true },
    { label: "mg/dL", value: "mg/dL" },
    { label: "mmol/L", value: "mmol/L" },
    { label: "g/dL", value: "g/dL" },
    { label: "mEq/L", value: "meq/L" },
    { label: "IU/L", value: "U/L" },
    { label: "IU", value: "[iU]" }
  ];
  var QuantityNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "quantity";
    }
    buildControl(ctx) {
      const node = this;
      const { getValue, setValue, onChange, _reCalc } = ctx;
      const wrap = createWrap();
      const current = getValue(node.id);
      const initVal = current ? current.value !== void 0 ? current.value : "" : "";
      const hasCustomUnits = node._unitOptions && node._unitOptions.length || node._unitValueSet;
      const initUnit = current ? current.unit || (!hasCustomUnits ? node.quantityUnit : "") || "" : !hasCustomUnits ? node.quantityUnit || "" : "";
      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.step = "any";
      numInput.placeholder = node._entryFormat || "0";
      numInput.value = initVal;
      numInput.className = "qty-num-input";
      numInput.dataset.testid = "qty-num-input";
      let unitItems;
      if (node._unitOptions && node._unitOptions.length) {
        unitItems = [
          { value: "", label: "\u2014 unit \u2014" },
          ...node._unitOptions.map((u) => ({ value: u.code, label: u.display || u.code }))
        ];
      } else if (node._unitValueSet) {
        const cached = node._unitVsCache || [];
        unitItems = [
          { value: "", label: "\u2014 unit \u2014" },
          ...cached.map((u) => ({ value: u.code, label: u.display || u.code }))
        ];
      } else {
        unitItems = [
          { value: "", label: "\u2014 unit \u2014" },
          ...QUANTITY_UNITS.filter((u) => !u.disabled).map((u) => ({ value: u.value, label: u.label }))
        ];
      }
      const unitSel = createCustomSelect({
        items: unitItems,
        value: initUnit || "",
        className: "qty-unit-sel",
        testid: "qty-unit-sel",
        onChange: () => {
          update();
        }
      });
      const errMsg = document.createElement("span");
      errMsg.className = "ctrl-err";
      const update = () => {
        const v = numInput.value.trim();
        const u = unitSel.getValue();
        const vNum = v !== "" ? parseFloat(v) : void 0;
        const hasVal = vNum !== void 0 && !isNaN(vNum);
        const hasUnit = !!u;
        if (hasVal && !hasUnit) {
          errMsg.textContent = "unit is required";
          errMsg.style.display = "inline";
        } else if (!hasVal && hasUnit) {
          errMsg.textContent = "value is required";
          errMsg.style.display = "inline";
        } else {
          errMsg.style.display = "none";
        }
        setValue(node.id, hasVal && hasUnit ? { value: vNum, unit: u } : void 0);
        _reCalc();
        onChange();
      };
      numInput.oninput = update;
      numInput.onchange = () => {
        BaseNode.notifyChanged(ctx.bus);
      };
      wrap.appendChild(numInput);
      wrap.appendChild(unitSel.el);
      wrap.appendChild(errMsg);
      return wrap;
    }
  };
  NODE_REGISTRY.set("quantity", QuantityNode);

  // js/nodes/display-node.js
  var FLYOVER_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="4.7" r="1" fill="currentColor"/><rect x="7.15" y="6.9" width="1.7" height="5" rx="0.85" fill="currentColor"/></svg>';
  var DisplayNode = class extends ItemNode {
    constructor(data = {}) {
      super(data);
      this.itemType = "display";
    }
    /** Display items have no interactive control. */
    buildControl(_ctx) {
      return createWrap();
    }
    supportsRepeat() {
      return false;
    }
    // ── Add displayCategory CSS class to the row ──────────────────────────────
    _initRowClass(row) {
      if (this._displayCategory) row.classList.add("lform-item--" + this._displayCategory);
    }
    // ── Label: help toggle or plain label with category icon ──────────────────
    _buildLabel(_res, rc) {
      const cat = this._displayCategory;
      if (cat === "help") {
        const wrap = document.createElement("span");
        wrap.className = "display-help-wrap";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "display-help-toggle";
        toggle.dataset.testid = "display-help-toggle";
        toggle.textContent = "? Help";
        const content = document.createElement("span");
        content.className = "display-help-content";
        content.dataset.testid = "display-help-content";
        this._applyLabelContent(content, rc);
        if (this._helpOpen) {
          content.classList.add("display-help-content--open");
          toggle.classList.add("display-help-toggle--open");
        }
        toggle.addEventListener("click", () => {
          this._helpOpen = !this._helpOpen;
          content.classList.toggle("display-help-content--open", this._helpOpen);
          toggle.classList.toggle("display-help-toggle--open", this._helpOpen);
        });
        wrap.append(toggle, content);
        return wrap;
      }
      const el = document.createElement("span");
      this._applyLabelContent(el, rc);
      return el;
    }
    // ── Row content: category icon + label (no control section) ──────────────
    _buildRowContent(row, res, rc) {
      this._initRowClass(row);
      if (this._itemControl === "flyover") {
        const fly = document.createElement("span");
        fly.className = "display-flyover";
        fly.dataset.testid = "display-flyover";
        fly.innerHTML = FLYOVER_SVG;
        fly.dataset.tipTitle = "Flyover";
        fly.dataset.tipBody = this.title;
        row.appendChild(fly);
        this._buildSupportLinks(row, rc);
        this._buildVisHint(row, rc);
        return;
      }
      const cat = this._displayCategory;
      if (cat && cat !== "help") {
        const catIcon = document.createElement("span");
        catIcon.className = "display-cat-icon display-cat-icon--" + cat;
        catIcon.dataset.testid = "display-category-icon";
        catIcon.textContent = cat === "instructions" ? "\u2139" : "\u26A0";
        catIcon.dataset.tipTitle = cat === "instructions" ? "Instructions" : "Security notice";
        catIcon.dataset.tipBody = "questionnaire-displayCategory: " + cat;
        catIcon.dataset.tipFhir = "item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code";
        catIcon.dataset.tipSpec = "R5";
        row.appendChild(catIcon);
      }
      const label = this._buildLabel(res, rc);
      if (this._renderStyle) applyRenderStyle(label, this._renderStyle);
      row.appendChild(label);
      this._buildSupportLinks(row, rc);
      this._buildVisHint(row, rc);
    }
  };
  NODE_REGISTRY.set("display", DisplayNode);

  // js/nodes/index.js
  function createGroupNode(data = {}) {
    if (typeof data === "string") data = { title: data };
    return new GroupNode({ title: data.title || "New Group", ...data });
  }
  function createItemNode(itemType, data = {}) {
    if (typeof data === "string") data = { title: data };
    const Cls = NODE_REGISTRY.get(itemType) ?? TextNode;
    return new Cls({ title: data.title || "New Item", ...data, itemType });
  }

  // js/fhir/import-item.js
  function fhirQuestionToItem(fhirItem, linkIdMap, contained) {
    let itemType = fhirTypeToItemType(fhirItem.type || "string");
    const itemCtrl = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.itemControl
    );
    const ctrlCode = itemCtrl?.valueCodeableConcept?.coding?.[0]?.code;
    if (itemType === "select" || itemType === "open-choice") {
      if (ctrlCode === "radio-button") itemType = "radio";
      else if (ctrlCode === "check-box") itemType = "checklist";
      else if (ctrlCode === "autocomplete" || ctrlCode === "drop-down") {
      }
    }
    const node = createItemNode(itemType, {
      id: fhirItem.linkId,
      title: fhirItem.text || fhirItem.linkId || "Item",
      mandatory: !!fhirItem.required
    });
    node.options = fhirOptsToStr(fhirItem.answerOption);
    const hasChoiceCol = (fhirItem.extension || []).some(
      (e) => e.url === FHIR.choiceColumn
    );
    if (fhirItem.answerOption && (hasNonCodingOpts(fhirItem.answerOption) || hasChoiceCol || hasCommaInCodingOpts(fhirItem.answerOption))) {
      node._rawAnswerOptions = JSON.parse(JSON.stringify(fhirItem.answerOption));
    }
    if (ctrlCode && ctrlCode !== "radio-button" && ctrlCode !== "check-box") {
      node._itemControl = ctrlCode;
    }
    const ordinals = {};
    for (const opt of fhirItem.answerOption || []) {
      if (opt.valueCoding) {
        const code = opt.valueCoding.code || opt.valueCoding.display || "";
        const ordExt = (opt.extension || []).find(
          (e) => e.url === FHIR.ordinalValue
        ) || (opt.valueCoding.extension || []).find(
          (e) => e.url === FHIR.ordinalValue
        );
        if (ordExt && ordExt.valueDecimal !== void 0 && code) {
          ordinals[code] = ordExt.valueDecimal;
        }
      }
    }
    if (Object.keys(ordinals).length) node._optionOrdinals = ordinals;
    const prefixes = {};
    for (const opt of fhirItem.answerOption || []) {
      if (opt.valueCoding) {
        const code = opt.valueCoding.code || opt.valueCoding.display || "";
        const pfxExt = (opt.extension || []).find(
          (e) => e.url === FHIR.optionPrefix
        );
        if (pfxExt?.valueString && code) prefixes[code] = pfxExt.valueString;
      }
    }
    if (Object.keys(prefixes).length) node._optionPrefixes = prefixes;
    const exclusives = {};
    for (const opt of fhirItem.answerOption || []) {
      if (opt.valueCoding) {
        const code = opt.valueCoding.code || opt.valueCoding.display || "";
        const exclExt = (opt.extension || []).find(
          (e) => e.url === FHIR.optionExclusive
        );
        if (exclExt?.valueBoolean && code) exclusives[code] = true;
      }
    }
    if (Object.keys(exclusives).length) node._optionExclusives = exclusives;
    const weights = {};
    for (const opt of fhirItem.answerOption || []) {
      if (opt.valueCoding) {
        const code = opt.valueCoding.code || opt.valueCoding.display || "";
        const wExt = (opt.extension || []).find(
          (e) => e.url === FHIR.itemWeight
        ) || (opt.valueCoding.extension || []).find(
          (e) => e.url === FHIR.itemWeight
        );
        if (wExt?.valueDecimal !== void 0 && code) weights[code] = wExt.valueDecimal;
      }
    }
    if (Object.keys(weights).length) node._optionWeights = weights;
    const answerMedias = {};
    for (const opt of fhirItem.answerOption || []) {
      if (opt.valueCoding) {
        const code = opt.valueCoding.code || opt.valueCoding.display || "";
        const amExt = (opt.extension || []).find(
          (e) => e.url === FHIR.answerMedia
        );
        if (amExt?.valueAttachment && code) answerMedias[code] = amExt.valueAttachment;
      }
    }
    if (Object.keys(answerMedias).length) node._answerMedias = answerMedias;
    applyVisibility(node, fhirItem, linkIdMap);
    applyConstraints(node, fhirItem);
    if (node.itemType === "reference") {
      const refResExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.referenceResource
      );
      if (refResExt && refResExt.valueCode) node.referenceResource = refResExt.valueCode;
      const refFilterExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.referenceFilter
      );
      if (refFilterExt?.valueString) node._referenceFilter = refFilterExt.valueString;
      const refProfileExts = (fhirItem.extension || []).filter(
        (e) => e.url === FHIR.referenceProfile
      );
      if (refProfileExts.length) {
        node._referenceProfiles = refProfileExts.map((e) => e.valueCanonical).filter(Boolean);
      }
    }
    if (node.itemType === "quantity" || node.itemType === "decimal" || node.itemType === "integer") {
      const unitExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.unit
      );
      if (unitExt?.valueCoding?.code) node.quantityUnit = unitExt.valueCoding.code;
      const unitVsExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.unitValueSet
      );
      if (unitVsExt?.valueCanonical) node._unitValueSet = unitVsExt.valueCanonical;
      const unitOptExts = (fhirItem.extension || []).filter(
        (e) => e.url === FHIR.unitOption
      );
      if (unitOptExts.length) {
        node._unitOptions = unitOptExts.filter((e) => e.valueCoding).map((e) => ({ system: e.valueCoding.system, code: e.valueCoding.code, display: e.valueCoding.display }));
      }
    }
    const rs = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-style"));
    if (rs) node._renderStyle = rs.valueString || "";
    const rx = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-xhtml"));
    if (rx) node._renderXhtml = rx.valueString || "";
    const rm = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-markdown"));
    if (rm) node._renderMarkdown = rm.valueMarkdown || rm.valueString || "";
    const calcExpr = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.calculatedExpression
    );
    if (calcExpr?.valueExpression) {
      node._calculatedExpr = calcExpr.valueExpression.expression || "";
    }
    const initExpr = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.initialExpression
    );
    if (initExpr?.valueExpression) {
      node._initialExpr = initExpr.valueExpression.expression || "";
    }
    for (const { url, prop } of ANSWER_SOURCE_EXPR_EXTS) {
      const exprExt = (fhirItem.extension || []).find((e) => e.url === url);
      if (exprExt?.valueExpression) node[prop] = exprExt.valueExpression.expression || "";
    }
    if (fhirItem.maxLength) node._maxLength = fhirItem.maxLength;
    if (fhirItem.answerConstraint) node._answerConstraint = fhirItem.answerConstraint;
    const acExt = (fhirItem.extension || []).find(
      (e) => e.url === ITEM_ANSWER_CONSTRAINT_EXTENSION_URL
    );
    if (acExt?.valueCode) node._answerConstraint = acExt.valueCode;
    const minLenExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.minLength
    );
    if (minLenExt?.valueInteger !== void 0) node._minLength = minLenExt.valueInteger;
    const regexExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.regex
    );
    if (regexExt?.valueString) node._regex = regexExt.valueString;
    const entryFmtExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.entryFormatSdc || e.url === FHIR.entryFormat
    );
    if (entryFmtExt?.valueString) node._entryFormat = entryFmtExt.valueString;
    const choiceOrientExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.choiceOrientation
    );
    if (choiceOrientExt?.valueCode) node._choiceOrientation = choiceOrientExt.valueCode;
    const columnCountExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.columnCount
    );
    if (Number.isInteger(columnCountExt?.valueInteger) && columnCountExt.valueInteger > 1) {
      node._columnCount = columnCountExt.valueInteger;
    }
    const choiceColExts = (fhirItem.extension || []).filter(
      (e) => e.url === FHIR.choiceColumn
    );
    if (choiceColExts.length) {
      node._choiceColumns = choiceColExts.map((ext) => {
        const sub = ext.extension || [];
        const col = {};
        const pathExt = sub.find((s) => s.url === "path");
        if (pathExt?.valueString) col.path = pathExt.valueString;
        const labelExt = sub.find((s) => s.url === "label");
        if (labelExt?.valueString) col.label = labelExt.valueString;
        const widthExt = sub.find((s) => s.url === "width");
        if (widthExt?.valueQuantity) col.width = widthExt.valueQuantity;
        const forDisplayExt = sub.find((s) => s.url === "forDisplay");
        if (forDisplayExt?.valueBoolean !== void 0) col.forDisplay = forDisplayExt.valueBoolean;
        return col;
      });
    }
    if (node.itemType === "display") {
      const dcExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.displayCategory
      );
      const dcCode = dcExt?.valueCodeableConcept?.coding?.[0]?.code;
      if (dcCode) node._displayCategory = dcCode;
    }
    const minValExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.minValue
    );
    if (minValExt) {
      const v = minValExt.valueDecimal ?? minValExt.valueInteger;
      if (v !== void 0) node._minValue = v;
    }
    const maxValExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.maxValue
    );
    if (maxValExt) {
      const v = maxValExt.valueDecimal ?? maxValExt.valueInteger;
      if (v !== void 0) node._maxValue = v;
    }
    const minOccExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.minOccurs
    );
    if (minOccExt?.valueInteger !== void 0) node._minOccurs = minOccExt.valueInteger;
    const maxOccExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.maxOccurs
    );
    if (maxOccExt?.valueInteger !== void 0) node._maxOccurs = maxOccExt.valueInteger;
    const maxDecExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.maxDecimalPlaces
    );
    if (maxDecExt?.valueInteger !== void 0) node._maxDecimalPlaces = maxDecExt.valueInteger;
    const sliderExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.sliderStepValue
    );
    if (sliderExt) {
      const v = sliderExt.valueDecimal ?? sliderExt.valueInteger;
      if (v !== void 0) node._sliderStep = v;
    }
    const maxSizeExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.maxSize
    );
    if (maxSizeExt?.valueDecimal !== void 0) node._maxFileSizeMB = maxSizeExt.valueDecimal;
    const mimeTypes = (fhirItem.extension || []).filter((e) => e.url === FHIR.mimeType && e.valueCode).map((e) => e.valueCode);
    if (mimeTypes.length) node._mimeTypes = mimeTypes;
    const supportLinks = (fhirItem.extension || []).filter((e) => e.url === FHIR.supportLink && e.valueUri).map((e) => e.valueUri);
    if (supportLinks.length) node._supportLinks = supportLinks;
    const hiddenExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.hiddenSdc || e.url === FHIR.hidden
    );
    if (hiddenExt?.valueBoolean === true) node._hidden = true;
    const isSubjectExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.isSubject
    );
    if (isSubjectExt?.valueBoolean === true) node._isSubject = true;
    const obsExtractExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.observationExtract
    );
    if (obsExtractExt) node._observationExtract = obsExtractExt.valueBoolean === false ? false : true;
    if (node.itemType === "open-choice") {
      const openLabelExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.openLabel
      );
      if (openLabelExt?.valueString) node._openLabel = openLabelExt.valueString;
    }
    const prefTermExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.preferredTerminologyServer
    );
    if (prefTermExt?.valueUrl) node._preferredTermServer = prefTermExt.valueUrl;
    const shortTextExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.shortText
    );
    if (shortTextExt?.valueString) node._shortText = shortTextExt.valueString;
    const designNoteExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.designNote
    );
    if (designNoteExt?.valueMarkdown) node._designNote = designNoteExt.valueMarkdown;
    else if (designNoteExt?.valueString) node._designNote = designNoteExt.valueString;
    const usageModeExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.usageMode
    );
    if (usageModeExt?.valueCode) node._usageMode = usageModeExt.valueCode;
    const sigExts = (fhirItem.extension || []).filter(
      (e) => e.url === FHIR.signatureRequired
    );
    if (sigExts.length) {
      node._signatureRequired = sigExts.filter((e) => e.valueCodeableConcept?.coding?.[0]).map((e) => {
        const c = e.valueCodeableConcept.coding[0];
        return { system: c.system || "", code: c.code || "", display: c.display || "" };
      });
    }
    const itemMediaExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.itemMedia
    );
    if (itemMediaExt?.valueAttachment) node._itemMedia = itemMediaExt.valueAttachment;
    if (fhirItem.disabledDisplay) node._disabledDisplay = fhirItem.disabledDisplay;
    const ddExt = (fhirItem.extension || []).find(
      (e) => e.url === ITEM_DISABLED_DISPLAY_EXTENSION_URL
    );
    if (ddExt?.valueCode) node._disabledDisplay = ddExt.valueCode;
    node._readOnly = !!fhirItem.readOnly;
    if (fhirItem.repeats || node.impliesRepeats()) node.repeats = true;
    if (fhirItem.prefix) node._prefix = fhirItem.prefix;
    if (fhirItem.definition) node._definition = fhirItem.definition;
    const baseTypeExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.baseType
    );
    if (baseTypeExt?.valueCode) node._baseType = baseTypeExt.valueCode;
    const fhirTypeExt = (fhirItem.extension || []).find(
      (e) => e.url === FHIR.fhirType
    );
    if (fhirTypeExt?.valueCode) node._fhirType = fhirTypeExt.valueCode;
    if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;
    if (fhirItem.answerValueSet) {
      node._answerValueSet = fhirItem.answerValueSet;
      const resolved = resolveContainedValueSet(contained, fhirItem.answerValueSet);
      if (resolved) node.options = resolved;
    }
    if (fhirItem.initial && fhirItem.initial.length) {
      const extractVal = (init4) => {
        if (init4.valueBoolean !== void 0) return init4.valueBoolean;
        if (init4.valueDecimal !== void 0) return String(init4.valueDecimal);
        if (init4.valueInteger !== void 0) return String(init4.valueInteger);
        if (init4.valueDate !== void 0) return init4.valueDate;
        if (init4.valueDateTime !== void 0) return init4.valueDateTime;
        if (init4.valueTime !== void 0) return init4.valueTime;
        if (init4.valueString !== void 0) return init4.valueString;
        if (init4.valueUri !== void 0) return init4.valueUri;
        if (init4.valueCoding) return init4.valueCoding.code || init4.valueCoding.display || "";
        if (init4.valueReference) return typeof init4.valueReference === "string" ? { reference: init4.valueReference } : init4.valueReference;
        if (init4.valueQuantity) return {
          value: init4.valueQuantity.value !== void 0 ? String(init4.valueQuantity.value) : "",
          unit: init4.valueQuantity.unit || ""
        };
        return void 0;
      };
      if (node.repeats && fhirItem.initial.length > 1) {
        const vals = fhirItem.initial.map(extractVal).filter((v) => v !== void 0);
        node._initialValues = vals;
        node._initialValue = vals[0];
      } else {
        const val = extractVal(fhirItem.initial[0]);
        if (val !== void 0) node._initialValue = val;
      }
    }
    for (const opt of fhirItem.answerOption || []) {
      if (opt.initialSelected) {
        let code;
        if (opt.valueCoding) code = opt.valueCoding.code || opt.valueCoding.display || "";
        else if (opt.valueString !== void 0) code = opt.valueString;
        else if (opt.valueInteger !== void 0) code = String(opt.valueInteger);
        if (code !== void 0) {
          node._initialSelected = code;
          if (node._initialValue === void 0) node._initialValue = code;
          break;
        }
      }
    }
    const unknownExts = _collectUnknownExtensions(fhirItem);
    if (unknownExts) node._unknownExtensions = unknownExts;
    return node;
  }
  function fhirItemToNode(fhirItem, linkIdMap, contained) {
    const t = fhirItem.type || "string";
    if (t === "group") {
      const node = createGroupNode({
        id: fhirItem.linkId,
        title: fhirItem.text || fhirItem.linkId || "Group",
        mandatory: !!fhirItem.required
      });
      applyVisibility(node, fhirItem, linkIdMap);
      const hasOrGroup = applyConstraints(node, fhirItem);
      if (hasOrGroup) node.logicWithParent = "OR";
      if (fhirItem.repeats) node.repeats = true;
      const grpMinOccExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.minOccurs
      );
      if (grpMinOccExt?.valueInteger !== void 0) node._minOccurs = grpMinOccExt.valueInteger;
      const grpMaxOccExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.maxOccurs
      );
      if (grpMaxOccExt?.valueInteger !== void 0) node._maxOccurs = grpMaxOccExt.valueInteger;
      const rs = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-style"));
      if (rs) node._renderStyle = rs.valueString || "";
      const rx = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-xhtml"));
      if (rx) node._renderXhtml = rx.valueString || "";
      const rm = fhirItem._text?.extension?.find((x) => x.url && x.url.includes("rendering-markdown"));
      if (rm) node._renderMarkdown = rm.valueMarkdown || rm.valueString || "";
      if (fhirItem.prefix) node._prefix = fhirItem.prefix;
      if (fhirItem.definition) node._definition = fhirItem.definition;
      const grpBaseTypeExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.baseType
      );
      if (grpBaseTypeExt?.valueCode) node._baseType = grpBaseTypeExt.valueCode;
      const grpFhirTypeExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.fhirType
      );
      if (grpFhirTypeExt?.valueCode) node._fhirType = grpFhirTypeExt.valueCode;
      if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;
      const groupSupportLinks = (fhirItem.extension || []).filter((e) => e.url === FHIR.supportLink && e.valueUri).map((e) => e.valueUri);
      if (groupSupportLinks.length) node._supportLinks = groupSupportLinks;
      const groupHiddenExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.hiddenSdc || e.url === FHIR.hidden
      );
      if (groupHiddenExt?.valueBoolean === true) node._hidden = true;
      const groupObsExtractExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.observationExtract
      );
      if (groupObsExtractExt) node._observationExtract = groupObsExtractExt.valueBoolean === false ? false : true;
      const collapsibleExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.collapsible
      );
      if (collapsibleExt?.valueCode) node._collapsible = collapsibleExt.valueCode;
      const groupPrefTermExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.preferredTerminologyServer
      );
      if (groupPrefTermExt?.valueUrl) node._preferredTermServer = groupPrefTermExt.valueUrl;
      const groupShortTextExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.shortText
      );
      if (groupShortTextExt?.valueString) node._shortText = groupShortTextExt.valueString;
      const groupDesignNoteExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.designNote
      );
      if (groupDesignNoteExt?.valueMarkdown) node._designNote = groupDesignNoteExt.valueMarkdown;
      else if (groupDesignNoteExt?.valueString) node._designNote = groupDesignNoteExt.valueString;
      const groupDcExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.displayCategory
      );
      const groupDcCode = groupDcExt?.valueCodeableConcept?.coding?.[0]?.code;
      if (groupDcCode) node._displayCategory = groupDcCode;
      const groupCtrlExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.itemControl
      );
      const groupCtrlCode = groupCtrlExt?.valueCodeableConcept?.coding?.[0]?.code;
      if (groupCtrlCode) node._itemControl = groupCtrlCode;
      const groupCalcExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.calculatedExpression
      );
      if (groupCalcExt?.valueExpression) node._calculatedExpr = groupCalcExt.valueExpression.expression || "";
      const groupInitExt = (fhirItem.extension || []).find(
        (e) => e.url === FHIR.initialExpression
      );
      if (groupInitExt?.valueExpression) node._initialExpr = groupInitExt.valueExpression.expression || "";
      const groupUnknown = _collectUnknownExtensions(fhirItem);
      if (groupUnknown) node._unknownExtensions = groupUnknown;
      for (const child of fhirItem.item || []) {
        const n = fhirItemToNode(child, linkIdMap, contained);
        if (n) node.children.push(n);
      }
      return node;
    }
    if ((fhirItem.item || []).length > 0) {
      const node = fhirQuestionToItem(fhirItem, linkIdMap, contained);
      for (const child of fhirItem.item) {
        const n = fhirItemToNode(child, linkIdMap, contained);
        if (n) node.children.push(n);
      }
      return node;
    }
    return fhirQuestionToItem(fhirItem, linkIdMap, contained);
  }

  // js/fhir/import.js
  var _svc = {};
  function configure(svc) {
    _svc = { ..._svc, ...svc };
  }
  if (typeof document !== "undefined") {
    document.addEventListener(
      AppEvents.APP_CONTEXT_READY,
      (e) => {
        if (e.detail?.questDoc) configure({ questDoc: e.detail.questDoc });
      }
    );
  }
  function applyInitialValues(nodes, bus) {
    for (const node of nodes) {
      if (node.repeats && node._initialValues && node._initialValues.length > 1) {
        bus.dispatch(AppEvents.ANSWER_SET, { id: node.id, value: node._initialValues[0] });
        for (let i = 1; i < node._initialValues.length; i++) {
          bus.dispatch(AppEvents.ANSWER_SET, { id: node.id + "$$" + i, value: node._initialValues[i] });
        }
        bus.dispatch(AppEvents.ANSWER_SET, { id: node.id + "$$n", value: node._initialValues.length - 1 });
      } else if (node._initialValue !== void 0) {
        bus.dispatch(AppEvents.ANSWER_SET, { id: node.id, value: node._initialValue });
      }
      if (node.type === "group") applyInitialValues(node.children, bus);
    }
  }
  function importFHIR(fhirJson, opts = {}) {
    const questDoc2 = opts.questDoc || _svc.questDoc;
    const bus = opts.bus || defaultBus;
    const { tree, meta: questMeta, variables: questVariables, contained: questContained } = questDoc2;
    let q = fhirJson;
    if (typeof q === "string") {
      try {
        q = JSON.parse(q);
      } catch (e) {
        showError("Invalid JSON:\n" + e.message);
        return;
      }
    }
    if (!q || q.resourceType !== "Questionnaire") {
      showError('Not a FHIR Questionnaire resource (resourceType must be "Questionnaire").');
      return;
    }
    q = normaliseSTU3(q);
    destroyTree(tree);
    bus.dispatch(AppEvents.ANSWERS_CLEAR);
    questDoc2.rawFhir = q;
    questDoc2.translations ??= {};
    for (const k of Object.keys(questDoc2.translations)) delete questDoc2.translations[k];
    resetSeq();
    questMeta.id = q.id || "";
    questMeta.url = q.url || "";
    questMeta.version = q.version || "";
    questMeta.title = q.title || "";
    questMeta.status = q.status || "draft";
    questMeta.publisher = q.publisher || "";
    questMeta.description = q.description || "";
    questMeta.name = q.name || "";
    questMeta.date = q.date || "";
    questMeta.subjectType = Array.isArray(q.subjectType) && q.subjectType.length ? [...q.subjectType] : [];
    questMeta.purpose = q.purpose || "";
    questMeta.copyright = q.copyright || "";
    questMeta.approvalDate = q.approvalDate || "";
    questMeta.lastReviewDate = q.lastReviewDate || "";
    questMeta.effectivePeriodStart = q.effectivePeriod?.start || "";
    questMeta.effectivePeriodEnd = q.effectivePeriod?.end || "";
    questMeta.experimental = q.experimental !== void 0 ? q.experimental : null;
    questMeta.language = q.language || "";
    questMeta._rawIdentifier = Array.isArray(q.identifier) ? JSON.parse(JSON.stringify(q.identifier)) : [];
    questMeta._rawText = q.text && q.text.status && q.text.div ? { status: q.text.status, div: q.text.div } : null;
    questMeta._rawContact = Array.isArray(q.contact) ? q.contact : null;
    questMeta._rawUseContext = Array.isArray(q.useContext) ? q.useContext : null;
    questMeta._rawJurisdiction = Array.isArray(q.jurisdiction) ? q.jurisdiction : null;
    questMeta._rawCode = Array.isArray(q.code) ? q.code : null;
    questMeta.derivedFrom = Array.isArray(q.derivedFrom) ? [...q.derivedFrom] : [];
    questMeta._rawModifierExtension = Array.isArray(q.modifierExtension) && q.modifierExtension.length ? JSON.parse(JSON.stringify(q.modifierExtension)) : [];
    questMeta._metaVersionId = q.meta?.versionId || "";
    questMeta._metaSource = q.meta?.source || "";
    questMeta._metaLastUpdated = q.meta?.lastUpdated || "";
    questMeta._rawMetaProfile = Array.isArray(q.meta?.profile) ? [...q.meta.profile] : [];
    questMeta._implicitRules = q.implicitRules || "";
    questMeta._rawMetaTag = Array.isArray(q.meta?.tag) ? JSON.parse(JSON.stringify(q.meta.tag)) : [];
    questMeta._rawMetaSecurity = Array.isArray(q.meta?.security) ? JSON.parse(JSON.stringify(q.meta.security)) : [];
    const SDC_VAR_URL = FHIR.variable;
    const REPLACES_URL = FHIR.replaces;
    const LAUNCH_CTX_URL = FHIR.launchContext;
    const ARTIFACT_VERSION_ALGO_URL2 = FHIR.artifactVersionAlgorithm;
    const ARTIFACT_COPYRIGHT_LABEL_URL2 = FHIR.artifactCopyrightLabel;
    const vaExt = (q.extension || []).find((e) => e.url === ARTIFACT_VERSION_ALGO_URL2);
    if (q.versionAlgorithmString !== void 0) {
      questMeta._versionAlgorithmString = q.versionAlgorithmString;
      questMeta._versionAlgorithmCoding = null;
    } else if (q.versionAlgorithmCoding) {
      questMeta._versionAlgorithmCoding = JSON.parse(JSON.stringify(q.versionAlgorithmCoding));
      questMeta._versionAlgorithmString = "";
    } else if (vaExt?.valueString !== void 0) {
      questMeta._versionAlgorithmString = vaExt.valueString;
      questMeta._versionAlgorithmCoding = null;
    } else if (vaExt?.valueCoding) {
      questMeta._versionAlgorithmCoding = JSON.parse(JSON.stringify(vaExt.valueCoding));
      questMeta._versionAlgorithmString = "";
    } else {
      questMeta._versionAlgorithmString = "";
      questMeta._versionAlgorithmCoding = null;
    }
    const clExt = (q.extension || []).find((e) => e.url === ARTIFACT_COPYRIGHT_LABEL_URL2);
    questMeta.copyrightLabel = q.copyrightLabel || clExt?.valueString || "";
    questVariables.splice(0);
    questContained.splice(0);
    if (Array.isArray(q.contained)) {
      for (const r of q.contained) questContained.push(r);
    }
    questMeta.replaces = (q.extension || []).filter((e) => e.url === REPLACES_URL && e.valueCanonical).map((e) => e.valueCanonical);
    for (const ext of q.extension || []) {
      if (ext.url === SDC_VAR_URL && ext.valueExpression) {
        questVariables.push({
          name: ext.valueExpression.name || "",
          expression: ext.valueExpression.expression || ""
        });
      }
    }
    const PREF_TERM_URL = FHIR.preferredTerminologyServer;
    const prefTermQuestExt = (q.extension || []).find((e) => e.url === PREF_TERM_URL);
    questMeta.preferredTermServer = prefTermQuestExt?.valueUrl || "";
    const SIG_REQ_URL = FHIR.signatureRequired;
    const sigReqExts = (q.extension || []).filter((e) => e.url === SIG_REQ_URL);
    questMeta._signatureRequired = sigReqExts.length ? sigReqExts.filter((e) => e.valueCodeableConcept?.coding?.[0]).map((e) => {
      const c = e.valueCodeableConcept.coding[0];
      return { system: c.system || "", code: c.code || "", display: c.display || "" };
    }) : [];
    const nonVarExts = (q.extension || []).filter((e) => e.url !== SDC_VAR_URL && e.url !== REPLACES_URL && e.url !== PREF_TERM_URL && e.url !== SIG_REQ_URL && e.url !== BUILDER_VERSION_EXTENSION_URL && e.url !== LAUNCH_CTX_URL && e.url !== ARTIFACT_VERSION_ALGO_URL2 && e.url !== ARTIFACT_COPYRIGHT_LABEL_URL2);
    questMeta._rawQuestExtensions = nonVarExts.length ? JSON.parse(JSON.stringify(nonVarExts)) : [];
    const launchCtxExts = (q.extension || []).filter((e) => e.url === LAUNCH_CTX_URL);
    questMeta.launchContexts = launchCtxExts.map((e) => {
      const subs = e.extension || [];
      const nameSub = subs.find((s) => s.url === "name");
      const typeSub = subs.find((s) => s.url === "type");
      const descSub = subs.find((s) => s.url === "description");
      return {
        name: nameSub?.valueCoding?.code || nameSub?.valueId || "",
        type: typeSub?.valueCode || "",
        description: descSub?.valueString || ""
      };
    });
    try {
      const linkIdMap = buildLinkIdMap(q.item);
      for (const item of q.item || []) {
        const n = fhirItemToNode(item, linkIdMap, q.contained);
        if (n) tree.push(n);
      }
      applyInitialValues(tree, bus);
      _importTranslations(q, tree, questDoc2.translations);
    } finally {
      bus.dispatch(AppEvents.REINIT_FORM);
    }
    bus.dispatch(AppEvents.BUILDER_RERENDER);
  }
  var TRANSLATION_URL = FHIR.translation;
  function _importTranslations(q, tree, translations) {
    const titleExts = (q._title?.extension || []).filter((e) => e.url === TRANSLATION_URL);
    for (const ext of titleExts) {
      const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
      const content = (ext.extension || []).find((s) => s.url === "content")?.valueString;
      if (!lang || content == null) continue;
      _ensureLang(translations, lang);
      translations[lang].title = content;
    }
    function walk2(fhirItems) {
      for (const fi of fhirItems || []) {
        const textExts = (fi._text?.extension || []).filter((e) => e.url === TRANSLATION_URL);
        for (const ext of textExts) {
          const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
          const content = (ext.extension || []).find((s) => s.url === "content")?.valueString;
          if (!lang || content == null) continue;
          _ensureLang(translations, lang);
          translations[lang].items[fi.linkId] = content;
        }
        for (const ao of fi.answerOption || []) {
          const code = ao.valueCoding?.code || ao.valueString || ao.valueInteger?.toString();
          if (!code) continue;
          const optExts = (ao._valueCoding?._display?.extension || []).filter((e) => e.url === TRANSLATION_URL);
          for (const ext of optExts) {
            const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
            const content = (ext.extension || []).find((s) => s.url === "content")?.valueString;
            if (!lang || content == null) continue;
            _ensureLang(translations, lang);
            translations[lang].opts[fi.linkId + "__" + code] = content;
          }
        }
        walk2(fi.item);
      }
    }
    walk2(q.item);
    const UI_TRANS_URL = APP_URL.uiTranslations;
    for (const ext of (q.extension || []).filter((e) => e.url === UI_TRANS_URL)) {
      const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
      const strings = (ext.extension || []).find((s) => s.url === "strings")?.valueString;
      if (!lang || !strings) continue;
      try {
        const parsed = JSON.parse(strings);
        _ensureLang(translations, lang);
        Object.assign(translations[lang].ui, parsed);
      } catch {
      }
    }
    const XHTML_TRANS_URL = APP_URL.xhtmlTranslations;
    for (const ext of (q.extension || []).filter((e) => e.url === XHTML_TRANS_URL)) {
      const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
      const strings = (ext.extension || []).find((s) => s.url === "strings")?.valueString;
      if (!lang || !strings) continue;
      try {
        const parsed = JSON.parse(strings);
        _ensureLang(translations, lang);
        if (!translations[lang].xhtml) translations[lang].xhtml = {};
        Object.assign(translations[lang].xhtml, parsed);
      } catch {
      }
    }
    const MD_TRANS_URL = APP_URL.markdownTranslations;
    for (const ext of (q.extension || []).filter((e) => e.url === MD_TRANS_URL)) {
      const lang = (ext.extension || []).find((s) => s.url === "lang")?.valueCode;
      const strings = (ext.extension || []).find((s) => s.url === "strings")?.valueString;
      if (!lang || !strings) continue;
      try {
        const parsed = JSON.parse(strings);
        _ensureLang(translations, lang);
        Object.assign(translations[lang].markdown, parsed);
      } catch {
      }
    }
  }
  function _ensureLang(translations, lang) {
    if (!translations[lang]) translations[lang] = { title: "", items: {}, opts: {}, ui: {}, xhtml: {}, markdown: {} };
    if (!translations[lang].ui) translations[lang].ui = {};
    if (!translations[lang].xhtml) translations[lang].xhtml = {};
    if (!translations[lang].markdown) translations[lang].markdown = {};
  }

  // js/fhir/qr-import.js
  function _collectLinkIds(nodes, set = /* @__PURE__ */ new Set()) {
    for (const n of nodes) {
      if (n.id) set.add(n.id);
      if (n.children) _collectLinkIds(n.children, set);
    }
    return set;
  }
  function _flattenQR(items, out = {}) {
    for (const item of items || []) {
      if (item.answer && item.answer.length) {
        const extractVal = (ans) => {
          if (ans.valueBoolean !== void 0) return ans.valueBoolean;
          if (ans.valueCoding !== void 0) return ans.valueCoding.code;
          if (ans.valueDecimal !== void 0) return ans.valueDecimal;
          if (ans.valueInteger !== void 0) return ans.valueInteger;
          if (ans.valueDate !== void 0) return ans.valueDate;
          if (ans.valueDateTime !== void 0) return ans.valueDateTime;
          if (ans.valueTime !== void 0) return ans.valueTime;
          if (ans.valueQuantity !== void 0) return { value: ans.valueQuantity.value, unit: ans.valueQuantity.unit || "" };
          if (ans.valueUri !== void 0) return ans.valueUri;
          if (ans.valueReference !== void 0) return { reference: ans.valueReference.reference || "" };
          if (ans.valueString !== void 0) return ans.valueString;
          return void 0;
        };
        out[item.linkId] = item.answer.map(extractVal).filter((v) => v !== void 0);
        if (out[item.linkId].length === 0) delete out[item.linkId];
        for (const ans of item.answer) {
          if (ans.item) _flattenQR(ans.item, out);
        }
      }
      if (item.item) _flattenQR(item.item, out);
    }
    return out;
  }
  function _collectChecklistIds(nodes, set = /* @__PURE__ */ new Set()) {
    for (const n of nodes) {
      if (n.itemType === "checklist") set.add(n.id);
      if (n.children) _collectChecklistIds(n.children, set);
    }
    return set;
  }
  function importQRAnswers(qrJson, values, tree) {
    if (!qrJson || qrJson.resourceType !== "QuestionnaireResponse") {
      const rt = qrJson?.resourceType ?? "unknown";
      return { ok: false, error: "Not a QuestionnaireResponse (resourceType: " + rt + ")" };
    }
    const knownIds = _collectLinkIds(tree);
    const extracted = _flattenQR(qrJson.item || []);
    const unmatched = [];
    let loaded = 0;
    for (const [linkId, arr] of Object.entries(extracted)) {
      if (knownIds.has(linkId)) {
        values[linkId] = arr;
        loaded++;
      } else {
        unmatched.push(linkId);
      }
    }
    const checklistIds = _collectChecklistIds(tree);
    for (const id of checklistIds) {
      const arr = values[id];
      if (Array.isArray(arr) && arr.length > 1) {
        values[id] = [arr.filter((v) => v !== void 0).join(",")];
      }
    }
    return {
      ok: true,
      loaded,
      unmatched,
      questionnaire: qrJson.questionnaire || "",
      meta: {
        status: qrJson.status || "in-progress",
        subject: qrJson.subject?.reference || "",
        author: qrJson.author?.reference || "",
        id: qrJson.id || "",
        language: qrJson.language || "",
        metaVersionId: qrJson.meta?.versionId || "",
        metaSource: qrJson.meta?.source || "",
        metaProfile: (qrJson.meta?.profile || []).slice(),
        metaTag: (qrJson.meta?.tag || []).map((c) => ({ ...c })),
        metaSecurity: (qrJson.meta?.security || []).map((c) => ({ ...c }))
      }
    };
  }

  // js/fhir/qr-builder.js
  var ORDINAL_URL = FHIR.ordinalValue;
  function buildAnswer(fhirItem, v) {
    const t = fhirItem.type || "string";
    if (t === "boolean") return { valueBoolean: v === true };
    if (t === "date") return { valueDate: String(v) };
    if (t === "dateTime") return { valueDateTime: String(v) };
    if (t === "time") return { valueTime: String(v) };
    if (t === "choice" || t === "open-choice") {
      const codeStr = String(v);
      const coding = { code: codeStr };
      const opt = (fhirItem.answerOption || []).find(
        (o) => o.valueCoding && o.valueCoding.code === codeStr || o.valueString !== void 0 && String(o.valueString) === codeStr
      );
      if (opt && opt.valueCoding) {
        if (opt.valueCoding.system) coding.system = opt.valueCoding.system;
        if (opt.valueCoding.display) coding.display = opt.valueCoding.display;
        const ordExt = (opt.extension || []).find((e) => e.url === ORDINAL_URL) || (opt.valueCoding.extension || []).find((e) => e.url === ORDINAL_URL);
        if (ordExt !== void 0)
          coding.extension = [{ url: ORDINAL_URL, valueDecimal: ordExt.valueDecimal }];
      }
      return { valueCoding: coding };
    }
    if (t === "integer") return { valueInteger: parseInt(v, 10) || 0 };
    if (t === "decimal") return { valueDecimal: parseFloat(v) || 0 };
    if (t === "quantity") return { valueQuantity: { value: parseFloat(v?.value) || 0, unit: v?.unit || "" } };
    if (t === "url") return { valueUri: String(v) };
    if (t === "reference") return { valueReference: { reference: String(v?.reference || "") } };
    return { valueString: String(v) };
  }
  function buildQRItem(fhirItem, values) {
    const qrItem = { linkId: fhirItem.linkId };
    const children = fhirItem.item || [];
    const t = fhirItem.type || "string";
    const rows = values[fhirItem.linkId];
    const val = rows ? rows[0] : void 0;
    function allVals() {
      return (values[fhirItem.linkId] || []).filter((v) => v !== void 0);
    }
    const makeAnswer = (v) => buildAnswer(fhirItem, v);
    if (t === "group") {
      if (children.length > 0) {
        qrItem.item = children.map((child) => buildQRItem(child, values));
      }
    } else if (children.length > 0) {
      const answerObj = {};
      if (t === "boolean") {
        if (val !== void 0) answerObj.valueBoolean = val === true;
      } else if (t === "string" || t === "text") {
        if (val !== void 0) answerObj.valueString = String(val);
      }
      answerObj.item = children.map((child) => buildQRItem(child, values));
      qrItem.answer = [answerObj];
    } else {
      const vs = allVals();
      if ((t === "choice" || t === "open-choice") && fhirItem.repeats && vs.length === 1 && typeof vs[0] === "string" && vs[0].includes(",")) {
        qrItem.answer = vs[0].split(",").map(makeAnswer);
      } else if (vs.length > 0) {
        qrItem.answer = vs.map(makeAnswer);
      }
    }
    return qrItem;
  }
  function buildQR(fhirJson, values) {
    return {
      resourceType: "QuestionnaireResponse",
      questionnaire: fhirJson.url || fhirJson.id || "",
      status: "in-progress",
      item: (fhirJson.item || []).map((item) => buildQRItem(item, values))
    };
  }

  // js/fhir/dep-graph.js
  function extractRefs(expr) {
    const linkIds = /* @__PURE__ */ new Set();
    const vars = /* @__PURE__ */ new Set();
    if (!expr || typeof expr !== "string") {
      return { linkIds: [], vars: [] };
    }
    const linkIdRe = /linkId\s*=\s*(['"])(.*?)\1/g;
    let m;
    while ((m = linkIdRe.exec(expr)) !== null) {
      if (m[2]) linkIds.add(m[2]);
    }
    const varRe = /%(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = varRe.exec(expr)) !== null) {
      let name = m[1];
      if (name.startsWith("`") && name.endsWith("`")) name = name.slice(1, -1);
      if (name !== "resource" && name !== "context") vars.add(name);
    }
    return { linkIds: [...linkIds], vars: [...vars] };
  }
  function flatten(nodes, out = []) {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) {
        flatten(node.children, out);
      }
    }
    return out;
  }
  function buildDepGraph(nodes, variables = []) {
    const flat = flatten(nodes || []);
    const nodeIds = flat.map((n) => n.id);
    const idSet = new Set(nodeIds);
    const varNames = new Set((variables || []).map((v) => v && v.name).filter(Boolean));
    const ancestorMap = /* @__PURE__ */ new Map();
    function buildAncestors(nodeList, inherited) {
      for (const n of nodeList) {
        ancestorMap.set(n.id, new Set(inherited));
        if (n.children?.length) {
          buildAncestors(n.children, [...inherited, n.id]);
        }
      }
    }
    buildAncestors(nodes || [], []);
    const edges = /* @__PURE__ */ new Map();
    const missing = /* @__PURE__ */ new Map();
    for (const id of nodeIds) edges.set(id, /* @__PURE__ */ new Set());
    const addDep = (fromId, toId) => {
      if (toId === fromId) return;
      if (ancestorMap.get(fromId)?.has(toId)) return;
      if (idSet.has(toId)) {
        edges.get(fromId).add(toId);
      } else if (!varNames.has(toId)) {
        if (!missing.has(fromId)) missing.set(fromId, /* @__PURE__ */ new Set());
        missing.get(fromId).add(toId);
      }
    };
    for (const node of flat) {
      if (Array.isArray(node.enableWhen)) {
        for (const ew of node.enableWhen) {
          if (ew && ew.question) addDep(node.id, ew.question);
        }
      }
      const exprs = [
        node.enableWhenExpression,
        node._calculatedExpr,
        node._initialExpr
      ];
      for (const expr of exprs) {
        const { linkIds } = extractRefs(expr);
        for (const lid of linkIds) addDep(node.id, lid);
      }
    }
    return { edges, nodeIds, varNames, missing };
  }
  function detectCycles(graph) {
    const { edges } = graph;
    const WHITE = 0, GREY = 1, BLACK = 2;
    const color = /* @__PURE__ */ new Map();
    for (const id of edges.keys()) color.set(id, WHITE);
    const cycles = [];
    const stack = [];
    const visit = (id) => {
      color.set(id, GREY);
      stack.push(id);
      for (const next of edges.get(id) || []) {
        const c = color.get(next);
        if (c === GREY) {
          const start = stack.indexOf(next);
          if (start !== -1) cycles.push([...stack.slice(start), next]);
        } else if (c === WHITE) {
          visit(next);
        }
      }
      stack.pop();
      color.set(id, BLACK);
    };
    for (const id of edges.keys()) {
      if (color.get(id) === WHITE) visit(id);
    }
    return cycles;
  }
  function topoOrder(graph) {
    const { edges, nodeIds } = graph;
    const outDeg = /* @__PURE__ */ new Map();
    const dependents = /* @__PURE__ */ new Map();
    for (const id of nodeIds) {
      outDeg.set(id, (edges.get(id) || /* @__PURE__ */ new Set()).size);
      dependents.set(id, []);
    }
    for (const id of nodeIds) {
      for (const dep of edges.get(id) || []) {
        if (dependents.has(dep)) dependents.get(dep).push(id);
      }
    }
    const queue = nodeIds.filter((id) => outDeg.get(id) === 0);
    const order = [];
    const resolved = /* @__PURE__ */ new Set();
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      resolved.add(id);
      for (const dependent of dependents.get(id) || []) {
        outDeg.set(dependent, outDeg.get(dependent) - 1);
        if (outDeg.get(dependent) === 0) queue.push(dependent);
      }
    }
    const cycles = detectCycles(graph);
    if (order.length < nodeIds.length) {
      for (const id of nodeIds) {
        if (!resolved.has(id)) order.push(id);
      }
    }
    return { order, cycles };
  }

  // js/fhir/calc.js
  function buildVarEnv(variables, qr, fp) {
    const env = {};
    for (const v of variables) {
      if (!v.name || !v.expression) continue;
      try {
        const result = fp.evaluate(qr, v.expression, { resource: qr, ...env }, fhirModel());
        env[v.name] = Array.isArray(result) && result.length === 1 ? result[0] : result;
      } catch (_e) {
      }
    }
    return env;
  }
  function indexNodes(nodes, map = /* @__PURE__ */ new Map()) {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.children?.length) indexNodes(node.children, map);
    }
    return map;
  }
  function indexFhirItems(items, map = /* @__PURE__ */ new Map()) {
    for (const it of items || []) {
      if (it.linkId) map.set(it.linkId, it);
      if (Array.isArray(it.item)) indexFhirItems(it.item, map);
      if (Array.isArray(it.answer)) {
        for (const a of it.answer) if (Array.isArray(a.item)) indexFhirItems(a.item, map);
      }
    }
    return map;
  }
  function indexQrItems(items, map = /* @__PURE__ */ new Map()) {
    for (const it of items || []) {
      if (it.linkId) map.set(it.linkId, it);
      if (Array.isArray(it.item)) indexQrItems(it.item, map);
      if (Array.isArray(it.answer)) {
        for (const a of it.answer) if (Array.isArray(a.item)) indexQrItems(a.item, map);
      }
    }
    return map;
  }
  function coerceResult(node, result) {
    if (node.itemType === "checkbox") {
      return result[0] === true || result[0] === "true";
    }
    return Array.isArray(result) ? result.join("") : result[0] !== void 0 ? String(result[0]) : "";
  }
  function buildCalcCache(nodes, variables = []) {
    return {
      nodeMap: indexNodes(nodes),
      order: topoOrder(buildDepGraph(nodes, variables)).order
    };
  }
  function evalCalcNodes(nodes, qr, fp, values, envVars = {}, base = null, cachedCtx = null) {
    const env = { resource: qr, ...envVars };
    const nodeMap = cachedCtx?.nodeMap || indexNodes(nodes);
    const order = cachedCtx?.order || topoOrder(buildDepGraph(nodes, [])).order;
    const fhirMap = base ? indexFhirItems(base.item) : null;
    const qrMap = fhirMap ? indexQrItems(qr.item) : null;
    for (const id of order) {
      const node = nodeMap.get(id);
      if (!node || !(node._calculatedExpr && node._readOnly)) continue;
      try {
        const result = fp.evaluate(qr, node._calculatedExpr, env, fhirModel());
        const value = coerceResult(node, result);
        values[node.id] = value;
        if (qrMap && fhirMap) {
          const qrItem = qrMap.get(node.id);
          const fhirItem = fhirMap.get(node.id);
          if (qrItem && fhirItem) {
            const answer = buildAnswer(fhirItem, value);
            const prevItem = qrItem.answer?.[0]?.item;
            if (prevItem) answer.item = prevItem;
            qrItem.answer = [answer];
          }
        }
      } catch (_e) {
      }
    }
  }
  function evalInitialExprNodes(nodes, qr, fp, values, envVars = {}) {
    const env = { resource: qr, ...envVars };
    for (const node of nodes) {
      if (node._initialExpr) {
        try {
          const result = fp.evaluate(qr, node._initialExpr, env, fhirModel());
          if (node.itemType === "checkbox") {
            values[node.id] = result[0] === true || result[0] === "true";
          } else {
            values[node.id] = Array.isArray(result) ? result.join("") : result[0] !== void 0 ? String(result[0]) : "";
          }
        } catch (_e) {
        }
      }
      if (node.children?.length) evalInitialExprNodes(node.children, qr, fp, values, envVars);
    }
  }

  // js/fhir/formats/_downgrade.js
  var R5_FIELD_EXTENSIONS = {
    disabledDisplay: ITEM_DISABLED_DISPLAY_EXTENSION_URL,
    answerConstraint: ITEM_ANSWER_CONSTRAINT_EXTENSION_URL
  };
  var ARTIFACT_VERSION_ALGO_URL = FHIR.artifactVersionAlgorithm;
  var ARTIFACT_COPYRIGHT_LABEL_URL = FHIR.artifactCopyrightLabel;
  function backportR5RootFields(q) {
    if (!q) return;
    const ext = [];
    if (q.versionAlgorithmString !== void 0) {
      ext.push({ url: ARTIFACT_VERSION_ALGO_URL, valueString: q.versionAlgorithmString });
      delete q.versionAlgorithmString;
    } else if (q.versionAlgorithmCoding !== void 0) {
      ext.push({ url: ARTIFACT_VERSION_ALGO_URL, valueCoding: q.versionAlgorithmCoding });
      delete q.versionAlgorithmCoding;
    }
    if (q.copyrightLabel !== void 0) {
      ext.push({ url: ARTIFACT_COPYRIGHT_LABEL_URL, valueString: q.copyrightLabel });
      delete q.copyrightLabel;
    }
    if (ext.length) q.extension = [...q.extension || [], ...ext];
  }
  function backportR5ItemFields(q) {
    if (q?.item) _walk(q.item);
  }
  function _walk(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      for (const [field, url] of Object.entries(R5_FIELD_EXTENSIONS)) {
        if (item[field] === void 0 || item[field] === null) continue;
        item.extension = (item.extension || []).filter((e) => e?.url !== url);
        item.extension.push({ url, valueCode: item[field] });
        delete item[field];
      }
      if (item.item) _walk(item.item);
    }
  }

  // js/fhir/formats/r4.js
  formatRegistry.register({
    id: "R4",
    label: "FHIR R4 JSON (.json)",
    selectorLabel: "FHIR R4",
    isBuilderVersion: true,
    metaVersion: "4.0.1",
    ext: "json",
    mimeType: "application/json",
    reportTitle: "Export \u2014 Validation Report",
    build(baseQ) {
      const q = JSON.parse(JSON.stringify(baseQ));
      backportR5ItemFields(q);
      backportR5RootFields(q);
      q.meta = q.meta ?? { lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
      setBuilderVersion(q, "4.0.1");
      return q;
    }
  });

  // js/fhir/formats/r4b.js
  formatRegistry.register({
    id: "R4B",
    label: "FHIR R4B JSON (.json)",
    selectorLabel: "FHIR R4B",
    isBuilderVersion: true,
    metaVersion: "4.3.0",
    ext: "json",
    mimeType: "application/json",
    reportTitle: "Export \u2014 Validation Report",
    build(baseQ) {
      const q = JSON.parse(JSON.stringify(baseQ));
      backportR5ItemFields(q);
      backportR5RootFields(q);
      q.meta = q.meta ?? { lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
      setBuilderVersion(q, "4.3.0");
      return q;
    }
  });

  // js/fhir/formats/r5.js
  function _convertItems(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.type === "open-choice") {
        item.type = "coding";
        if (!item.answerConstraint) item.answerConstraint = "optionsOrString";
      } else if (item.type === "choice") {
        item.type = "coding";
      }
      if (item.item) _convertItems(item.item);
    }
  }
  formatRegistry.register({
    id: "R5",
    label: "FHIR R5 JSON (.json)",
    selectorLabel: "FHIR R5",
    isBuilderVersion: true,
    metaVersion: "5.0.0",
    ext: "json",
    mimeType: "application/json",
    reportTitle: "Export \u2014 Validation Report",
    build(baseQ) {
      const q = JSON.parse(JSON.stringify(baseQ));
      if (q.item) _convertItems(q.item);
      q.meta = q.meta ?? { lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
      setBuilderVersion(q, "5.0.0");
      return q;
    }
  });

  // js/fhir/converters/redcap/branching-logic.js
  var FHIR_OP_TO_REDCAP = {
    "equal": "=",
    "not-equal": "<>",
    "exists": null,
    // can't represent cleanly
    ">": ">",
    ">=": ">=",
    "<": "<",
    "<=": "<="
  };
  function enableWhenToBranching(enableWhen, enableBehavior) {
    if (!enableWhen || enableWhen.length === 0) return "";
    const op = enableBehavior === "any" ? " OR " : " AND ";
    const parts = enableWhen.map((ew) => {
      const question = `[${ew.question}]`;
      const fhirOp = ew.operator || "equal";
      const redcapOp = FHIR_OP_TO_REDCAP[fhirOp] ?? "=";
      let val;
      if (ew.answerDecimal !== void 0) val = String(ew.answerDecimal);
      else if (ew.answerInteger !== void 0) val = String(ew.answerInteger);
      else if (ew.answerBoolean !== void 0) val = ew.answerBoolean ? "1" : "0";
      else if (ew.answerCoding?.code !== void 0) val = `'${ew.answerCoding.code}'`;
      else if (ew.answerString !== void 0) val = `'${ew.answerString}'`;
      else val = "''";
      return `${question} ${redcapOp} ${val}`;
    });
    return parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(op);
  }

  // js/fhir/converters/redcap/to-fhir.js
  var RC = APP_URL.redcapNs;
  var ITEM_CONTROL_URL = FHIR.itemControl;
  var MIN_VALUE_URL = FHIR.minValue;
  var MAX_VALUE_URL = FHIR.maxValue;
  var CALC_EXPR_URL = FHIR.calculatedExpression;

  // js/fhir/converters/redcap/from-fhir.js
  var RC2 = APP_URL.redcapNs;
  var ITEM_CTRL = FHIR.itemControl;
  var MIN_VAL = FHIR.minValue;
  var MAX_VAL = FHIR.maxValue;
  var CALC_EXPR = FHIR.calculatedExpression;
  var HEADERS = [
    "Variable / Field Name",
    "Form Name",
    "Section Header",
    "Field Type",
    "Field Label",
    "Choices, Calculations, OR Slider Labels",
    "Field Note",
    "Text Validation Type OR Show Slider Number",
    "Text Validation Min",
    "Text Validation Max",
    "Identifier?",
    "Branching Logic (Show field only if...)",
    "Required Field?",
    "Custom Alignment",
    "Question Number (surveys only)",
    "Matrix Group Name",
    "Matrix Ranking?",
    "Field Annotation"
  ];
  function rcExt(extensions, key) {
    if (!extensions) return void 0;
    const url = RC2 + key;
    const found = extensions.find((e) => e.url === url);
    if (!found) return void 0;
    for (const k of Object.keys(found)) {
      if (k.startsWith("value")) return found[k];
    }
    return void 0;
  }
  function getExt(extensions, url) {
    return (extensions || []).find((e) => e.url === url);
  }
  function csvCell(val) {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  function rowToLine(r) {
    return HEADERS.map((h) => csvCell(r[h] ?? "")).join(",");
  }
  function fhirTypeToRedcap(item) {
    const ctrl = getExt(item.extension, ITEM_CTRL);
    const ctrlCode = ctrl?.valueCodeableConcept?.coding?.[0]?.code;
    if (ctrlCode === "drop-down") return "dropdown";
    if (ctrlCode === "slider") return "slider";
    if (getExt(item.extension, CALC_EXPR)) return "calc";
    switch (item.type) {
      case "string":
        return "text";
      case "text":
        return "notes";
      case "integer":
        return "text";
      // with text validation = integer
      case "decimal":
        return "text";
      // with text validation = number
      case "date":
        return "text";
      // with text validation = date_ymd
      case "dateTime":
        return "text";
      case "time":
        return "text";
      case "boolean":
        return "yesno";
      case "choice":
        return item.repeats ? "checkbox" : "radio";
      case "attachment":
        return "file";
      case "display":
        return "descriptive";
      default:
        return "text";
    }
  }
  function fhirTypeToValidation(item) {
    switch (item.type) {
      case "integer":
        return "integer";
      case "decimal":
        return "number";
      case "date":
        return "date_ymd";
      case "dateTime":
        return "datetime_ymd";
      case "time":
        return "time";
      default:
        return "";
    }
  }
  function choicesToRedcap(answerOption) {
    if (!answerOption || answerOption.length === 0) return "";
    return answerOption.map((o) => {
      if (o.valueCoding) {
        const code = o.valueCoding.code || "";
        const display = o.valueCoding.display || o.valueCoding.code || "";
        return `${code}, ${display}`;
      }
      if (o.valueString !== void 0) return `${o.valueString}, ${o.valueString}`;
      if (o.valueInteger !== void 0) return `${o.valueInteger}, ${o.valueInteger}`;
      return "";
    }).filter(Boolean).join(" | ");
  }
  function numExt(extensions, url) {
    const e = getExt(extensions, url);
    if (!e) return "";
    for (const k of Object.keys(e)) {
      if (k.startsWith("value")) return String(e[k]);
    }
    return "";
  }
  function flattenItems(items, formName, sectionHdr, out, depth = 0) {
    for (const item of items || []) {
      if (item.type === "group") {
        const rcFormName = rcExt(item.extension, "form-name") || item.text || item.linkId;
        const rcSectionHdr = rcExt(item.extension, "section-header") || "";
        if (depth === 0) {
          flattenItems(item.item, rcFormName, "", out, depth + 1);
        } else if (depth === 1) {
          const newSection = rcSectionHdr || (rcFormName !== formName ? item.text : "");
          flattenItems(item.item, formName, newSection, out, depth + 1);
        } else {
          flattenItems(item.item, formName, sectionHdr, out, depth + 1);
        }
        continue;
      }
      const hasRcExts = (item.extension || []).some((e) => e.url.startsWith(RC2));
      let fieldType;
      if (hasRcExts) {
        const calcExpr = rcExt(item.extension, "calc-expression");
        const sqlQuery = rcExt(item.extension, "sql-query");
        if (calcExpr !== void 0) fieldType = "calc";
        else if (sqlQuery !== void 0) fieldType = "sql";
        else fieldType = fhirTypeToRedcap(item);
      } else {
        fieldType = fhirTypeToRedcap(item);
      }
      let choices;
      if (hasRcExts) {
        const calcExpr = rcExt(item.extension, "calc-expression");
        const sqlQuery = rcExt(item.extension, "sql-query");
        const sliderLbl = rcExt(item.extension, "slider-labels");
        if (calcExpr !== void 0) choices = calcExpr;
        else if (sqlQuery !== void 0) choices = sqlQuery;
        else if (sliderLbl !== void 0) choices = sliderLbl;
        else choices = choicesToRedcap(item.answerOption);
      } else {
        const calcExtObj = getExt(item.extension, CALC_EXPR);
        if (calcExtObj?.valueExpression?.expression) {
          choices = calcExtObj.valueExpression.expression;
        } else {
          choices = choicesToRedcap(item.answerOption);
        }
      }
      let branchingLogic = "";
      if (hasRcExts) {
        branchingLogic = rcExt(item.extension, "branching-logic") || "";
      } else if (item.enableWhen && item.enableWhen.length > 0) {
        branchingLogic = enableWhenToBranching(item.enableWhen, item.enableBehavior || "all");
      }
      const textValidation = hasRcExts ? "" : fhirTypeToValidation(item);
      const validationMin = numExt(item.extension, MIN_VAL);
      const validationMax = numExt(item.extension, MAX_VAL);
      const annotation = rcExt(item.extension, "annotation") ?? "";
      const matrixGroup = rcExt(item.extension, "matrix-group") ?? "";
      const alignment = rcExt(item.extension, "alignment") ?? "";
      const identFlag = rcExt(item.extension, "identifier") ?? false;
      const fieldNote = rcExt(item.extension, "field-note") ?? "";
      const qNum = rcExt(item.extension, "question-number") ?? "";
      const matrixRanking = rcExt(item.extension, "matrix-ranking") ?? false;
      out.push({
        "Variable / Field Name": item.linkId,
        "Form Name": formName,
        "Section Header": sectionHdr,
        "Field Type": fieldType,
        "Field Label": item.text || item.linkId,
        "Choices, Calculations, OR Slider Labels": choices,
        "Field Note": fieldNote,
        "Text Validation Type OR Show Slider Number": textValidation,
        "Text Validation Min": validationMin,
        "Text Validation Max": validationMax,
        "Identifier?": identFlag ? "y" : "",
        "Branching Logic (Show field only if...)": branchingLogic,
        "Required Field?": item.required ? "y" : "",
        "Custom Alignment": alignment,
        "Question Number (surveys only)": qNum,
        "Matrix Group Name": matrixGroup,
        "Matrix Ranking?": matrixRanking ? "y" : "",
        "Field Annotation": annotation
      });
    }
  }
  function fromFHIR(questJson) {
    const rows = [];
    flattenItems(questJson.item || [], "my_form", "", rows, 0);
    const lines = [HEADERS.map(csvCell).join(",")];
    for (const row of rows) lines.push(rowToLine(row));
    return lines.join("\r\n") + "\r\n";
  }

  // js/fhir/validators/registry.js
  var ValidatorRegistry = class {
    constructor() {
      this._validators = [];
    }
    /** @param {import('./base.js').Validator} validator */
    register(validator) {
      this._validators.push(validator);
    }
    /** @returns {import('./base.js').Validator[]} */
    getAll() {
      return [...this._validators];
    }
    /**
     * Run all validators in parallel.
     * Each result: { validator, issues: Issue[], error: Error|null }
     *
     * Never rejects — errors are captured per-validator in the result.
     *
     * @param {object} questJson
     * @param {Array}  tree
     * @param {object} values
     * @returns {Promise<Array<{validator, issues, error}>>}
     */
    async runAll(questJson, tree, values = {}) {
      return Promise.all(
        this._validators.map(
          (v) => v.run(questJson, tree, values).then((issues) => ({ validator: v, issues, error: null })).catch((err) => ({ validator: v, issues: [], error: err }))
        )
      );
    }
  };
  var validatorRegistry = new ValidatorRegistry();

  // js/fhir/validators/base.js
  var Validator = class {
    constructor() {
      this.enabled = true;
      if (typeof document !== "undefined") {
        document.addEventListener(AppEvents.VALIDATOR_TOGGLE, (e) => {
          if (e.detail?.id === this.id) this.enabled = e.detail.enabled;
        });
      }
    }
    /** @returns {string} unique identifier — must match the id used in VALIDATOR_TOGGLE events */
    get id() {
      return "";
    }
    /** @returns {string} */
    get name() {
      throw new Error("Validator.name must be implemented");
    }
    /** @returns {'local'|'external'} */
    get type() {
      return "local";
    }
    /**
     * Entry point. Returns [] immediately if disabled.
     * Subclasses override _run(), not this method.
     *
     * @param {object}  questJson  Exported FHIR Questionnaire JSON
     * @param {Array}   tree       Internal node tree (for local validators)
     * @param {object}  values     Current form values (for local validators)
     * @returns {Promise<Array<{severity:string, nodeId:string, message:string}>>}
     */
    async run(questJson, tree, values) {
      if (!this.enabled) return [];
      return this._run(questJson, tree, values);
    }
    // eslint-disable-next-line no-unused-vars
    async _run(questJson, tree, values) {
      return [];
    }
  };

  // js/fhir/validators/redcap-compat.js
  var _ITEM_CTRL = FHIR.itemControl;
  var RC3 = APP_URL.redcapNs;
  var UNSUPPORTED_EXTS = /* @__PURE__ */ new Set([
    FHIR.answerExpression,
    FHIR.initialExpression,
    FHIR.choiceColumn,
    FHIR.itemContext,
    FHIR.constraint,
    FHIR.variable
  ]);
  function walk(items, cb, depth = 0) {
    for (const item of items || []) {
      cb(item, depth);
      if (item.item) walk(item.item, cb, depth + 1);
    }
  }
  function hasRcOrigin(item) {
    return (item.extension || []).some((e) => e.url.startsWith(RC3));
  }
  var REDCapCompatValidator = class extends Validator {
    constructor() {
      super();
      this.enabled = false;
    }
    get id() {
      return "redcap-compat";
    }
    get name() {
      return "REDCap Compatibility";
    }
    get type() {
      return "local";
    }
    // eslint-disable-next-line no-unused-vars
    async _run(questJson, tree, values) {
      if (!questJson) return [];
      const issues = [];
      let maxGroupDepth = 0;
      walk(questJson.item, (item, depth) => {
        const id = item.linkId || "(unknown)";
        if (item.type === "group") {
          if (depth > maxGroupDepth) maxGroupDepth = depth;
          if (depth >= 2 && !hasRcOrigin(item)) {
            issues.push({
              severity: "warning",
              nodeId: id,
              message: `Group "${item.text || id}" is nested at depth ${depth + 1}. REDCap supports at most 2 levels (Form \u2192 Section). It will be flattened into its parent section.`
            });
          }
        }
        if (item.type === "group") return;
        if (item.answerValueSet && !hasRcOrigin(item)) {
          issues.push({
            severity: "error",
            nodeId: id,
            message: `"${item.text || id}": answerValueSet by URL ("${item.answerValueSet}") cannot be represented in REDCap \u2014 choices must be inline. The field will be exported with empty choices.`
          });
        }
        if (item.code && item.code.length > 0 && !hasRcOrigin(item)) {
          issues.push({
            severity: "warning",
            nodeId: id,
            message: `"${item.text || id}": item.code (FHIR Coding) has no REDCap equivalent and will be dropped.`
          });
        }
        if (item.enableWhenExpression && !hasRcOrigin(item)) {
          issues.push({
            severity: "warning",
            nodeId: id,
            message: `"${item.text || id}": FHIRPath-based enableWhenExpression cannot be translated to REDCap branching logic. The branching condition will be lost.`
          });
        }
        if (!hasRcOrigin(item) && item.enableWhen && item.enableWhen.length > 1) {
          const hasAllOp = item.enableBehavior === "all" || !item.enableBehavior;
          const hasAnyOp = item.enableBehavior === "any";
          if (!hasAllOp && !hasAnyOp) {
            issues.push({
              severity: "warning",
              nodeId: id,
              message: `"${item.text || id}": enableBehavior "${item.enableBehavior}" is not supported in REDCap. Branching logic may be incorrect.`
            });
          }
        }
        if (!hasRcOrigin(item)) {
          for (const e of item.extension || []) {
            if (UNSUPPORTED_EXTS.has(e.url)) {
              const shortName = e.url.split("/").pop();
              issues.push({
                severity: "warning",
                nodeId: id,
                message: `"${item.text || id}": extension "${shortName}" has no REDCap equivalent and will be dropped.`
              });
            }
          }
        }
        if (!hasRcOrigin(item)) {
          if (item.type === "reference") {
            issues.push({
              severity: "warning",
              nodeId: id,
              message: `"${item.text || id}": type "reference" (FHIR resource reference) has no REDCap equivalent \u2014 will be exported as a text field.`
            });
          }
          if (item.type === "quantity") {
            issues.push({
              severity: "warning",
              nodeId: id,
              message: `"${item.text || id}": type "quantity" (value + unit) has no direct REDCap equivalent \u2014 will be exported as a text field. Consider splitting into two fields.`
            });
          }
        }
        if (!hasRcOrigin(item)) {
          const calcExt = (item.extension || []).find(
            (e) => e.url === FHIR.calculatedExpression
          );
          if (calcExt) {
            issues.push({
              severity: "warning",
              nodeId: id,
              message: `"${item.text || id}": calculatedExpression uses FHIRPath \u2014 stored as a REDCap calc formula annotation. Manual adjustment in REDCap will be required.`
            });
          }
        }
      });
      return issues;
    }
  };

  // js/fhir/converters/redcap/index.js
  var redcapCompatValidator = new REDCapCompatValidator();
  validatorRegistry.register(redcapCompatValidator);

  // js/fhir/formats/redcap.js
  formatRegistry.register({
    id: "redcap",
    label: "REDCap CSV \u2014 Data Dictionary (.csv)",
    isBuilderVersion: false,
    metaVersion: null,
    ext: "csv",
    mimeType: "text/csv;charset=utf-8;",
    reportTitle: "REDCap Export \u2014 Compatibility Report",
    // Exclude the FHIR server validator: it validates FHIR spec conformance, which
    // is irrelevant when the output is a REDCap CSV. Only local + redcap-compat run.
    validatorFilter: (v) => v.type !== "external",
    /** Returns a CSV string from a base FHIR R4 Questionnaire object. */
    build(baseQ) {
      return fromFHIR(baseQ);
    },
    onBeforeReport() {
      redcapCompatValidator.enabled = true;
    },
    onAfterExport() {
      redcapCompatValidator.enabled = false;
    },
    onCancel() {
      redcapCompatValidator.enabled = false;
    }
  });

  // js/fhir/urls/ucum.js
  var UCUM = "http://unitsofmeasure.org";
  var UCUM_URL = {
    system: UCUM,
    valueSet: UCUM + "/vs"
  };

  // js/fhir/urls/w3c.js
  var W3 = "http://www.w3.org";
  var W3C_URL = {
    xhtml: W3 + "/1999/xhtml"
  };

  // js/fhir/export.js
  var _svc2 = {};
  function configure2(svc) {
    _svc2 = { ..._svc2, ...svc };
  }
  if (typeof document !== "undefined") {
    document.addEventListener(
      AppEvents.APP_CONTEXT_READY,
      (e) => {
        if (e.detail?.questDoc) configure2({ questDoc: e.detail.questDoc });
      }
    );
  }
  function _esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function generateNarrativeDiv(q) {
    const meta = [];
    meta.push(`<tr><td><b>Status</b></td><td>${_esc(q.status)}</td></tr>`);
    if (q.date) meta.push(`<tr><td><b>Date</b></td><td>${_esc(q.date)}</td></tr>`);
    if (q.version) meta.push(`<tr><td><b>Version</b></td><td>${_esc(q.version)}</td></tr>`);
    if (q.publisher) meta.push(`<tr><td><b>Publisher</b></td><td>${_esc(q.publisher)}</td></tr>`);
    if (q.description) meta.push(`<tr><td><b>Description</b></td><td>${_esc(q.description)}</td></tr>`);
    const rows = [];
    function collectItems(items, depth) {
      for (const item of items || []) {
        const pad = "\xA0\xA0\xA0\xA0".repeat(depth);
        rows.push(`<tr><td>${_esc(item.linkId)}</td><td>${pad}${_esc(item.text)}</td><td>${_esc(item.type)}</td></tr>`);
        if (item.item) collectItems(item.item, depth + 1);
      }
    }
    collectItems(q.item, 0);
    const parts = [
      '<div xmlns="' + W3C_URL.xhtml + '">',
      `<h2>${_esc(q.title || q.id || "Questionnaire")}</h2>`,
      `<table><tbody>${meta.join("")}</tbody></table>`
    ];
    if (rows.length) {
      parts.push(`<table><thead><tr><th>LinkId</th><th>Text</th><th>Type</th></tr></thead><tbody>${rows.join("")}</tbody></table>`);
    }
    parts.push("</div>");
    return parts.join("");
  }
  function itemTypeToFHIRType(t) {
    if (t === "checkbox") return "boolean";
    if (t === "integer") return "integer";
    if (t === "decimal") return "decimal";
    if (t === "number") return "decimal";
    if (t === "quantity") return "quantity";
    if (t === "select" || t === "radio" || t === "checklist") return "choice";
    if (t === "open-choice") return "open-choice";
    if (t === "display") return "display";
    if (t === "date") return "date";
    if (t === "dateTime") return "dateTime";
    if (t === "time") return "time";
    if (t === "url") return "url";
    if (t === "attachment") return "attachment";
    if (t === "reference") return "reference";
    return "string";
  }
  function buildConstraintExtensions(constraint) {
    if (!constraint || !constraint.length) return [];
    return constraint.filter((c) => c.expression).map((c) => ({
      url: FHIR.constraint,
      extension: [
        ...c.key ? [{ url: "key", valueId: c.key }] : [],
        ...c.severity ? [{ url: "severity", valueCode: c.severity }] : [],
        { url: "expression", valueString: c.expression },
        ...c.human ? [{ url: "human", valueString: c.human }] : []
      ]
    }));
  }
  function nodeToFHIRItem(node) {
    const fhirItem = {
      linkId: node.id,
      text: node.title,
      type: node.type === "group" ? "group" : itemTypeToFHIRType(node.itemType)
    };
    if (node._prefix) fhirItem.prefix = node._prefix;
    if (node._definition) fhirItem.definition = node._definition;
    if (node._baseType) {
      fhirItem.extension = fhirItem.extension || [];
      fhirItem.extension.push({ url: FHIR.baseType, valueCode: node._baseType });
    }
    if (node._fhirType) {
      fhirItem.extension = fhirItem.extension || [];
      fhirItem.extension.push({ url: FHIR.fhirType, valueString: node._fhirType });
    }
    if (node._codes && node._codes.length && node.itemType !== "display") fhirItem.code = node._codes;
    if (node.mandatory === true && node.itemType !== "display") fhirItem.required = true;
    const hasAnswerOptions = node.type === "item" && (node.options || node._rawAnswerOptions || node._answerValueSet || node._answerExpression || node._candidateExpression);
    if (node.type === "item" && node.itemType !== "display" && !hasAnswerOptions) {
      const t = itemTypeToFHIRType(node.itemType);
      const buildInitEntry = (v) => {
        if (t === "boolean") return { valueBoolean: typeof v === "boolean" ? v : v === "true" };
        if (t === "decimal") {
          const n = parseFloat(v);
          return isFinite(n) ? { valueDecimal: n } : null;
        }
        if (t === "integer") {
          const n = parseInt(v, 10);
          return isFinite(n) ? { valueInteger: n } : null;
        }
        if (t === "date") return { valueDate: String(v) };
        if (t === "dateTime") return { valueDateTime: String(v) };
        if (t === "time") return { valueTime: String(v) };
        if (t === "url") return { valueUri: String(v) };
        if (t === "reference") {
          const ref = v && typeof v === "object" ? v.reference : typeof v === "string" ? v : "";
          return ref ? { valueReference: { reference: ref } } : null;
        }
        if (t === "choice") return { valueCoding: { code: String(v), display: String(v) } };
        return { valueString: String(v) };
      };
      if (node.repeats && node._initialValues && node._initialValues.length > 1) {
        const entries = node._initialValues.map(buildInitEntry).filter(Boolean);
        if (entries.length) fhirItem.initial = entries;
      } else if (node._initialValue !== void 0 && node._initialValue !== "") {
        const entry = buildInitEntry(node._initialValue);
        if (entry) fhirItem.initial = [entry];
      }
    }
    if (node.enableWhen && node.enableWhen.length) {
      fhirItem.enableWhen = node.enableWhen.map((ew) => ({ ...ew }));
      if (node.enableWhen.length > 1 || node.enableBehavior === "any") {
        fhirItem.enableBehavior = node.enableBehavior === "any" ? "any" : "all";
      }
    }
    const ext = [];
    if (node.enableWhenExpression) {
      ext.push({
        url: FHIR.enableWhenExpression,
        valueExpression: { language: "text/fhirpath", expression: node.enableWhenExpression }
      });
    }
    const userConstraints = (node.constraint || []).filter((c) => c.key !== ITLH_KEY_GROUP_OR);
    ext.push(...buildConstraintExtensions(userConstraints));
    if (node.type === "group" && node.logicWithParent === "OR" && node.children.length > 0) {
      const fp = node.children.map((c) => `%resource.item.where(linkId='${c.id.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}').answer.exists()`).join(" or ");
      ext.push({
        url: FHIR.constraint,
        extension: [
          { url: "key", valueId: ITLH_KEY_GROUP_OR },
          { url: "severity", valueCode: "error" },
          { url: "human", valueString: "At least one item in this group must be completed" },
          { url: "expression", valueString: fp }
        ]
      });
    }
    if (node.itemType === "reference" && node.referenceResource)
      ext.push({ url: FHIR.referenceResource, valueCode: node.referenceResource });
    if (node.itemType === "reference" && node._referenceFilter)
      ext.push({ url: FHIR.referenceFilter, valueString: node._referenceFilter });
    if (node.itemType === "reference" && node._referenceProfiles?.length) {
      for (const url of node._referenceProfiles) {
        ext.push({ url: FHIR.referenceProfile, valueCanonical: url });
      }
    }
    if ((node.itemType === "integer" || node.itemType === "decimal") && node.quantityUnit)
      ext.push({ url: FHIR.unit, valueCoding: { system: UCUM_URL.system, code: node.quantityUnit } });
    if (node.itemType === "quantity" && node.quantityUnit && !node._unitOptions?.length)
      ext.push({ url: FHIR.unitOption, valueCoding: { system: UCUM_URL.system, code: node.quantityUnit } });
    if (node.itemType === "quantity" && node._unitValueSet)
      ext.push({ url: FHIR.unitValueSet, valueCanonical: node._unitValueSet });
    if (node.itemType === "quantity" && node._unitOptions && node._unitOptions.length) {
      for (const u of node._unitOptions) {
        const coding = {};
        if (u.system) coding.system = u.system;
        if (u.code) coding.code = u.code;
        if (u.display) coding.display = u.display;
        ext.push({ url: FHIR.unitOption, valueCoding: coding });
      }
    }
    if (node._calculatedExpr)
      ext.push({ url: FHIR.calculatedExpression, valueExpression: { language: "text/fhirpath", expression: node._calculatedExpr } });
    if (node._initialExpr)
      ext.push({ url: FHIR.initialExpression, valueExpression: { language: "text/fhirpath", expression: node._initialExpr } });
    for (const { url, prop } of ANSWER_SOURCE_EXPR_EXTS) {
      if (node[prop])
        ext.push({ url, valueExpression: { language: "text/fhirpath", expression: node[prop] } });
    }
    if (node.itemType === "radio")
      ext.push({ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ system: FHIR.itemControlCS, code: "radio-button" }] } });
    else if (node.itemType === "checklist")
      ext.push({ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ system: FHIR.itemControlCS, code: "check-box" }] } });
    else if (node._itemControl)
      ext.push({ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ system: FHIR.itemControlCS, code: node._itemControl }] } });
    const _textExts = [];
    if (node._renderStyle) _textExts.push({ url: FHIR.renderingStyle, valueString: node._renderStyle });
    if (node._renderXhtml) _textExts.push({ url: FHIR.renderingXhtml, valueString: node._renderXhtml });
    if (node._renderMarkdown) _textExts.push({ url: FHIR.renderingMarkdown, valueMarkdown: node._renderMarkdown });
    if (_textExts.length) fhirItem._text = { extension: _textExts };
    if (node.type === "group") {
      fhirItem.item = node.children.map(nodeToFHIRItem);
    } else if ((node.itemType === "select" || node.itemType === "radio" || node.itemType === "open-choice" || node.itemType === "checklist") && (node.options || node._rawAnswerOptions) && !node._answerValueSet && !node._answerExpression && !node._candidateExpression) {
      if (node._rawAnswerOptions) {
        fhirItem.answerOption = node._rawAnswerOptions.map((opt) => {
          const key = opt.valueCoding ? opt.valueCoding.code || opt.valueCoding.display || "" : opt.valueString !== void 0 ? opt.valueString : opt.valueInteger !== void 0 ? String(opt.valueInteger) : opt.valueDate !== void 0 ? opt.valueDate : opt.valueTime !== void 0 ? opt.valueTime : opt.valueReference ? typeof opt.valueReference === "string" ? opt.valueReference : opt.valueReference.reference || "" : "";
          const optOut = { ...opt };
          const MANAGED_OPT_EXTS = /* @__PURE__ */ new Set([
            FHIR.ordinalValue,
            FHIR.optionPrefix,
            FHIR.optionExclusive,
            FHIR.itemWeight,
            FHIR.answerMedia
          ]);
          const optExts = (opt.extension || []).filter((e) => !MANAGED_OPT_EXTS.has(e.url));
          if (node._optionOrdinals?.[key] !== void 0) {
            optExts.push({ url: FHIR.ordinalValue, valueDecimal: node._optionOrdinals[key] });
          }
          if (node._optionPrefixes?.[key]) {
            optExts.push({ url: FHIR.optionPrefix, valueString: node._optionPrefixes[key] });
          }
          if (node._optionExclusives?.[key]) {
            optExts.push({ url: FHIR.optionExclusive, valueBoolean: true });
          }
          if (node._optionWeights?.[key] !== void 0) {
            optExts.push({ url: FHIR.itemWeight, valueDecimal: node._optionWeights[key] });
          }
          if (node._answerMedias?.[key]) {
            optExts.push({ url: FHIR.answerMedia, valueAttachment: node._answerMedias[key] });
          }
          if (optExts.length) optOut.extension = optExts;
          if (node._initialSelected === key) optOut.initialSelected = true;
          return optOut;
        });
      } else {
        fhirItem.answerOption = parseOptions(node.options).map(({ code, display }) => {
          const coding = { ...node._optionSystems?.[code] ? { system: node._optionSystems[code] } : {}, code, display };
          const answerOpt = { valueCoding: coding };
          const optExts = [];
          if (node._optionOrdinals && node._optionOrdinals[code] !== void 0) {
            optExts.push({ url: FHIR.ordinalValue, valueDecimal: node._optionOrdinals[code] });
          }
          if (node._optionPrefixes && node._optionPrefixes[code] !== void 0) {
            optExts.push({ url: FHIR.optionPrefix, valueString: node._optionPrefixes[code] });
          }
          if (node._optionExclusives && node._optionExclusives[code]) {
            optExts.push({ url: FHIR.optionExclusive, valueBoolean: true });
          }
          if (node._optionWeights && node._optionWeights[code] !== void 0) {
            optExts.push({ url: FHIR.itemWeight, valueDecimal: node._optionWeights[code] });
          }
          if (node._answerMedias && node._answerMedias[code]) {
            optExts.push({ url: FHIR.answerMedia, valueAttachment: node._answerMedias[code] });
          }
          if (optExts.length) answerOpt.extension = optExts;
          if (node._initialSelected === code) answerOpt.initialSelected = true;
          return answerOpt;
        });
      }
    }
    const _maxLengthAllowed = /* @__PURE__ */ new Set(["checkbox", "decimal", "integer", "number", "text", "url", "open-choice"]);
    if (node._maxLength !== void 0 && node._maxLength !== null && _maxLengthAllowed.has(node.itemType)) fhirItem.maxLength = node._maxLength;
    if (node.type === "item" && node.children?.length > 0) {
      fhirItem.item = node.children.map(nodeToFHIRItem);
    }
    if (node._answerConstraint) fhirItem.answerConstraint = node._answerConstraint;
    if (node._minLength !== void 0 && node._minLength !== null) {
      ext.push({ url: FHIR.minLength, valueInteger: node._minLength });
    }
    if (node._regex) {
      ext.push({ url: FHIR.regex, valueString: node._regex });
    }
    if (node._maxFileSizeMB !== void 0 && node._maxFileSizeMB !== null) {
      ext.push({ url: FHIR.maxSize, valueDecimal: node._maxFileSizeMB });
    }
    if (node._mimeTypes && node._mimeTypes.length) {
      for (const mime of node._mimeTypes) {
        if (mime) ext.push({ url: FHIR.mimeType, valueCode: mime });
      }
    }
    if (node._entryFormat) {
      ext.push({ url: FHIR.entryFormatSdc, valueString: node._entryFormat });
    }
    if (node._choiceOrientation) {
      ext.push({ url: FHIR.choiceOrientation, valueCode: node._choiceOrientation });
    }
    if (Number.isInteger(node._columnCount) && node._columnCount > 1) {
      ext.push({ url: FHIR.columnCount, valueInteger: node._columnCount });
    }
    if (node._choiceColumns && node._choiceColumns.length) {
      for (const col of node._choiceColumns) {
        const sub = [];
        if (col.path) sub.push({ url: "path", valueString: col.path });
        if (col.label) sub.push({ url: "label", valueString: col.label });
        if (col.width) sub.push({ url: "width", valueQuantity: col.width });
        if (col.forDisplay !== void 0) sub.push({ url: "forDisplay", valueBoolean: col.forDisplay });
        ext.push({ url: FHIR.choiceColumn, extension: sub });
      }
    }
    if (node._supportLinks && node._supportLinks.length) {
      for (const uri of node._supportLinks) {
        if (uri) ext.push({ url: FHIR.supportLink, valueUri: uri });
      }
    }
    if (node._hidden) {
      ext.push({ url: FHIR.hiddenSdc, valueBoolean: true });
    }
    if (node._isSubject && node.type === "item" && node.itemType !== "display") {
      ext.push({ url: FHIR.isSubject, valueBoolean: true });
    }
    if (node._observationExtract != null && node.itemType !== "display") {
      ext.push({ url: FHIR.observationExtract, valueBoolean: node._observationExtract !== false });
    }
    if (node.type === "group" && node._collapsible) {
      ext.push({ url: FHIR.collapsible, valueCode: node._collapsible });
    }
    if (node.itemType === "open-choice" && node._openLabel) {
      ext.push({ url: FHIR.openLabel, valueString: node._openLabel });
    }
    if (node._preferredTermServer) {
      ext.push({ url: FHIR.preferredTerminologyServer, valueUrl: node._preferredTermServer });
    }
    if (node._shortText) {
      ext.push({ url: FHIR.shortText, valueString: node._shortText });
    }
    if (node._designNote) {
      ext.push({ url: FHIR.designNote, valueMarkdown: node._designNote });
    }
    if (node._usageMode) {
      ext.push({ url: FHIR.usageMode, valueCode: node._usageMode });
    }
    if (node._signatureRequired?.length) {
      for (const sig of node._signatureRequired) {
        ext.push({
          url: FHIR.signatureRequired,
          valueCodeableConcept: { coding: [{ system: sig.system, code: sig.code, display: sig.display }] }
        });
      }
    }
    if (node._itemMedia) {
      ext.push({ url: FHIR.itemMedia, valueAttachment: node._itemMedia });
    }
    if (node._displayCategory && node.itemType !== "display") {
      ext.push({
        url: FHIR.displayCategory,
        valueCodeableConcept: { coding: [{ system: FHIR.displayCategoryCS, code: node._displayCategory }] }
      });
    }
    if (node._minValue !== void 0) {
      const isInt = Number.isInteger(node._minValue);
      ext.push({ url: FHIR.minValue, [isInt ? "valueInteger" : "valueDecimal"]: node._minValue });
    }
    if (node._maxValue !== void 0) {
      const isInt = Number.isInteger(node._maxValue);
      ext.push({ url: FHIR.maxValue, [isInt ? "valueInteger" : "valueDecimal"]: node._maxValue });
    }
    const _answerVsAllowed = /* @__PURE__ */ new Set(["select", "radio", "checklist", "open-choice", "decimal", "integer", "number", "text", "date", "dateTime", "time", "quantity"]);
    if (node.type === "item" && node._answerValueSet && _answerVsAllowed.has(node.itemType)) fhirItem.answerValueSet = node._answerValueSet;
    if (node._readOnly && node.itemType !== "display") fhirItem.readOnly = true;
    if (node._disabledDisplay) fhirItem.disabledDisplay = node._disabledDisplay;
    if ((node.repeats || node.itemType === "checklist") && node.itemType !== "display") fhirItem.repeats = true;
    if (node.repeats && node._minOccurs !== void 0 && node.itemType !== "display" && node.required)
      ext.push({ url: FHIR.minOccurs, valueInteger: node._minOccurs });
    if (node.repeats && node._maxOccurs !== void 0)
      ext.push({ url: FHIR.maxOccurs, valueInteger: node._maxOccurs });
    if (node._maxDecimalPlaces !== void 0) {
      ext.push({ url: FHIR.maxDecimalPlaces, valueInteger: node._maxDecimalPlaces });
    }
    if (node._sliderStep !== void 0) {
      const isInt = Number.isInteger(node._sliderStep);
      const stepVal = isInt ? node._sliderStep : Math.round(node._sliderStep);
      ext.push({ url: FHIR.sliderStepValue, valueInteger: stepVal });
    }
    if (node._unknownExtensions && node._unknownExtensions.length) {
      ext.push(...node._unknownExtensions.map((e) => JSON.parse(JSON.stringify(e))));
    }
    if (ext.length) fhirItem.extension = ext;
    return fhirItem;
  }
  function buildFHIRObject(questDoc2 = _svc2.questDoc) {
    const { tree, meta: questMeta, rawFhir, variables: questVariables, contained: questContained, translations } = questDoc2;
    const SDC_VAR_URL = FHIR.variable;
    const q = {
      resourceType: "Questionnaire",
      id: questMeta.id || "logic-builder-export",
      status: questMeta.status || "draft",
      item: tree.map(nodeToFHIRItem)
    };
    if (questMeta.url) q.url = questMeta.url;
    if (questMeta.version) q.version = questMeta.version;
    q.title = questMeta.title || rawFhir && rawFhir.title || "Untitled Questionnaire";
    if (questMeta.name) q.name = questMeta.name;
    if (questMeta.publisher) q.publisher = questMeta.publisher;
    if (questMeta.description) q.description = questMeta.description;
    if (questMeta.experimental !== null) q.experimental = questMeta.experimental;
    if (questMeta._implicitRules) q.implicitRules = questMeta._implicitRules;
    if (questMeta.language) q.language = questMeta.language;
    if (questMeta.purpose) q.purpose = questMeta.purpose;
    if (questMeta.copyright) q.copyright = questMeta.copyright;
    if (questMeta.copyrightLabel) q.copyrightLabel = questMeta.copyrightLabel;
    if (questMeta._versionAlgorithmString) q.versionAlgorithmString = questMeta._versionAlgorithmString;
    else if (questMeta._versionAlgorithmCoding) q.versionAlgorithmCoding = JSON.parse(JSON.stringify(questMeta._versionAlgorithmCoding));
    if (questMeta.approvalDate) q.approvalDate = questMeta.approvalDate;
    if (questMeta.lastReviewDate) q.lastReviewDate = questMeta.lastReviewDate;
    q.date = questMeta.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (questMeta.subjectType?.length) q.subjectType = [...questMeta.subjectType];
    if (questMeta._rawIdentifier?.length) q.identifier = JSON.parse(JSON.stringify(questMeta._rawIdentifier));
    q.text = questMeta._rawText ? { status: questMeta._rawText.status, div: questMeta._rawText.div } : { status: "generated", div: generateNarrativeDiv(q) };
    if (questMeta._rawContact) q.contact = questMeta._rawContact;
    if (questMeta._rawUseContext) q.useContext = questMeta._rawUseContext;
    if (questMeta._rawJurisdiction) q.jurisdiction = questMeta._rawJurisdiction;
    if (questMeta._rawCode) q.code = questMeta._rawCode;
    if (questMeta._rawModifierExtension?.length) q.modifierExtension = JSON.parse(JSON.stringify(questMeta._rawModifierExtension));
    if (questMeta.derivedFrom?.length) q.derivedFrom = questMeta.derivedFrom;
    if (questMeta.effectivePeriodStart || questMeta.effectivePeriodEnd) {
      const ep = {};
      if (questMeta.effectivePeriodStart) ep.start = questMeta.effectivePeriodStart;
      if (questMeta.effectivePeriodEnd) ep.end = questMeta.effectivePeriodEnd;
      q.effectivePeriod = ep;
    }
    const vars = questVariables.filter((v) => v.name && v.expression);
    const REPLACES_EXT_URL = FHIR.replaces;
    const questExt = [
      ...vars.map((v) => ({
        url: SDC_VAR_URL,
        valueExpression: { name: v.name, language: "text/fhirpath", expression: v.expression }
      })),
      ...(questMeta.replaces || []).filter((u) => u.trim()).map((u) => ({
        url: REPLACES_EXT_URL,
        valueCanonical: u.trim()
      })),
      ...questMeta.preferredTermServer?.trim() ? [{
        url: FHIR.preferredTerminologyServer,
        valueUrl: questMeta.preferredTermServer.trim()
      }] : [],
      ...(questMeta._signatureRequired || []).map((sig) => ({
        url: FHIR.signatureRequired,
        valueCodeableConcept: { coding: [{ system: sig.system, code: sig.code, display: sig.display }] }
      })),
      ...(questMeta.launchContexts || []).filter((lc) => lc.name.trim()).map((lc) => ({
        url: FHIR.launchContext,
        extension: [
          { url: "name", valueCoding: { system: FHIR.launchContextCS, code: lc.name.trim() } },
          ...lc.type.trim() ? [{ url: "type", valueCode: lc.type.trim() }] : [],
          ...lc.description.trim() ? [{ url: "description", valueString: lc.description.trim() }] : []
        ]
      })),
      ...(questMeta._rawQuestExtensions || []).map((e) => JSON.parse(JSON.stringify(e)))
    ];
    if (questExt.length) q.extension = questExt;
    if (questContained.length) {
      q.contained = questContained.map((r) => JSON.parse(JSON.stringify(r)));
    }
    const hasMetaContent = questMeta._metaVersionId || questMeta._metaSource || questMeta._metaLastUpdated || questMeta._rawMetaProfile?.length || questMeta._rawMetaTag?.length || questMeta._rawMetaSecurity?.length;
    if (hasMetaContent) {
      q.meta = { lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
      if (questMeta._metaVersionId) q.meta.versionId = questMeta._metaVersionId;
      if (questMeta._metaSource) q.meta.source = questMeta._metaSource;
      if (questMeta._rawMetaProfile?.length) q.meta.profile = questMeta._rawMetaProfile;
      if (questMeta._rawMetaTag?.length) q.meta.tag = questMeta._rawMetaTag;
      if (questMeta._rawMetaSecurity?.length) q.meta.security = questMeta._rawMetaSecurity;
    }
    _exportTranslations(q, translations);
    return q;
  }
  var TRANSLATION_URL2 = FHIR.translation;
  function _exportTranslations(q, translations) {
    if (!translations || !Object.keys(translations).length) return;
    const langs = Object.keys(translations);
    const titleExts = langs.filter((l) => translations[l].title).map((l) => _translationExt(l, translations[l].title));
    if (titleExts.length) {
      q._title = q._title || {};
      q._title.extension = _mergeTranslationExts(q._title.extension || [], titleExts);
    }
    function walkItems(items) {
      for (const fi of items || []) {
        const textExts = langs.filter((l) => translations[l].items[fi.linkId] != null).map((l) => _translationExt(l, translations[l].items[fi.linkId]));
        if (textExts.length) {
          fi._text = fi._text || {};
          fi._text.extension = _mergeTranslationExts(fi._text.extension || [], textExts);
        }
        for (const ao of fi.answerOption || []) {
          const code = ao.valueCoding?.code || ao.valueString || ao.valueInteger?.toString();
          if (!code) continue;
          const key = fi.linkId + "__" + code;
          const optExts = langs.filter((l) => translations[l].opts[key] != null).map((l) => _translationExt(l, translations[l].opts[key]));
          if (!optExts.length) continue;
          if (ao.valueCoding) {
            ao._valueCoding = ao._valueCoding || {};
            ao._valueCoding._display = ao._valueCoding._display || {};
            ao._valueCoding._display.extension = _mergeTranslationExts(
              ao._valueCoding._display.extension || [],
              optExts
            );
          }
        }
        walkItems(fi.item);
      }
    }
    walkItems(q.item);
    const UI_TRANS_URL = APP_URL.uiTranslations;
    q.extension = (q.extension || []).filter((e) => e.url !== UI_TRANS_URL);
    for (const lang of langs) {
      const ui = translations[lang].ui;
      if (!ui || !Object.keys(ui).length) continue;
      q.extension.push({
        url: UI_TRANS_URL,
        extension: [
          { url: "lang", valueCode: lang },
          { url: "strings", valueString: JSON.stringify(ui) }
        ]
      });
    }
    if (!q.extension.length) delete q.extension;
    const XHTML_TRANS_URL = APP_URL.xhtmlTranslations;
    q.extension = (q.extension || []).filter((e) => e.url !== XHTML_TRANS_URL);
    for (const lang of langs) {
      const xhtml = translations[lang].xhtml;
      if (!xhtml || !Object.keys(xhtml).length) continue;
      q.extension.push({
        url: XHTML_TRANS_URL,
        extension: [
          { url: "lang", valueCode: lang },
          { url: "strings", valueString: JSON.stringify(xhtml) }
        ]
      });
    }
    const MD_TRANS_URL = APP_URL.markdownTranslations;
    q.extension = (q.extension || []).filter((e) => e.url !== MD_TRANS_URL);
    for (const lang of langs) {
      const markdown = translations[lang].markdown;
      if (!markdown || !Object.keys(markdown).length) continue;
      q.extension.push({
        url: MD_TRANS_URL,
        extension: [
          { url: "lang", valueCode: lang },
          { url: "strings", valueString: JSON.stringify(markdown) }
        ]
      });
    }
    if (!q.extension.length) delete q.extension;
  }
  function _translationExt(lang, content) {
    return {
      url: TRANSLATION_URL2,
      extension: [
        { url: "lang", valueCode: lang },
        { url: "content", valueString: content }
      ]
    };
  }
  function _mergeTranslationExts(existing, newExts) {
    const nonTrans = (existing || []).filter((e) => e.url !== TRANSLATION_URL2);
    return [...nonTrans, ...newExts];
  }

  // js/fhir/sdc-populate.js
  async function populateFromServer(fhirBase, questJson, patientRef) {
    const sdcBase = serverConfig.get(CONFIG_KEYS.SDC_SERVER) || fhirBase;
    const base = sdcBase.replace(/\/$/, "");
    const targetUrl = `${base}/Questionnaire/$populate`;
    const url = proxiedUrl(targetUrl);
    const body = JSON.stringify({
      resourceType: "Parameters",
      parameter: [
        { name: "questionnaire", resource: questJson },
        { name: "subject", valueReference: { reference: patientRef } }
      ]
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
        "Accept": "application/fhir+json"
      },
      body,
      signal: AbortSignal.timeout(3e4)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text.substring(0, 150);
      try {
        const oo = JSON.parse(text);
        const issue = oo?.issue?.[0];
        detail = issue?.diagnostics || issue?.details?.text || detail;
      } catch {
      }
      const hint = res.status === 400 || res.status === 404 ? " (This server may not support the SDC $populate operation.)" : "";
      throw new Error(`$populate: HTTP ${res.status}${detail ? " \u2014 " + detail : ""}${hint}`);
    }
    const result = await res.json();
    if (result.resourceType === "QuestionnaireResponse") return result;
    if (result.resourceType === "Parameters") {
      const param = result.parameter?.find(
        (p) => p.name === "questionnaire-response" || p.name === "response" || p.name === "return"
      );
      if (param?.resource?.resourceType === "QuestionnaireResponse") return param.resource;
      throw new Error(`$populate Parameters response did not contain a QuestionnaireResponse`);
    }
    throw new Error(`$populate returned unexpected resourceType: ${result.resourceType}`);
  }

  // js/preview-form.js
  var fhirpath = window.fhirpath;
  function _yield() {
    if (typeof document !== "undefined" && document.hidden) {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  var PreviewForm = class {
    /**
     * @param {object} deps — injected state
     * @param {object} deps.questDoc
     * @param {object} deps.answerStore
     */
    constructor(opts = {}) {
      this._session = opts.session || defaultSession;
      this._bus = this._session.bus;
      this._rc = opts.rc || _rc;
      this._rc.bus = this._bus;
      this._progress = opts.progress || { show() {
      }, hide() {
      } };
      this._chrome = { search: { refresh() {
      } }, statusBadge: { update() {
      } }, languageMenu: { rebuild() {
      } }, ...opts.chrome || {} };
      this._mountEl = opts.mountEl || null;
      this._jsonEl = opts.jsonEl || null;
      const _rc2 = this._rc;
      this._tree = null;
      this._answerStore = null;
      this._rawFhir = null;
      this._questVariables = null;
      this._calcFormOk = null;
      this._viewPrefs = opts.viewPrefs || { showLinkId: true, showPrefix: true, showBadges: true, showHiddenItems: true };
      this._previewMode = opts.previewMode || "preview";
      this._lastCtx = { fp: null, qr: null, env: {} };
      this._preQR = null;
      this._preEnvVars = null;
      this._renderVersion = 0;
      this._renderTimer = null;
      this._calcCache = null;
      this._pendingCtx = null;
      this._lastVisibleSig = null;
      this._lastRepCounts = null;
      this._lastRepDataSz = null;
      this._els = {};
      _rc2.viewPrefs = this._viewPrefs;
      _rc2.lastCtx = this._lastCtx;
      _rc2.buildControl = (node, iconEl, cb) => this._buildControl(node, iconEl, cb);
      _rc2.isMandatory = isMandatory;
      _rc2.evalConstraints = evalConstraints;
      _rc2.CHECKABLE_TYPES = CHECKABLE_TYPES;
      const _initData = ({ questDoc: questDoc2, answerStore: answerStore2 }) => {
        this._tree = questDoc2.tree;
        this._answerStore = answerStore2;
        this._rawFhir = questDoc2;
        this._questVariables = questDoc2.variables;
        this._calcFormOk = (node, path) => calcFormOk(node, answerStore2, path);
        _rc2.instancePath = [];
        _rc2.translations = questDoc2.translations;
        _rc2.calcFormOk = (node) => this._calcFormOk(node, _rc2.instancePath);
        _rc2.updateGroupIcons = () => GroupNode.updateAll(_rc2);
        _rc2.getValue = (id) => answerStore2.get(id, _rc2.instancePath);
        _rc2.getAll = (id) => answerStore2.getAll(id, _rc2.instancePath);
        _rc2.set = (id, v) => answerStore2.set(id, v, _rc2.instancePath);
        _rc2.remove = (id) => answerStore2.remove(id, _rc2.instancePath);
        _rc2.instanceCount = (id, p) => answerStore2.instanceCount(id, p);
        _rc2.addInstance = (id, p) => answerStore2.addInstance(id, p);
        _rc2.removeInstance = (id, i, p) => answerStore2.removeInstance(id, i, p);
        _rc2.evalChildren = (children, p) => {
          const r = [];
          for (const ch of children) evaluateNode(ch, _rc2.ctx, r, false, p);
          return r;
        };
      };
      if (opts.session) {
        _initData({ questDoc: this._session.questDoc, answerStore: this._session.answerStore });
      } else {
        const cached = EventState.get(AppEvents.APP_CONTEXT_READY);
        if (cached?.questDoc) _initData(cached);
        else this._bus.on(AppEvents.APP_CONTEXT_READY, (e) => _initData(e.detail), { once: true });
      }
      this._bus.on(AppEvents.VIEW_PREF_CHANGE, (e) => this._onViewPrefChange(e));
      this._bus.on(AppEvents.PREVIEW_MODE_CHANGE, (e) => this._onPreviewModeChange(e));
      this._bus.on(AppEvents.REINIT_FORM, (e) => this.reinitForm({ silent: e.detail?.silent }));
      this._bus.on(AppEvents.QUESTIONNAIRE_LOADED, () => {
        this._els.lform?.closest(".right-panel-body")?.scrollTo({ top: 0 });
        this._chrome.languageMenu.rebuild(this._rawFhir?.translations);
      });
      this._bus.on(AppEvents.BUILDER_NAVIGATE, (e) => {
        this._bus.dispatch(AppEvents.PREVIEW_NAVIGATE_TO, { id: e.detail.id });
      });
      this._bus.on(AppEvents.RESPONSE_CHANGED, () => {
        ++this._renderVersion;
        clearTimeout(this._renderTimer);
        this._renderTimer = setTimeout(() => this._asyncRender(this._renderVersion), 30);
      });
      this._bus.on(AppEvents.CALC_RECALC_REQUESTED, () => {
        this._lastVisibleSig = null;
        this._lastRepCounts = null;
        this._lastRepDataSz = null;
        this._calcCache = null;
      });
      this._bus.on(AppEvents.QR_LOADED, () => {
        this._lastVisibleSig = null;
        this._lastRepCounts = null;
        this._lastRepDataSz = null;
      });
      this._bus.on(AppEvents.EXPAND_ALL_PREVIEW, () => {
        this._lastVisibleSig = null;
        this._lastRepCounts = null;
        this._lastRepDataSz = null;
        this._asyncRender(++this._renderVersion);
      });
      this._bus.on(AppEvents.COLLAPSE_ALL_PREVIEW, () => {
        this._lastVisibleSig = null;
        this._lastRepCounts = null;
        this._lastRepDataSz = null;
        this._asyncRender(++this._renderVersion);
      });
      this._bus.on(AppEvents.SDC_POPULATE_REQUESTED, (e) => this._populate(e.detail.patientRef));
      this._bus.on(AppEvents.LANGUAGE_CHANGED, (e) => {
        _rc2.activeLanguage = e.detail?.lang ?? "";
        _rc2.translations = this._rawFhir?.translations ?? {};
        this._lastVisibleSig = null;
        this._lastRepCounts = null;
        this._lastRepDataSz = null;
        this._asyncRender(++this._renderVersion);
      });
      if (opts.session) {
      } else if (EventState.get(AppEvents.APP_CONTEXT_READY)) {
        this.mount();
      } else {
        this._bus.on(AppEvents.APP_CONTEXT_READY, () => this.mount(), { once: true });
      }
    }
    // ── Public API ──────────────────────────────────────────────────────────────
    getLastCtx() {
      return this._lastCtx;
    }
    collapseAll() {
      this._bus.dispatch(AppEvents.COLLAPSE_ALL_PREVIEW);
    }
    expandAll() {
      this._bus.dispatch(AppEvents.EXPAND_ALL_PREVIEW);
    }
    /** Stop pending work. Session-bus listeners are released when the session is
     *  dereferenced; this just cancels the debounced render timer. */
    destroy() {
      clearTimeout(this._renderTimer);
    }
    mount() {
      const elements = {
        lform: this._mountEl || document.querySelector('[data-mount="preview-lform"]'),
        fhirJsonView: this._jsonEl || document.querySelector('[data-mount="fhir-json-view"]'),
        leftPanelBody: document.querySelector('[data-mount="left-panel-body"]'),
        viewOptionsWrap: document.querySelector('[data-mount="viewOptionsWrap"]'),
        previewModeWrap: document.querySelector('[data-mount="previewModeWrap"]'),
        searchWrap: document.querySelector('[data-mount="search-wrap"]')
      };
      this._els = elements;
      const syncToolbarVisibility = () => {
        const d = this._tree.length > 0 ? "" : "none";
        if (elements.viewOptionsWrap) elements.viewOptionsWrap.style.display = d;
        if (elements.searchWrap) elements.searchWrap.style.display = d;
        if (elements.previewModeWrap) elements.previewModeWrap.style.display = d;
      };
      syncToolbarVisibility();
      this._bus.on(AppEvents.QUESTIONNAIRE_LOADED, syncToolbarVisibility);
      this._bus.on(AppEvents.QUESTIONNAIRE_NEW, syncToolbarVisibility);
      this._bus.on(AppEvents.QUESTIONNAIRE_CLEARED, syncToolbarVisibility);
      const lform = elements.lform;
      if (lform) {
        lform.classList.toggle("preview--no-badges", !this._viewPrefs.showBadges);
        lform.classList.toggle("preview--no-linkid", !this._viewPrefs.showLinkId);
        lform.classList.toggle("preview--no-prefix", !this._viewPrefs.showPrefix);
        lform.classList.toggle("preview--no-hidden", !this._viewPrefs.showHiddenItems);
        lform.classList.toggle("patient-view", this._previewMode === "patient");
        lform.style.display = this._previewMode === "json" ? "none" : "";
      }
      if (elements.fhirJsonView) {
        elements.fhirJsonView.style.display = this._previewMode === "json" ? "" : "none";
      }
      this._asyncRender(++this._renderVersion);
    }
    async reinitForm({ silent = false } = {}) {
      if (!fhirpath) return;
      const progress = this._progress;
      this._calcCache = null;
      this._pendingCtx = null;
      this._lastVisibleSig = null;
      this._lastRepCounts = null;
      this._lastRepDataSz = null;
      if (!silent) progress.show("Building questionnaire response\u2026");
      await _yield();
      const base = { resourceType: "Questionnaire", item: [] };
      const qr = buildQR(base, this._answerStore.toValueMap());
      if (!silent) progress.show("Evaluating variables\u2026");
      await _yield();
      const envVars = buildVarEnv(this._questVariables, qr, fhirpath);
      if (!silent) progress.show("Applying initial values\u2026");
      await _yield();
      const initMap = this._answerStore.toValueMap();
      evalInitialExprNodes(this._tree, qr, fhirpath, initMap, envVars);
      this._answerStore.merge(initMap);
      this._preQR = qr;
      this._preEnvVars = envVars;
      if (!silent) progress.show("Refreshing preview\u2026");
      await _yield();
      this._asyncRender(++this._renderVersion);
    }
    // ── Private ─────────────────────────────────────────────────────────────────
    _onViewPrefChange(e) {
      this._viewPrefs[e.detail.key] = e.detail.value;
      const lform = this._els.lform;
      if (!lform) return;
      const cls = {
        showBadges: "preview--no-badges",
        showLinkId: "preview--no-linkid",
        showPrefix: "preview--no-prefix",
        showHiddenItems: "preview--no-hidden"
      }[e.detail.key];
      if (cls) lform.classList.toggle(cls, !e.detail.value);
      this._lastVisibleSig = null;
      this._lastRepCounts = null;
      this._asyncRender(++this._renderVersion);
    }
    _onPreviewModeChange(e) {
      this._previewMode = e.detail.mode;
      const lform = this._els.lform;
      lform?.classList.toggle("patient-view", this._previewMode === "patient");
      if (lform) {
        const isJson = this._previewMode === "json";
        lform.style.display = isJson ? "none" : "";
        if (this._els.fhirJsonView) this._els.fhirJsonView.style.display = isJson ? "" : "none";
      }
      this._lastVisibleSig = null;
      this._lastRepCounts = null;
      this._asyncRender(++this._renderVersion);
    }
    _reCalc() {
      if (fhirpath) {
        let qr, envVars;
        const base = buildFHIRObject(this._session.questDoc);
        if (this._preQR) {
          qr = this._preQR;
          envVars = this._preEnvVars;
          this._preQR = null;
          this._preEnvVars = null;
        } else {
          qr = buildQR(base, this._answerStore.toValueMap());
          envVars = buildVarEnv(this._questVariables, qr, fhirpath);
        }
        const calcMap = this._answerStore.toValueMap();
        if (!this._calcCache) {
          this._calcCache = buildCalcCache(this._tree, this._questVariables);
        }
        evalCalcNodes(this._tree, qr, fhirpath, calcMap, envVars, base, this._calcCache);
        this._answerStore.merge(calcMap);
        const env = { resource: qr, ...envVars };
        this._lastCtx.fp = fhirpath;
        this._lastCtx.qr = qr;
        this._lastCtx.env = env;
        this._bus.dispatch(AppEvents.FHIRPATH_CTX_UPDATED, { fp: fhirpath, qr, env });
        this._bus.dispatch(AppEvents.REFRESH_EXPR_ICONS);
        const ctx = { fp: fhirpath, qr, envVars };
        this._pendingCtx = ctx;
        return ctx;
      }
      return { fp: null, qr: null, envVars: {} };
    }
    _buildControl(node, iconEl, onAfterChange) {
      const _rc2 = this._rc;
      const isPatient = this._previewMode === "patient";
      const path = _rc2.instancePath && _rc2.instancePath.length ? _rc2.instancePath.slice() : void 0;
      const updateOwnIcon = () => {
        const ok = this._calcFormOk(node, path);
        if (iconEl) {
          iconEl.className = ok ? "icon-ok" : "icon-fail";
          iconEl.textContent = ok ? "\u2713" : "\u2717";
        }
        if (isPatient && node._previewEl) {
          node._previewEl.classList.toggle("lform-item--invalid", !ok);
        }
      };
      const onChange = () => {
        updateOwnIcon();
        if (onAfterChange) onAfterChange();
      };
      const reCalcAndRefresh = () => {
        this._reCalc();
        this._bus.dispatch(AppEvents.REFRESH_CALC_BADGES);
      };
      const ctx = {
        getValue: (id) => this._answerStore.get(id, path),
        setValue: (id, v) => this._bus.dispatch(AppEvents.ANSWER_SET, { id, value: v, path }),
        onChange,
        _reCalc: reCalcAndRefresh,
        bus: this._bus,
        fhirBase: this._fhirBase(),
        corsProxy: this._session.config?.corsProxy ?? serverConfig.get(CONFIG_KEYS.CORS_PROXY),
        _fpCtx: this._lastCtx
      };
      const el = node.buildControl(ctx);
      this._applyA11yLabels(el, node);
      if (el && typeof el.querySelectorAll === "function") {
        el.querySelectorAll(".ctrl-err").forEach((e) => {
          e.setAttribute("role", "alert");
          e.setAttribute("aria-live", "assertive");
        });
      }
      return el;
    }
    // Give every native form control an accessible name derived from the item
    // title when it lacks one (a11y: WCAG 4.1.2 / label). Controls that already
    // carry aria-label / aria-labelledby or sit inside a <label> are left as-is.
    _applyA11yLabels(controlEl, node) {
      if (!controlEl || typeof controlEl.querySelectorAll !== "function") return;
      const label = String(node.title || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!label) return;
      controlEl.querySelectorAll("input, select, textarea").forEach((f) => {
        if (f.type === "hidden") return;
        if (f.getAttribute("aria-label") || f.getAttribute("aria-labelledby")) return;
        if (f.id && controlEl.querySelector(`label[for="${f.id}"]`)) return;
        if (typeof f.closest === "function" && f.closest("label")) return;
        f.setAttribute("aria-label", label);
      });
    }
    async _asyncRender(version) {
      const _rc2 = this._rc;
      const progress = this._progress;
      const { search, statusBadge, languageMenu } = this._chrome;
      const ctx = this._pendingCtx || this._reCalc();
      this._pendingCtx = null;
      await _yield();
      if (version !== this._renderVersion) {
        progress.hide();
        return;
      }
      if (this._tree.length === 0) {
        const lform2 = this._els.lform;
        if (lform2) {
          lform2.innerHTML = "";
          const placeholder = document.createElement("div");
          placeholder.className = "preview-placeholder";
          placeholder.dataset.testid = "preview-placeholder";
          placeholder.innerHTML = '<div class="preview-placeholder-icon">\u{1F4CB}</div><div class="preview-placeholder-title">No questionnaire loaded</div><div class="preview-placeholder-hint">Use <strong>Questionnaires \u25BE</strong> in the toolbar to load a questionnaire:<br><strong>From file\u2026</strong> \u2014 upload a FHIR R4 or STU3 JSON file from your computer,<br><strong>From Library\u2026</strong> \u2014 pick one of the built-in samples,<br><strong>From Cloud\u2026</strong> \u2014 access your saved questionnaires (sign in required).<br>Or start from scratch: click <strong>+ Add Root Group</strong> in the left panel.</div>';
          lform2.appendChild(placeholder);
        }
        statusBadge.update({ visible: [], ctx: null });
        progress.hide();
        return;
      }
      const results = [];
      for (const node of this._tree) evaluateNode(node, ctx, results);
      const visible = results.filter((r) => r.visible);
      const resultMap = new Map(results.map((r) => [r.node.id, r]));
      const _cEnv = ctx.envVars || {};
      await _yield();
      if (version !== this._renderVersion) {
        progress.hide();
        return;
      }
      const lform = this._els.lform;
      if (!lform) {
        progress.hide();
        return;
      }
      const nodesSig = visible.map((r) => {
        const n = r.node;
        return `${n.id}|${n.title ?? ""}|${n.itemType ?? ""}|${n.mandatory ?? ""}|${n.logicWithParent ?? ""}|${n._prefix ?? ""}|${n._choiceOrientation ?? ""}|${n._previewCollapsed ? "c" : "e"}`;
      }).join("\0");
      const repNodes = results.filter((r) => r.visible && r.node.repeats);
      const curCounts = new Map(repNodes.map((r) => [r.node.id, this._answerStore.data[r.node.id]?.length ?? 1]));
      const dataSzOf = (id) => {
        const d = this._answerStore.data[id];
        return d ? JSON.stringify(d).length : 0;
      };
      const curDataSz = new Map(repNodes.map((r) => [r.node.id, dataSzOf(r.node.id)]));
      const repSig = repNodes.map((r) => `${curCounts.get(r.node.id)}:${curDataSz.get(r.node.id)}`).join(",");
      const visibleSig = nodesSig + "	" + repSig;
      const [prevNodesSig = "", prevRepSig = ""] = (this._lastVisibleSig ?? "	").split("	");
      const hasDOM = lform.children.length > 0;
      if (nodesSig === prevNodesSig && hasDOM) {
        _rc2.ctx = ctx;
        _rc2.resultMap = resultMap;
        _rc2.cEnv = _cEnv;
        _rc2.visible = visible;
        if (repSig === prevRepSig) {
          for (const r of results) {
            if (!r.visible) continue;
            const iconEl = r.node._iconEl;
            if (!iconEl || !document.contains(iconEl)) continue;
            const { displayOk } = r.node._evalCondition?.(r, _rc2) ?? { displayOk: true };
            iconEl.className = displayOk ? "icon-ok" : "icon-fail";
            iconEl.textContent = displayOk ? "\u2713" : "\u2717";
          }
          GroupNode.updateAll(_rc2);
          statusBadge.update({ visible, ctx });
          search.refresh();
          this._updateJsonView();
          progress.hide();
          this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
          return;
        }
        _rc2.previewMode = this._previewMode;
        _rc2.translations = this._rawFhir?.translations ?? {};
        _rc2.instancePath = [];
        for (const r of repNodes) {
          const curLen = curCounts.get(r.node.id);
          const prevLen = this._lastRepCounts?.get(r.node.id) ?? 1;
          const curSz = curDataSz.get(r.node.id);
          const prevSz = this._lastRepDataSz?.get(r.node.id) ?? 0;
          if (curLen === prevLen && curSz === prevSz) continue;
          const oldRow = r.node._previewEl;
          if (!oldRow || !document.contains(oldRow)) continue;
          const oldSibling = oldRow.nextElementSibling;
          const newFrag = document.createDocumentFragment();
          BaseNode.dispatch(r, newFrag, _rc2);
          oldRow.replaceWith(newFrag);
          if (oldSibling && (oldSibling.dataset.rgGroup === r.node.id || oldSibling.dataset.gtableId === r.node.id)) {
            oldSibling.remove();
          }
        }
        this._lastVisibleSig = visibleSig;
        this._lastRepCounts = curCounts;
        this._lastRepDataSz = curDataSz;
        for (const r of results) {
          if (!r.visible) continue;
          const iconEl = r.node._iconEl;
          if (!iconEl || !document.contains(iconEl)) continue;
          const { displayOk } = r.node._evalCondition?.(r, _rc2) ?? { displayOk: true };
          iconEl.className = displayOk ? "icon-ok" : "icon-fail";
          iconEl.textContent = displayOk ? "\u2713" : "\u2717";
        }
        GroupNode.updateAll(_rc2);
        statusBadge.update({ visible, ctx });
        search.refresh();
        this._updateJsonView();
        progress.hide();
        this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
        return;
      }
      this._lastVisibleSig = visibleSig;
      this._lastRepCounts = curCounts;
      const scrollPanel = lform.closest(".right-panel-body");
      const savedScroll = scrollPanel ? scrollPanel.scrollTop : 0;
      const activeEl = document.activeElement;
      let focusInfo = null;
      if (activeEl && lform.contains(activeEl)) {
        const row = activeEl.closest("[data-preview-id]");
        if (row) {
          const inputs = Array.from(row.querySelectorAll("input, textarea, select"));
          focusInfo = {
            previewId: row.dataset.previewId,
            inputIndex: inputs.indexOf(activeEl),
            selStart: activeEl.selectionStart,
            selEnd: activeEl.selectionEnd
          };
        }
      }
      lform.innerHTML = "";
      const groupIconMap = /* @__PURE__ */ new Map();
      _rc2.ctx = ctx;
      _rc2.resultMap = resultMap;
      _rc2.cEnv = _cEnv;
      _rc2.visible = visible;
      _rc2.groupIconMap = groupIconMap;
      _rc2.previewMode = this._previewMode;
      _rc2.translations = this._rawFhir?.translations ?? {};
      _rc2.instancePath = [];
      const frag = document.createDocumentFragment();
      for (const node of this._tree) {
        const res = resultMap.get(node.id);
        if (res) BaseNode.dispatch(res, frag, _rc2);
      }
      lform.appendChild(frag);
      if (scrollPanel && savedScroll) scrollPanel.scrollTop = savedScroll;
      if (focusInfo) {
        const row = lform.querySelector('[data-preview-id="' + CSS.escape(focusInfo.previewId) + '"]');
        if (row) {
          const inputs = Array.from(row.querySelectorAll("input, textarea, select"));
          const el = inputs[focusInfo.inputIndex];
          if (el) {
            el.focus();
            try {
              el.setSelectionRange(focusInfo.selStart, focusInfo.selEnd);
            } catch {
            }
          }
        }
      }
      GroupNode.updateAll(_rc2);
      statusBadge.update({ visible, ctx });
      search.refresh();
      this._updateJsonView();
      languageMenu.rebuild(this._rawFhir?.translations);
      progress.hide();
      this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
    }
    /** FHIR base URL — session config override (widget) → global serverConfig (app). */
    _fhirBase() {
      return this._session.config?.fhirBaseUrl ?? serverConfig.get(CONFIG_KEYS.FHIR_BASE);
    }
    /** Call $populate on the configured FHIR server and load the resulting answers. */
    async _populate(patientRef) {
      const progress = this._progress;
      const fhirBase = this._fhirBase();
      if (!fhirBase) {
        showError("No FHIR Base Server configured. Open Settings to set one.");
        return;
      }
      progress.show("Populating from server\u2026");
      try {
        const questJson = buildFHIRObject(this._session.questDoc);
        const qr = await populateFromServer(fhirBase, questJson, patientRef);
        const values = this._answerStore.toValueMap();
        const { loaded } = importQRAnswers(qr, values, this._tree);
        this._answerStore.replaceAll(values);
        this._bus.dispatch(AppEvents.REINIT_FORM);
        showInfo(`Pre-filled ${loaded} answer${loaded !== 1 ? "s" : ""} from server.`);
      } catch (err) {
        showError(err.message);
      } finally {
        progress.hide();
      }
    }
    _updateJsonView() {
      if (this._previewMode !== "json") return;
      if (!this._els.fhirJsonView) return;
      const q = buildFHIRObject(this._session.questDoc);
      this._els.fhirJsonView.innerHTML = highlightJson(JSON.stringify(q, null, 2));
      this._chrome.search.refresh();
    }
  };

  // js/ui/search.js
  var PreviewSearch = class {
    /**
     * @param {object}   opts
     * @param {object}   opts.els   { input, prevBtn, nextBtn, counter, lform, fhirJsonView, searchWrap }
     * @param {EventBus} [opts.bus] channel for PREVIEW_MODE_CHANGE (defaults to page bus)
     * @param {string}   [opts.previewMode] initial mode seed
     */
    constructor({ els, bus = defaultBus, previewMode = "preview" }) {
      this._el = els;
      this._bus = bus;
      this._matches = [];
      this._idx = -1;
      this._previewMode = previewMode;
      this._ac = new AbortController();
      this._bus.on(AppEvents.PREVIEW_MODE_CHANGE, (e) => {
        this._previewMode = e.detail.mode;
      }, { signal: this._ac.signal });
      this._wire();
    }
    _wire() {
      const el = this._el;
      const sig = { signal: this._ac.signal };
      el.input.addEventListener("input", () => this._onInput(), sig);
      el.input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault();
          this._navigate(1);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this._navigate(-1);
        }
        if (e.key === "Escape") {
          el.input.value = "";
          this._clear();
        }
      }, sig);
      el.nextBtn.addEventListener("click", () => this._navigate(1), sig);
      el.prevBtn.addEventListener("click", () => this._navigate(-1), sig);
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          if (el.searchWrap && el.searchWrap.style.display === "none") return;
          e.preventDefault();
          el.input.focus();
          el.input.select();
        }
      }, sig);
    }
    /** Remove the document-level (Ctrl+F) + bus listeners this search owns. */
    destroy() {
      this._ac.abort();
    }
    // Called by preview-form.js after every re-render so stale references update.
    refresh() {
      if (this._el.input.value.trim()) this._onInput();
    }
    // ── Dispatch by mode ────────────────────────────────────────────────────────
    _onInput() {
      const q = this._el.input.value.trim().toLowerCase();
      this._clearHighlights();
      if (!q) {
        this._clear();
        return;
      }
      if (this._previewMode === "json") this._onInputJson(q);
      else this._onInputRows(q);
    }
    // ── Rows mode (preview / patient) ───────────────────────────────────────────
    _onInputRows(q) {
      const rows = [...this._el.lform.querySelectorAll("[data-preview-id]")];
      this._matches = rows.filter((row) => row.textContent.toLowerCase().includes(q));
      if (this._matches.length === 0) {
        this._idx = -1;
        this._el.counter.textContent = "No results";
        this._el.counter.classList.add("search-counter--empty");
        this._el.input.classList.add("search-input--empty");
        return;
      }
      this._el.input.classList.remove("search-input--empty");
      this._el.counter.classList.remove("search-counter--empty");
      this._matches.forEach((m) => m.classList.add("search-match"));
      this._idx = 0;
      this._activate();
    }
    // ── JSON mode ───────────────────────────────────────────────────────────────
    _onInputJson(q) {
      const raw = this._el.fhirJsonView.textContent;
      const { html, count } = highlightJsonWithSearch(raw, q);
      this._el.fhirJsonView.innerHTML = html;
      if (count === 0) {
        this._idx = -1;
        this._el.counter.textContent = "No results";
        this._el.counter.classList.add("search-counter--empty");
        this._el.input.classList.add("search-input--empty");
        return;
      }
      this._el.input.classList.remove("search-input--empty");
      this._el.counter.classList.remove("search-counter--empty");
      this._matches = [...this._el.fhirJsonView.querySelectorAll("mark.search-match")];
      this._idx = 0;
      this._activateJson();
    }
    // ── Navigation ──────────────────────────────────────────────────────────────
    _navigate(dir) {
      if (this._matches.length === 0) return;
      if (this._idx >= 0 && this._idx < this._matches.length) {
        this._matches[this._idx].classList.remove("search-match--active");
      }
      this._idx = (this._idx + dir + this._matches.length) % this._matches.length;
      if (this._previewMode === "json") this._activateJson();
      else this._activate();
    }
    _activate() {
      const el = this._matches[this._idx];
      el.classList.add("search-match--active");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      this._el.counter.textContent = this._idx + 1 + " / " + this._matches.length;
      this._el.counter.classList.remove("search-counter--empty");
    }
    _activateJson() {
      this._matches.forEach((m, i) => m.classList.toggle("search-match--active", i === this._idx));
      this._matches[this._idx].scrollIntoView({ behavior: "smooth", block: "center" });
      this._el.counter.textContent = this._idx + 1 + " / " + this._matches.length;
      this._el.counter.classList.remove("search-counter--empty");
    }
    // ── Clear ───────────────────────────────────────────────────────────────────
    _clearHighlights() {
      if (this._previewMode === "json" && this._el.fhirJsonView.querySelector("mark.search-match")) {
        const raw = this._el.fhirJsonView.textContent;
        this._el.fhirJsonView.innerHTML = highlightJson(raw);
      } else {
        this._matches.forEach((m) => {
          m.classList.remove("search-match");
          m.classList.remove("search-match--active");
        });
      }
      this._matches = [];
      this._idx = -1;
    }
    _clear() {
      this._clearHighlights();
      this._el.counter.textContent = "";
      this._el.counter.classList.remove("search-counter--empty");
      this._el.input.classList.remove("search-input--empty");
    }
  };
  var _appInstance = null;
  function init() {
    const els = {
      input: document.querySelector('[data-mount="search-input"]'),
      prevBtn: document.querySelector('[data-mount="search-prev-btn"]'),
      nextBtn: document.querySelector('[data-mount="search-next-btn"]'),
      counter: document.querySelector('[data-mount="search-counter"]'),
      lform: document.querySelector('[data-mount="preview-lform"]'),
      fhirJsonView: document.querySelector('[data-mount="fhir-json-view"]'),
      searchWrap: document.querySelector('[data-mount="search-wrap"]')
    };
    if (!els.input) return;
    _appInstance = new PreviewSearch({ els, bus: defaultBus });
  }
  if (typeof document !== "undefined") init();

  // js/ui/status-badge.js
  var StatusBadge = class {
    /**
     * @param {object}   opts
     * @param {object}   opts.els       { btn, dropdown, wrap }
     * @param {EventBus} [opts.bus]     channel for BUILDER_NAVIGATE (defaults to page bus)
     * @param {Function} [opts.getStore] returns the answerStore for the surface
     */
    constructor({ els, bus = defaultBus, getStore } = {}) {
      this._btn = els.btn;
      this._dropdown = els.dropdown;
      this._wrap = els.wrap;
      this._bus = bus;
      this._getStore = getStore || (() => EventState.get(AppEvents.APP_CONTEXT_READY)?.answerStore);
      this._open = false;
      this._ac = new AbortController();
      this._btn.setAttribute("aria-live", "polite");
      this._btn.setAttribute("aria-atomic", "true");
      this._btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._open = !this._open;
        this._dropdown.style.display = this._open ? "block" : "none";
      }, { signal: this._ac.signal });
      document.addEventListener("click", () => {
        if (this._open) this._close();
      }, { signal: this._ac.signal });
    }
    /** Remove the document-level (outside-click) listener this badge owns. */
    destroy() {
      this._ac.abort();
    }
    update({ visible, ctx }) {
      if (!this._btn) return;
      const store = this._getStore();
      if (!store) return;
      const anyVisible = visible.length > 0;
      const fp = ctx?.fp ?? null;
      const qr = ctx?.qr ?? null;
      const cEnv = ctx?.envVars ?? {};
      const activeItems = visible.filter((r) => !r.disabled && !r.hidden && r.node.type === "item");
      const mandatoryItems = activeItems.filter(
        (r) => isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)
      );
      const hasMandatory = mandatoryItems.length > 0;
      const calcItems = activeItems.filter(
        (r) => r.node._calculatedExpr && r.node._readOnly && r.node.itemType === "checkbox"
      );
      const hasCalc = calcItems.length > 0;
      const calcAllOk = calcItems.every((r) => store?.get(r.node.id) === true);
      const constraintItems = activeItems.filter((r) => r.node.constraint?.length);
      const hasConstraints = constraintItems.length > 0;
      const constraintsAllOk = constraintItems.every((r) => evalConstraints(r.node, fp, qr, cEnv));
      const rangeItems = activeItems.filter(
        (r) => !isMandatory(r.node) && (r.node._minValue !== void 0 || r.node._maxValue !== void 0)
      );
      const hasRange = rangeItems.length > 0;
      const rangeAllOk = rangeItems.every((r) => calcFormOk(r.node, store));
      const hasCriteria = hasMandatory || hasCalc || hasConstraints || hasRange;
      if (!anyVisible || !hasCriteria) {
        this._wrap.style.display = "none";
        this._close();
        return;
      }
      const formItemsOk = visible.filter((r) => !r.disabled && !r.hidden).every((res) => {
        if (res.node.type === "item") return res.ok && calcFormOk(res.node, store);
        return res.ok;
      });
      const finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) && (!hasConstraints || constraintsAllOk) && (!hasRange || rangeAllOk) && hasCriteria;
      const failingItems = [
        ...mandatoryItems.filter((r) => !r.ok || !calcFormOk(r.node, store)).map((r) => ({ title: r.node.title, id: r.node.id })),
        ...calcItems.filter((r) => store?.get(r.node.id) !== true).map((r) => ({ title: r.node.title, id: r.node.id })),
        ...constraintItems.filter((r) => !evalConstraints(r.node, fp, qr, cEnv)).map((r) => ({ title: r.node.title, id: r.node.id })),
        ...rangeItems.filter((r) => !calcFormOk(r.node, store)).map((r) => ({ title: r.node.title, id: r.node.id }))
      ];
      this._wrap.style.display = "inline-flex";
      if (finalOk) {
        this._btn.className = "status-badge status-badge--pass";
        this._btn.textContent = "\u2713 PASS";
      } else {
        const n = failingItems.length;
        this._btn.className = "status-badge status-badge--fail";
        this._btn.textContent = "\u2717 FAIL \xB7 " + n + " issue" + (n !== 1 ? "s" : "");
      }
      this._renderList(failingItems);
    }
    _close() {
      this._open = false;
      if (this._dropdown) this._dropdown.style.display = "none";
    }
    _renderList(items) {
      if (!this._dropdown) return;
      this._dropdown.innerHTML = "";
      if (items.length === 0) {
        const msg = document.createElement("div");
        msg.className = "status-dropdown-msg";
        msg.textContent = "All criteria met";
        this._dropdown.appendChild(msg);
        return;
      }
      const hdr = document.createElement("div");
      hdr.className = "status-dropdown-header";
      hdr.textContent = items.length + " issue" + (items.length !== 1 ? "s" : "") + " to resolve";
      this._dropdown.appendChild(hdr);
      items.forEach((item, i) => {
        const row = document.createElement("div");
        row.className = "status-dropdown-row";
        row.dataset.tipTitle = "Click to navigate";
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          this._close();
          this._bus.dispatch(AppEvents.BUILDER_NAVIGATE, { id: item.id });
        });
        const num = document.createElement("span");
        num.className = "status-dropdown-num";
        num.textContent = i + 1 + ".";
        row.appendChild(num);
        const label = document.createElement("span");
        label.className = "status-dropdown-label";
        label.textContent = item.title;
        row.appendChild(label);
        const arrow = document.createElement("span");
        arrow.className = "status-dropdown-arrow";
        arrow.textContent = "\u2197";
        row.appendChild(arrow);
        this._dropdown.appendChild(row);
      });
    }
  };
  var _appInstance2 = null;
  function init2() {
    const els = {
      btn: document.querySelector('[data-mount="status-badge-btn"]'),
      dropdown: document.querySelector('[data-mount="status-dropdown"]'),
      wrap: document.querySelector('[data-mount="status-badge-wrap"]')
    };
    if (!els.btn) return;
    _appInstance2 = new StatusBadge({ els, bus: defaultBus });
  }
  if (typeof document !== "undefined") init2();

  // js/storage/storage.js
  var _adapter = null;
  function _check() {
    if (!_adapter) throw new Error("[storage] No adapter registered. Call storage.register() at app startup.");
  }
  async function getItem(key) {
    _check();
    return _adapter.getItem(key);
  }
  async function setItem(key, value) {
    _check();
    return _adapter.setItem(key, value);
  }

  // js/ui/tooltip.js
  var LS_KEY = "tooltips-enabled";
  var _enabled = true;
  var _inited = false;
  var _el = null;
  function setEnabled(val) {
    _enabled = !!val;
    setItem(LS_KEY, _enabled ? "true" : "false");
    if (!_enabled) _hide();
    const badge = document.getElementById("tooltipsOffBadge");
    if (badge) badge.style.display = _enabled ? "none" : "";
  }
  function _getEl() {
    if (!_el) {
      _el = document.createElement("div");
      _el.className = "rich-tooltip";
      _el.setAttribute("aria-hidden", "true");
      document.body.appendChild(_el);
    }
    return _el;
  }
  function _build(target) {
    const { tipTitle: title, tipBody: body, tipFhir: fhir, tipSpec: spec } = target.dataset;
    if (!title && !body) return false;
    const tip = _getEl();
    tip.innerHTML = "";
    if (title) {
      const h = document.createElement("div");
      h.className = "rich-tooltip__title";
      h.textContent = title;
      tip.appendChild(h);
    }
    if (body) {
      const b = document.createElement("div");
      b.className = "rich-tooltip__body";
      b.textContent = body;
      tip.appendChild(b);
    }
    if (fhir) {
      const row = document.createElement("div");
      row.className = "rich-tooltip__fhir";
      const badge = document.createElement("span");
      badge.className = "rich-tooltip__fhir-badge";
      badge.textContent = "FHIR";
      row.appendChild(badge);
      const code = document.createElement("code");
      code.textContent = fhir;
      row.appendChild(code);
      if (spec) {
        const s = document.createElement("span");
        s.className = "rich-tooltip__spec";
        s.textContent = spec;
        row.appendChild(s);
      }
      tip.appendChild(row);
    }
    return true;
  }
  function _position(target) {
    const tip = _getEl();
    const rect = target.getBoundingClientRect();
    const tipW = tip.offsetWidth || 260;
    const tipH = tip.offsetHeight || 100;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < tipH + 12;
    tip.classList.toggle("rich-tooltip--above", above);
    const top = above ? rect.top - tipH - 10 : rect.bottom + 10;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function _show(target) {
    if (!_enabled) return;
    if (!_build(target)) return;
    _getEl().style.display = "block";
    requestAnimationFrame(() => _position(target));
  }
  function _hide() {
    if (_el) _el.style.display = "none";
  }
  async function init3() {
    if (_inited) return;
    _inited = true;
    try {
      _enabled = await getItem(LS_KEY) !== "false";
    } catch {
      _enabled = true;
    }
    const badge = document.getElementById("tooltipsOffBadge");
    if (badge) badge.style.display = _enabled ? "none" : "";
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-tip-title],[data-tip-body]");
      if (t) _show(t);
    });
    document.addEventListener("mouseout", (e) => {
      const t = e.target.closest("[data-tip-title],[data-tip-body]");
      if (t) _hide();
    });
    window.addEventListener("scroll", _hide, true);
    window.addEventListener("resize", _hide);
    document.dispatchEvent(new CustomEvent(AppEvents.TIPS_INIT_DONE, { detail: { enabled: _enabled } }));
  }
  if (typeof document !== "undefined") {
    document.addEventListener(AppEvents.TIPS_TOGGLED, (e) => setEnabled(e.detail.enabled));
  }

  // js/renderer/index.js
  var NOOP_CHROME = Object.freeze({
    search: Object.freeze({ refresh() {
    } }),
    statusBadge: Object.freeze({ update() {
    } }),
    languageMenu: Object.freeze({ rebuild() {
    } })
  });
  var Emitter = class {
    constructor() {
      this._map = /* @__PURE__ */ new Map();
    }
    on(type, cb) {
      (this._map.get(type) ?? this._map.set(type, /* @__PURE__ */ new Set()).get(type)).add(cb);
      return this;
    }
    off(type, cb) {
      this._map.get(type)?.delete(cb);
      return this;
    }
    emit(type, detail) {
      for (const cb of this._map.get(type) ?? []) cb(detail);
    }
  };
  var QuestionnaireRenderer = class {
    constructor(mountEl, { questionnaire = null, response = null, config = {} } = {}) {
      this.mountEl = mountEl;
      this._config = config;
      this._emitter = new Emitter();
      this._session = createSession(config);
      const bus = this._session.bus;
      const progress = config.onProgress ? { show: (m) => config.onProgress(m), hide: () => config.onProgress(null) } : { show() {
      }, hide() {
      } };
      mountEl.innerHTML = "";
      this._lformEl = document.createElement("div");
      this._lformEl.className = "preview-card";
      this._jsonEl = document.createElement("pre");
      this._jsonEl.className = "fhir-json-view";
      this._jsonEl.style.display = "none";
      if (config.tooltips) init3();
      const chrome = this._buildChrome(config, bus);
      this._chrome = chrome;
      mountEl.append(this._lformEl, this._jsonEl);
      const rc = createRenderCtx();
      rc.showNavBtn = !!config.navButton;
      rc.showExplain = !!config.explain;
      this._renderer = new PreviewForm({
        session: this._session,
        rc,
        chrome,
        progress,
        mountEl: this._lformEl,
        jsonEl: this._jsonEl,
        previewMode: config.previewMode,
        viewPrefs: config.viewPrefs
      });
      this._offs = [
        bus.on(AppEvents.RESPONSE_CHANGED, () => this._emitter.emit("response-changed", this.getResponse())),
        bus.on(AppEvents.PREVIEW_RENDER_DONE, () => this._emitter.emit("render")),
        bus.on(AppEvents.LANGUAGE_CHANGED, (e) => this._emitter.emit("language-changed", e.detail?.lang ?? ""))
      ];
      this._renderer.mount();
      if (questionnaire) this._loadQuestionnaire(questionnaire);
      if (response) this.setResponse(response);
      if (config.language) this.setLanguage(config.language);
      Promise.resolve().then(() => this._emitter.emit("ready"));
    }
    _loadQuestionnaire(questionnaire) {
      importFHIR(questionnaire, { questDoc: this._session.questDoc, bus: this._session.bus });
    }
    // Opt-in preview chrome (config.search / config.validation). Builds the toolbar
    // DOM inside the host mount and wires per-instance PreviewSearch / StatusBadge
    // against this widget's own session bus + answer store.
    _buildChrome(config, bus) {
      const wantSearch = !!config.search;
      const wantValidation = !!config.validation;
      if (!wantSearch && !wantValidation) return NOOP_CHROME;
      const toolbar = document.createElement("div");
      toolbar.className = "fhir-toolbar";
      let search = NOOP_CHROME.search;
      if (wantSearch) {
        const searchWrap = document.createElement("div");
        searchWrap.className = "search-wrap";
        const input = document.createElement("input");
        input.type = "search";
        input.className = "search-input";
        input.placeholder = "\u{1F50D} Search\u2026";
        input.autocomplete = "off";
        input.setAttribute("data-testid", "preview-search-input");
        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "search-nav-btn";
        prevBtn.textContent = "\u2191";
        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "search-nav-btn";
        nextBtn.textContent = "\u2193";
        const counter = document.createElement("span");
        counter.className = "search-counter";
        searchWrap.append(input, prevBtn, nextBtn, counter);
        toolbar.appendChild(searchWrap);
        search = new PreviewSearch({
          els: { input, prevBtn, nextBtn, counter, lform: this._lformEl, fhirJsonView: this._jsonEl, searchWrap },
          bus,
          previewMode: config.previewMode
        });
      }
      const sep = document.createElement("span");
      sep.className = "fhir-toolbar-sep";
      toolbar.appendChild(sep);
      let statusBadge = NOOP_CHROME.statusBadge;
      if (wantValidation) {
        const wrap = document.createElement("span");
        wrap.className = "status-badge-wrap";
        wrap.style.display = "none";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "status-badge";
        btn.setAttribute("data-testid", "status-badge-btn");
        const dropdown = document.createElement("div");
        dropdown.className = "status-dropdown";
        dropdown.style.display = "none";
        wrap.append(btn, dropdown);
        toolbar.appendChild(wrap);
        statusBadge = new StatusBadge({
          els: { btn, dropdown, wrap },
          bus,
          getStore: () => this._session.answerStore
        });
      }
      this.mountEl.appendChild(toolbar);
      return { search, statusBadge, languageMenu: NOOP_CHROME.languageMenu };
    }
    on(type, cb) {
      this._emitter.on(type, cb);
      return this;
    }
    off(type, cb) {
      this._emitter.off(type, cb);
      return this;
    }
    /** Current answers as a FHIR QuestionnaireResponse. */
    getResponse() {
      const base = this._session.questDoc.rawFhir || { resourceType: "Questionnaire", item: [] };
      return buildQR(base, this._session.answerStore.toValueMap());
    }
    /** Load answers from a QuestionnaireResponse and re-render. */
    setResponse(qr) {
      const values = this._session.answerStore.toValueMap();
      importQRAnswers(qr, values, this._session.questDoc.tree);
      this._session.answerStore.replaceAll(values);
      this._session.bus.dispatch(AppEvents.QR_LOADED, {});
      this._session.bus.dispatch(AppEvents.RESPONSE_CHANGED);
    }
    /** Switch the active preview language ('' = source). */
    setLanguage(lang) {
      this._session.bus.dispatch(AppEvents.LANGUAGE_CHANGED, { lang });
    }
    /** Update runtime-changeable config. Only `language` takes effect after
     *  construction; chrome flags (search/validation/explain/tooltips/navButton)
     *  are construction-time and ignored here. */
    setConfig(partial) {
      Object.assign(this._config, partial);
      if (partial.language !== void 0) this.setLanguage(partial.language);
    }
    destroy() {
      this._offs?.forEach((off) => off());
      this._offs = null;
      const walk2 = (nodes) => {
        for (const n of nodes || []) {
          n.destroy?.();
          walk2(n.children);
        }
      };
      walk2(this._session?.questDoc?.tree);
      this._chrome?.search?.destroy?.();
      this._chrome?.statusBadge?.destroy?.();
      this._renderer?.destroy?.();
      if (this.mountEl) this.mountEl.innerHTML = "";
      this._renderer = null;
      this._session = null;
      this._chrome = null;
      this._emitter = null;
    }
  };
  return __toCommonJS(index_exports);
})();
