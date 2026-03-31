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
   * Scansione profonda: analizza un pacchetto E tutte le sue dipendenze transitive.
   * Per ogni dipendenza esegue l'analisi degli script lifecycle.
   * Inoltre rileva:
   * - Dipendenze nuove rispetto alla versione precedente (dependency injection)
   * - Pacchetti pubblicati di recente (< 7 giorni)
   * - Nomi sospetti (typosquatting)
   *
   * @param {string} packageName - Nome del pacchetto (opzionalmente con @version)
   * @param {object} options - { maxDepth: 3, onProgress: fn }
   * @returns {object} { root: result, dependencies: [results], dependencyAnalysis: {...}, aggregatedRisk }
   */
  scanPackageDeep(packageName, options = {}) {
    const { maxDepth = 3, onProgress } = options;

    // 1. Scansiona il pacchetto root
    const rootResult = this.scanPackage(packageName);
    if (rootResult.error) {
      return { root: rootResult, dependencies: [], dependencyAnalysis: null, aggregatedRisk: null };
    }

    if (onProgress) onProgress("root", rootResult.name);

    // 2. Recupera l'albero delle dipendenze e scansiona ciascuna
    const depTree = this.registry.fetchDependencyTree(packageName, maxDepth);
    const depResults = [];

    for (let i = 0; i < depTree.length; i++) {
      const dep = depTree[i];
      if (onProgress) onProgress("dep", dep.name, i, depTree.length);

      const scripts = dep.scripts || {};
      const findings = this.analyzeScripts(scripts, dep.name);
      const risk = this.calculateRisk(findings);

      depResults.push({
        name: dep.name,
        version: dep.version,
        scripts,
        findings,
        risk,
        hasLifecycleScripts: findings.length > 0,
        depth: dep.depth,
        source: "dependency-tree",
      });
    }

    // 3. Analisi dipendenze: confronto con versione precedente
    const dependencyAnalysis = this._analyzeDependencyChanges(rootResult.name, rootResult.version);

    // 4. Esegui la regola dependency-risk con i metadati raccolti
    const depRiskFindings = this._runDependencyRiskRule(dependencyAnalysis);

    // 5. Calcola rischio aggregato (root + dipendenze + dependency-risk)
    const allResults = [rootResult, ...depResults];
    const maxRisk = this._aggregateRisk(allResults, depRiskFindings);

    return {
      root: rootResult,
      dependencies: depResults,
      dependencyAnalysis,
      depRiskFindings,
      aggregatedRisk: maxRisk,
    };
  }

  /**
   * Confronta le dipendenze della versione corrente con quelle della precedente
   * @private
   */
  _analyzeDependencyChanges(packageName, currentVersion) {
    const analysis = {
      newDependencies: [],
      removedDependencies: [],
      previousVersion: null,
      packageAges: {},
    };

    // Recupera dipendenze della versione precedente
    const prevData = this.registry.fetchPreviousVersionDeps(packageName, currentVersion);
    if (prevData) {
      analysis.previousVersion = prevData.version;
      const prevDeps = prevData.dependencies || {};

      // Recupera dipendenze correnti
      const currentData = this.registry.fetchDependencies(packageName);
      const currentDeps = (currentData && currentData.dependencies) || {};

      // Trova dipendenze nuove
      for (const [name, range] of Object.entries(currentDeps)) {
        if (!(name in prevDeps)) {
          analysis.newDependencies.push({ name, range });
        }
      }

      // Trova dipendenze rimosse
      for (const [name, range] of Object.entries(prevDeps)) {
        if (!(name in currentDeps)) {
          analysis.removedDependencies.push({ name, range });
        }
      }
    }

    // Controlla eta' delle dipendenze nuove
    for (const dep of analysis.newDependencies) {
      const timestamps = this.registry.fetchPackageTimestamps(dep.name);
      if (timestamps) {
        const created = timestamps.created ? new Date(timestamps.created) : null;
        const now = new Date();
        const ageInDays = created ? (now - created) / (1000 * 60 * 60 * 24) : null;

        analysis.packageAges[dep.name] = {
          ageInDays,
          publishedAt: created ? created.toISOString().split("T")[0] : "sconosciuta",
          created: timestamps.created || null,
        };
      }
    }

    return analysis;
  }

  /**
   * Esegue la regola dependency-risk con il context popolato
   * @private
   */
  _runDependencyRiskRule(dependencyAnalysis) {
    if (!dependencyAnalysis) return [];

    const depRiskRule = this.rules.find((r) => r.name === "dependency-risk");
    if (!depRiskRule) return [];

    return depRiskRule.analyze("", { dependencyAnalysis });
  }

  /**
   * Calcola il rischio aggregato massimo tra tutti i risultati
   * @private
   */
  _aggregateRisk(allResults, depRiskFindings = []) {
    const levels = ["SICURO", "BASSO", "MEDIO", "ALTO", "CRITICO"];
    let maxLevel = 0;
    let totalScore = 0;

    for (const r of allResults) {
      if (r.risk) {
        const idx = levels.indexOf(r.risk.level);
        if (idx > maxLevel) maxLevel = idx;
        totalScore = Math.max(totalScore, r.risk.score);
      }
    }

    // Aggiungi il peso dei finding dependency-risk
    if (depRiskFindings.length > 0) {
      const weights = this.config.severityWeights;
      let depScore = 0;
      for (const f of depRiskFindings) {
        depScore += weights[f.severity] || 1;
      }
      totalScore = Math.max(totalScore, depScore);

      // Ricalcola il livello in base allo score
      const thresholds = this.config.thresholds;
      if (depScore > thresholds.high) maxLevel = Math.max(maxLevel, 4);
      else if (depScore > thresholds.medium) maxLevel = Math.max(maxLevel, 3);
      else if (depScore > thresholds.low) maxLevel = Math.max(maxLevel, 2);
      else if (depScore > 0) maxLevel = Math.max(maxLevel, 1);
    }

    const level = levels[maxLevel];
    const colorMap = { SICURO: "green", BASSO: "yellow", MEDIO: "yellow", ALTO: "red", CRITICO: "red" };

    return { score: totalScore, level, color: colorMap[level] };
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
   * Formatta i risultati della scansione profonda
   * @param {Array} deepResults - Array di risultati da scanPackageDeep()
   * @param {object} options
   * @returns {string}
   */
  formatDeepResults(deepResults, options = {}) {
    const formatName = options.format || this.config.format;

    if (formatName === "json") {
      return this._formatDeepJson(deepResults);
    }
    if (formatName === "html") {
      return this._formatDeepHtml(deepResults);
    }

    return this._formatDeepText(deepResults);
  }

  /** @private */
  _formatDeepJson(deepResults) {
    const output = {
      timestamp: new Date().toISOString(),
      mode: "deep",
      summary: {
        packagesAnalyzed: 0,
        dependenciesAnalyzed: 0,
        newDependenciesFound: 0,
        youngPackagesFound: 0,
        maxRiskLevel: "SICURO",
      },
      results: [],
    };

    const levels = ["SICURO", "BASSO", "MEDIO", "ALTO", "CRITICO"];
    let maxLevel = 0;

    for (const dr of deepResults) {
      output.summary.packagesAnalyzed++;
      output.summary.dependenciesAnalyzed += dr.dependencies.length;

      if (dr.dependencyAnalysis) {
        output.summary.newDependenciesFound += dr.dependencyAnalysis.newDependencies.length;
        const youngCount = Object.values(dr.dependencyAnalysis.packageAges)
          .filter((a) => a.ageInDays !== null && a.ageInDays < 7).length;
        output.summary.youngPackagesFound += youngCount;
      }

      if (dr.aggregatedRisk) {
        const idx = levels.indexOf(dr.aggregatedRisk.level);
        if (idx > maxLevel) maxLevel = idx;
      }

      const suspiciousDeps = dr.dependencies.filter((d) => d.risk && d.risk.score > 0);

      output.results.push({
        package: {
          name: dr.root.name,
          version: dr.root.version,
          risk: dr.root.risk,
          findings: dr.root.findings,
        },
        dependencyAnalysis: dr.dependencyAnalysis
          ? {
              previousVersion: dr.dependencyAnalysis.previousVersion,
              newDependencies: dr.dependencyAnalysis.newDependencies,
              removedDependencies: dr.dependencyAnalysis.removedDependencies,
              packageAges: dr.dependencyAnalysis.packageAges,
            }
          : null,
        depRiskFindings: dr.depRiskFindings || [],
        suspiciousDependencies: suspiciousDeps.map((d) => ({
          name: d.name,
          version: d.version,
          risk: d.risk,
          depth: d.depth,
          findings: d.findings,
        })),
        aggregatedRisk: dr.aggregatedRisk,
      });
    }

    output.summary.maxRiskLevel = levels[maxLevel];
    return JSON.stringify(output, null, 2);
  }

  /** @private */
  _formatDeepText(deepResults) {
    const chalk = require("chalk");
    const lines = [];

    for (const dr of deepResults) {
      lines.push("");
      lines.push(chalk.bold.cyan("  ═══════════════════════════════════════════════════"));
      lines.push(chalk.bold.cyan("   SCANSIONE PROFONDA (deep scan)"));
      lines.push(chalk.bold.cyan("  ═══════════════════════════════════════════════════"));
      lines.push("");

      // Info pacchetto root
      const rootRisk = dr.root.risk || { level: "SICURO", score: 0 };
      const rootRiskColor = rootRisk.level === "SICURO" ? chalk.green.bold
        : rootRisk.level === "CRITICO" ? chalk.bgRed.white.bold
          : rootRisk.level === "ALTO" ? chalk.red.bold
            : chalk.yellow.bold;
      lines.push(chalk.bold(`  Pacchetto: ${dr.root.name}@${dr.root.version}`) + `  ${rootRiskColor(rootRisk.level)}`);
      lines.push(chalk.gray(`  Dipendenze analizzate: ${dr.dependencies.length}`));
      lines.push("");

      // Finding del pacchetto root (script lifecycle sospetti)
      const rootSuspicious = (dr.root.findings || []).filter((f) => f.hasSuspicious);
      if (rootSuspicious.length > 0) {
        lines.push(chalk.red.bold("  ── Script sospetti nel pacchetto root ──"));
        lines.push("");
        for (const finding of rootSuspicious) {
          lines.push(chalk.cyan(`  Quando: ${finding.hook}`));
          lines.push(chalk.gray(`  Comando: ${finding.command}`));
          for (const m of finding.matches) {
            const color = m.severity === "critical" ? chalk.bgRed.white.bold : chalk.red;
            lines.push(`    ${color(`[${m.severity.toUpperCase()}]`)} ${m.description}`);
          }
          lines.push("");
        }
      }

      // Analisi dipendenze nuove
      if (dr.dependencyAnalysis && dr.dependencyAnalysis.newDependencies.length > 0) {
        lines.push(chalk.bgYellow.black.bold("  ╔═══════════════════════════════════════════════════╗"));
        lines.push(chalk.bgYellow.black.bold("  ║  DIPENDENZE NUOVE RISPETTO ALLA VERSIONE PREC.   ║"));
        lines.push(chalk.bgYellow.black.bold("  ╚═══════════════════════════════════════════════════╝"));
        lines.push("");
        lines.push(chalk.gray(`  Versione precedente: ${dr.dependencyAnalysis.previousVersion || "N/A"}`));
        lines.push("");

        for (const dep of dr.dependencyAnalysis.newDependencies) {
          const age = dr.dependencyAnalysis.packageAges[dep.name];
          const ageStr = age
            ? age.ageInDays < 1
              ? chalk.bgRed.white.bold(` < 24 ore `)
              : age.ageInDays < 7
                ? chalk.red.bold(`${Math.round(age.ageInDays)} giorni`)
                : chalk.yellow(`${Math.round(age.ageInDays)} giorni`)
            : chalk.gray("eta' sconosciuta");

          lines.push(chalk.red(`    + ${chalk.bold(dep.name)} (${dep.range})`));
          lines.push(chalk.gray(`      Eta' del pacchetto: `) + ageStr);
          if (age && age.publishedAt) {
            lines.push(chalk.gray(`      Prima pubblicazione: ${age.publishedAt}`));
          }
          lines.push("");
        }
      }

      // Finding dependency-risk
      if (dr.depRiskFindings && dr.depRiskFindings.length > 0) {
        lines.push(chalk.bgRed.white.bold("  ╔═══════════════════════════════════════════════════╗"));
        lines.push(chalk.bgRed.white.bold("  ║  ALERT SUPPLY-CHAIN                              ║"));
        lines.push(chalk.bgRed.white.bold("  ╚═══════════════════════════════════════════════════╝"));
        lines.push("");

        for (const f of dr.depRiskFindings) {
          const color = f.severity === "critical" ? chalk.bgRed.white.bold : chalk.red;
          lines.push(`  ${color(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.title)}`);
          lines.push(chalk.gray(`  ${f.description}`));
          lines.push("");
        }
      }

      // Dipendenze con script sospetti
      const suspiciousDeps = dr.dependencies.filter((d) => d.risk && d.risk.score > 0);
      if (suspiciousDeps.length > 0) {
        lines.push(chalk.red.bold("  ── Dipendenze con script sospetti ──"));
        lines.push("");

        for (const dep of suspiciousDeps) {
          const riskColor = dep.risk.level === "CRITICO" ? chalk.bgRed.white.bold : chalk.red.bold;
          lines.push(`  ${chalk.bold(dep.name)}@${dep.version} ${riskColor(`[${dep.risk.level}]`)} (profondita': ${dep.depth})`);

          for (const finding of dep.findings) {
            if (!finding.hasSuspicious) continue;
            lines.push(chalk.gray(`    ${finding.hook}: ${finding.command}`));
            for (const m of finding.matches) {
              lines.push(chalk.red(`      [${m.severity.toUpperCase()}] ${m.description}`));
            }
          }
          lines.push("");
        }
      }

      // Dipendenze sicure
      const safeDeps = dr.dependencies.filter((d) => d.risk && d.risk.score === 0);
      if (safeDeps.length > 0) {
        lines.push(chalk.green(`  ${safeDeps.length} dipendenze senza script sospetti.`));
        lines.push("");
      }

      // Verdetto aggregato
      if (dr.aggregatedRisk) {
        const level = dr.aggregatedRisk.level;
        const color = level === "CRITICO" ? chalk.bgRed.white.bold
          : level === "ALTO" ? chalk.red.bold
            : level === "SICURO" ? chalk.green.bold
              : chalk.yellow.bold;

        lines.push(chalk.bold("  ════════════════════════════════"));
        lines.push(chalk.bold("     VERDETTO COMPLESSIVO"));
        lines.push(chalk.bold("  ════════════════════════════════"));
        lines.push(`  Rischio: ${color(level)} (punteggio: ${dr.aggregatedRisk.score})`);

        if (level === "CRITICO" || level === "ALTO") {
          lines.push("");
          lines.push(chalk.red.bold("  RACCOMANDAZIONE: NON installare questo pacchetto."));
          lines.push(chalk.red("  Verifica l'integrita' del pacchetto e del maintainer."));
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /** @private */
  _formatDeepHtml(deepResults) {
    const severityColor = { low: "#f59e0b", medium: "#f97316", high: "#ef4444", critical: "#dc2626" };
    const riskBg = { SICURO: "#22c55e", BASSO: "#f59e0b", MEDIO: "#f97316", ALTO: "#ef4444", CRITICO: "#dc2626" };

    function esc(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    let totalDeps = 0;
    let totalAlerts = 0;
    let totalNewDeps = 0;
    for (const dr of deepResults) {
      totalDeps += dr.dependencies.length;
      totalAlerts += (dr.depRiskFindings || []).length;
      totalNewDeps += (dr.dependencyAnalysis?.newDependencies || []).length;
    }

    let html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>npm-guard Deep Scan Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.3rem; margin: 1.5rem 0 0.8rem 0; color: #38bdf8; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat { background: #1e293b; border-radius: 8px; padding: 1.2rem; text-align: center; }
  .stat-value { font-size: 2rem; font-weight: bold; }
  .stat-label { color: #94a3b8; font-size: 0.85rem; margin-top: 0.3rem; }
  .section { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; border-left: 4px solid; }
  .section-safe { border-color: #22c55e; }
  .section-warn { border-color: #f59e0b; }
  .section-danger { border-color: #ef4444; }
  .pkg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .pkg-name { font-size: 1.2rem; font-weight: bold; }
  .badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: white; display: inline-block; }
  .finding { background: #0f172a; border-radius: 6px; padding: 1rem; margin-top: 0.8rem; }
  .finding-hook { color: #38bdf8; font-weight: bold; }
  .finding-cmd { color: #94a3b8; font-family: monospace; font-size: 0.85rem; word-break: break-all; margin: 0.5rem 0; }
  .match { padding: 0.3rem 0; display: flex; align-items: center; gap: 0.5rem; }
  .match-badge { padding: 0.1rem 0.5rem; border-radius: 3px; font-size: 0.7rem; font-weight: bold; color: white; }
  .new-dep { background: #0f172a; border-radius: 6px; padding: 0.8rem 1rem; margin-top: 0.5rem; }
  .new-dep-name { color: #f87171; font-weight: bold; }
  .new-dep-age { font-size: 0.85rem; }
  .verdict { text-align: center; padding: 1.5rem; margin-top: 1.5rem; border-radius: 8px; }
  footer { margin-top: 2rem; text-align: center; color: #475569; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
  <h1>npm-guard Deep Scan Report</h1>
  <p class="subtitle">Scansione profonda &mdash; ${new Date().toLocaleString("it-IT")}</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${deepResults.length}</div>
      <div class="stat-label">Pacchetti</div>
    </div>
    <div class="stat">
      <div class="stat-value">${totalDeps}</div>
      <div class="stat-label">Dipendenze</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: ${totalNewDeps > 0 ? "#f59e0b" : "#22c55e"}">${totalNewDeps}</div>
      <div class="stat-label">Nuove dipendenze</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: ${totalAlerts > 0 ? "#ef4444" : "#22c55e"}">${totalAlerts}</div>
      <div class="stat-label">Alert supply-chain</div>
    </div>
  </div>`;

    for (const dr of deepResults) {
      const risk = dr.aggregatedRisk || { level: "SICURO", score: 0 };
      const bg = riskBg[risk.level] || "#64748b";
      const sectionClass = risk.score === 0 ? "section-safe" : risk.score > 14 ? "section-danger" : "section-warn";

      html += `
  <div class="section ${sectionClass}">
    <div class="pkg-header">
      <span class="pkg-name">${esc(dr.root.name)}@${esc(dr.root.version)}</span>
      <span class="badge" style="background:${bg}">${esc(risk.level)} (${risk.score})</span>
    </div>
    <p style="color:#94a3b8;font-size:0.9rem">${dr.dependencies.length} dipendenze analizzate</p>`;

      // Root findings
      const rootSuspicious = (dr.root.findings || []).filter((f) => f.hasSuspicious);
      if (rootSuspicious.length > 0) {
        html += `<h2>Script sospetti (pacchetto root)</h2>`;
        for (const f of rootSuspicious) {
          html += `<div class="finding"><span class="finding-hook">${esc(f.hook)}</span><div class="finding-cmd">${esc(f.command)}</div>`;
          for (const m of f.matches) {
            const c = severityColor[m.severity] || "#64748b";
            html += `<div class="match"><span class="match-badge" style="background:${c}">${esc(m.severity.toUpperCase())}</span> ${esc(m.description || m.title)}</div>`;
          }
          html += `</div>`;
        }
      }

      // Nuove dipendenze
      if (dr.dependencyAnalysis && dr.dependencyAnalysis.newDependencies.length > 0) {
        html += `<h2>Dipendenze nuove (vs. ${esc(dr.dependencyAnalysis.previousVersion || "N/A")})</h2>`;
        for (const dep of dr.dependencyAnalysis.newDependencies) {
          const age = dr.dependencyAnalysis.packageAges[dep.name];
          const ageStr = age
            ? age.ageInDays < 1 ? `<span style="color:#dc2626;font-weight:bold">&lt; 24 ore</span>`
              : age.ageInDays < 7 ? `<span style="color:#ef4444;font-weight:bold">${Math.round(age.ageInDays)} giorni</span>`
                : `${Math.round(age.ageInDays)} giorni`
            : "eta' sconosciuta";
          html += `<div class="new-dep"><span class="new-dep-name">+ ${esc(dep.name)}</span> (${esc(dep.range)})<br><span class="new-dep-age">Eta': ${ageStr}</span></div>`;
        }
      }

      // Alert supply-chain
      if (dr.depRiskFindings && dr.depRiskFindings.length > 0) {
        html += `<h2>Alert Supply-Chain</h2>`;
        for (const f of dr.depRiskFindings) {
          const c = severityColor[f.severity] || "#64748b";
          html += `<div class="finding"><div class="match"><span class="match-badge" style="background:${c}">${esc(f.severity.toUpperCase())}</span> <strong>${esc(f.title)}</strong></div><p style="color:#94a3b8;margin-top:0.5rem;font-size:0.9rem">${esc(f.description)}</p></div>`;
        }
      }

      // Dipendenze sospette
      const suspDeps = dr.dependencies.filter((d) => d.risk && d.risk.score > 0);
      if (suspDeps.length > 0) {
        html += `<h2>Dipendenze con script sospetti</h2>`;
        for (const dep of suspDeps) {
          const depBg = riskBg[dep.risk.level] || "#64748b";
          html += `<div class="finding"><div class="pkg-header"><span style="font-weight:bold">${esc(dep.name)}@${esc(dep.version)}</span> <span class="badge" style="background:${depBg}">${esc(dep.risk.level)}</span></div>`;
          for (const f of dep.findings) {
            if (!f.hasSuspicious) continue;
            html += `<span class="finding-hook">${esc(f.hook)}</span><div class="finding-cmd">${esc(f.command)}</div>`;
            for (const m of f.matches) {
              const mc = severityColor[m.severity] || "#64748b";
              html += `<div class="match"><span class="match-badge" style="background:${mc}">${esc(m.severity.toUpperCase())}</span> ${esc(m.description || m.title)}</div>`;
            }
          }
          html += `</div>`;
        }
      }

      html += `</div>`;

      // Verdetto
      html += `
  <div class="verdict" style="background:${bg}20;border:2px solid ${bg}">
    <div style="font-size:1.5rem;font-weight:bold;color:${bg}">VERDETTO: ${esc(risk.level)}</div>
    <div style="color:#94a3b8;margin-top:0.5rem">Punteggio: ${risk.score}</div>
  </div>`;
    }

    html += `
  <footer>Report generato da npm-guard (deep scan) &mdash; https://github.com/Conradlog/npm-guard</footer>
</div>
</body>
</html>`;

    return html;
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
