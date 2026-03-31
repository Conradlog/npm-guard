const { ShellCommandsRule } = require("./shell-commands");
const { NetworkAccessRule } = require("./network-access");
const { FileSystemRule } = require("./file-system");
const { CodeExecutionRule } = require("./code-execution");
const { SensitiveFilesRule } = require("./sensitive-files");
const { ObfuscationRule } = require("./obfuscation");
const { DependencyRiskRule } = require("./dependency-risk");
const { BaseRule } = require("./base-rule");

/**
 * Registry delle regole built-in.
 * Ogni regola e' un'istanza di BaseRule.
 */
const BUILTIN_RULES = {
  "shell-commands": new ShellCommandsRule(),
  "network-access": new NetworkAccessRule(),
  "file-system": new FileSystemRule(),
  "code-execution": new CodeExecutionRule(),
  "sensitive-files": new SensitiveFilesRule(),
  "obfuscation": new ObfuscationRule(),
  "dependency-risk": new DependencyRiskRule(),
};

/**
 * Carica le regole in base alla configurazione
 * @param {object} config - Configurazione con `rules` abilitati
 * @returns {BaseRule[]}
 */
function loadRules(config) {
  const rules = [];

  for (const [name, enabled] of Object.entries(config.rules || {})) {
    if (!enabled) continue;

    if (BUILTIN_RULES[name]) {
      rules.push(BUILTIN_RULES[name]);
    }
  }

  return rules;
}

module.exports = { loadRules, BUILTIN_RULES, BaseRule };
