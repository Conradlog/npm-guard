/**
 * npm-guard - Scan npm packages for malicious lifecycle scripts
 *
 * @example
 * // Basic usage
 * const { NpmGuardEngine } = require("npm-guard");
 * const engine = new NpmGuardEngine();
 * const result = engine.scanPackage("express");
 * console.log(engine.formatResults([result]));
 *
 * // JSON output for AI agents
 * const engine = new NpmGuardEngine({ format: "json" });
 * const result = engine.scanPackage("express");
 * const json = JSON.parse(engine.formatResults([result]));
 * if (json.summary.maxRiskLevel === "CRITICO") { ... }
 *
 * // Custom rules
 * class MyRule extends BaseRule {
 *   get name() { return "my-rule"; }
 *   get description() { return "My rule"; }
 *   get patterns() { return [...]; }
 * }
 */

const { NpmGuardEngine, LIFECYCLE_HOOKS, BUILTIN_SAFE_PATTERNS } = require("./core/engine");
const { loadConfig, DEFAULT_CONFIG } = require("./core/config");
const { RegistryFetcher } = require("./core/registry");
const { BaseRule } = require("./rules/base-rule");
const { DependencyRiskRule } = require("./rules/dependency-risk");
const { loadRules, BUILTIN_RULES } = require("./rules");
const { PluginLoader } = require("./plugins/loader");
const { getFormatter, BUILTIN_FORMATTERS } = require("./formatters");
const wrapper = require("./core/wrapper");

module.exports = {
  // Classe principale
  NpmGuardEngine,

  // Per creare regole custom
  BaseRule,
  DependencyRiskRule,

  // Per creare plugin
  PluginLoader,

  // Per creare formatter custom
  getFormatter,
  BUILTIN_FORMATTERS,

  // Per estendere il registry
  RegistryFetcher,

  // Shell wrapper (setup/uninstall/status)
  wrapper,

  // Config
  loadConfig,
  DEFAULT_CONFIG,

  // Costanti
  LIFECYCLE_HOOKS,
  BUILTIN_SAFE_PATTERNS,
  BUILTIN_RULES,
  loadRules,
};
