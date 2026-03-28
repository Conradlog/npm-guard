const { loadConfig } = require("./config");
const { RegistryFetcher } = require("./registry");
const { loadRules } = require("../rules");
const { PluginLoader } = require("../plugins/loader");
const { getFormatter } = require("../formatters");

// Script lifecycle che possono eseguire codice durante npm install
const LIFECYCLE_HOOKS = [
  "preinstall",
  "install",
  "postinstall",
  "preuninstall",
  "postuninstall",
  "prepublish",
  "preprepare",
  "prepare",
  "postprepare",
];

// Pattern sicuri built-in (build tools, compilazione nativa)
const BUILTIN_SAFE_PATTERNS = [
  /\bnode-gyp\b/,
  /\bnode-pre-gyp\b/,
  /\bprebuild-install\b/,
  /\bnapi\b/,
  /\btsc\b/,
  /\btypescript\b/,
  /\besbuild\b/,
  /\brollup\b/,
  /\bwebpack\b/,
  /\bhusky\b/,
  /\bpatch-package\b/,
];

/**
 * Motore principale di npm-guard.
 * Orchestrator che coordina config, regole, plugin, scansione e output.
 *
 * @example
 * const engine = new NpmGuardEngine({ format: "json" });
 * const result = engine.scanPackage("express");
 * console.log(engine.formatResults([result]));
 */
class NpmGuardEngine {
  /**
   * @param {object} configOverrides - Override alla configurazione
   * @param {string} projectPath - Percorso del progetto (per caricare config locale)
   */
  constructor(configOverrides = {}, projectPath) {
    this.config = loadConfig(projectPath);

    // Applica override
    for (const [key, value] of Object.entries(configOverrides)) {
      if (value !== undefined) this.config[key] = value;
    }

    this.registry = new RegistryFetcher();
    this.pluginLoader = new PluginLoader();

    // Carica plugin
    if (this.config.plugins && this.config.plugins.length > 0) {
      this.pluginLoader.load(this.config.plugins, projectPath || process.cwd());
    }

    // Carica regole (built-in + plugin)
    this.rules = [
      ...loadRules(this.config),
      ...this.pluginLoader.customRules,
    ];

    // Pattern sicuri (built-in + config + plugin)
    this.safePatterns = [
      ...BUILTIN_SAFE_PATTERNS,
      ...this.config.safePatterns.map((s) => new RegExp(s)),
      ...this.pluginLoader.customSafePatterns,
    ];
  }

  /**
   * Analizza gli script lifecycle di un pacchetto
   * @param {object} scripts - Oggetto scripts dal package.json
   * @param {string} packageName - Nome del pacchetto (per context)
   * @returns {Array}
   */
  analyzeScripts(scripts, packageName) {
    const findings = [];

    for (const hook of LIFECYCLE_HOOKS) {
      const cmd = scripts[hook];
      if (!cmd) continue;

      const isSafe = this.safePatterns.some((p) => p.test(cmd));

      const matches = [];
      for (const rule of this.rules) {
        const ruleMatches = rule.analyze(cmd, { hook, packageName, scripts });
        matches.push(...ruleMatches);
      }

      findings.push({
        hook,
        command: cmd,
        isSafe,
        matches,
        hasSuspicious: matches.length > 0 && !isSafe,
      });
    }

    return findings;
  }

  /**
   * Calcola il punteggio di rischio complessivo
   * @param {Array} findings
   * @returns {{ score: number, level: string, color: string }}
   */
  calculateRisk(findings) {
    const weights = this.config.severityWeights;
    const thresholds = this.config.thresholds;
    let score = 0;

    for (const f of findings) {
      if (f.isSafe) continue;
      for (const m of f.matches) {
        score += weights[m.severity] || 1;
      }
    }

    if (score === 0) return { score: 0, level: "SICURO", color: "green" };
    if (score <= thresholds.low) return { score, level: "BASSO", color: "yellow" };
    if (score <= thresholds.medium) return { score, level: "MEDIO", color: "yellow" };
    if (score <= thresholds.high) return { score, level: "ALTO", color: "red" };
    return { score, level: "CRITICO", color: "red" };
  }

  /**
   * Scansiona un pacchetto dal registry npm
   * @param {string} packageName
   * @returns {object}
   */
  scanPackage(packageName) {
    // Controlla se il pacchetto e' nella lista ignore
    const baseName = packageName.replace(/@[\^~]?[\d.]+.*$/, "");
    if (this.config.ignore.includes(baseName)) {
      return {
        name: baseName,
        version: "ignored",
        scripts: {},
        findings: [],
        risk: { score: 0, level: "SICURO", color: "green" },
        hasLifecycleScripts: false,
        ignored: true,
      };
    }

    const manifest = this.registry.fetch(packageName);
    if (!manifest) {
      return { error: `Impossibile trovare il pacchetto: ${packageName}` };
    }

    const scripts = manifest.scripts || {};
    const findings = this.analyzeScripts(scripts, manifest.name);
    const risk = this.calculateRisk(findings);

    return {
      name: manifest.name,
      version: manifest.version || manifest["dist-tags"]?.latest,
      scripts,
      findings,
      risk,
      hasLifecycleScripts: findings.length > 0,
    };
  }

  /**
   * Scansiona un pacchetto installato localmente
   * @param {string} projectPath
   * @param {string} packageName
   * @returns {object}
   */
  scanInstalledPackage(projectPath, packageName) {
    const manifest = this.registry.fetchLocal(projectPath, packageName);
    if (!manifest) {
      return { error: `Pacchetto non trovato in node_modules: ${packageName}` };
    }

    const scripts = manifest.scripts || {};
    const findings = this.analyzeScripts(scripts, manifest.name);
    const risk = this.calculateRisk(findings);

    return {
      name: manifest.name,
      version: manifest.version,
      scripts,
      findings,
      risk,
      hasLifecycleScripts: findings.length > 0,
      source: "node_modules",
    };
  }

  /**
   * Scansiona tutte le dipendenze di un progetto
   * @param {string} projectPath
   * @param {function} onProgress - Callback (current, total, name)
   * @returns {Array}
   */
  scanProject(projectPath, onProgress) {
    const pkg = this.registry.fetchProjectPackage(projectPath);
    if (!pkg) {
      return { error: "Nessun package.json trovato in questa directory" };
    }

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const entries = Object.entries(allDeps);
    const results = [];

    for (let i = 0; i < entries.length; i++) {
      const [name, version] = entries[i];
      if (onProgress) onProgress(i, entries.length, name);

      const result = this.scanPackage(`${name}@${version}`);
      if (!result.error) results.push(result);
    }

    if (onProgress) onProgress(entries.length, entries.length, "Completato");
    return results;
  }

  /**
   * Formatta i risultati usando il formatter configurato
   * @param {Array} results
   * @param {object} options
   * @returns {string}
   */
  formatResults(results, options = {}) {
    const formatName = options.format || this.config.format;
    const allFormatters = this.pluginLoader.customFormatters;
    const formatter = getFormatter(formatName, allFormatters);
    return formatter.format(results, options);
  }

  /**
   * Verifica se i risultati devono causare un exit code di errore
   * @param {Array} results
   * @returns {boolean}
   */
  shouldFail(results) {
    const levels = ["SICURO", "BASSO", "MEDIO", "ALTO", "CRITICO"];
    const failOnMap = {
      low: "BASSO", medium: "MEDIO", high: "ALTO", critical: "CRITICO",
      basso: "BASSO", medio: "MEDIO", alto: "ALTO", critico: "CRITICO",
    };
    const mapped = failOnMap[this.config.failOn.toLowerCase()] || this.config.failOn.toUpperCase();
    const failIdx = levels.indexOf(mapped);

    return results.some((r) => {
      if (!r.risk) return false;
      return levels.indexOf(r.risk.level) >= failIdx;
    });
  }
}

module.exports = { NpmGuardEngine, LIFECYCLE_HOOKS, BUILTIN_SAFE_PATTERNS };
