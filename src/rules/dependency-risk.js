const { BaseRule } = require("./base-rule");

/**
 * Advanced rule: detects suspicious dependencies injected into legitimate packages.
 * Designed to catch attacks like the axios compromise (March 2026):
 * - New dependencies compared to the previous version
 * - Recently published packages (< 7 days)
 * - Package names that mimic well-known libraries (typosquatting)
 *
 * Unlike other rules, this one does not analyze script commands
 * but receives dependency metadata via the context field.
 */
class DependencyRiskRule extends BaseRule {
  get name() {
    return "dependency-risk";
  }

  get description() {
    return "Detects suspicious dependencies: new, too recent, or with deceptive names";
  }

  get patterns() {
    // This rule does not use traditional regex patterns.
    // Analysis happens in analyze() via metadata in context.
    return [];
  }

  /**
   * Analyzes dependency metadata for supply-chain attack signals.
   *
   * The context must contain:
   * - context.dependencyAnalysis.newDependencies: array of { name, version } new dependencies
   * - context.dependencyAnalysis.packageAges: object { name: { ageInDays, publishedAt } }
   * - context.dependencyAnalysis.previousVersion: string of the previous version
   *
   * @param {string} command - The command (not used for this rule)
   * @param {object} context - Context with dependency metadata
   * @returns {Array}
   */
  analyze(command, context = {}) {
    const matches = [];
    const analysis = context.dependencyAnalysis;
    if (!analysis) return matches;

    // 1. New dependencies compared to the previous version
    if (analysis.newDependencies && analysis.newDependencies.length > 0) {
      for (const dep of analysis.newDependencies) {
        matches.push({
          ruleGroup: this.name,
          id: "new-dependency",
          severity: "high",
          title: `new dependency: ${dep.name}`,
          description:
            `The dependency "${dep.name}" did not exist in the previous version ` +
            `(${analysis.previousVersion || "unknown"}). ` +
            `It may have been injected after the maintainer's account was compromised.`,
        });
      }
    }

    // 2. Recently published dependencies (< 7 days)
    if (analysis.packageAges) {
      for (const [depName, ageInfo] of Object.entries(analysis.packageAges)) {
        if (ageInfo.ageInDays !== null && ageInfo.ageInDays < 7) {
          const severity = ageInfo.ageInDays < 1 ? "critical" : "high";
          matches.push({
            ruleGroup: this.name,
            id: "young-package",
            severity,
            title: `very recent package: ${depName}`,
            description:
              `The package "${depName}" was published only ${formatAge(ageInfo.ageInDays)} ago ` +
              `(${ageInfo.publishedAt}). Newly created packages used as dependencies ` +
              `of established projects are a strong indicator of a supply-chain attack.`,
          });
        }
      }
    }

    // 3. Explosive combination: new dependency + young
    if (analysis.newDependencies && analysis.packageAges) {
      for (const dep of analysis.newDependencies) {
        const age = analysis.packageAges[dep.name];
        if (age && age.ageInDays !== null && age.ageInDays < 7) {
          matches.push({
            ruleGroup: this.name,
            id: "injected-young-dependency",
            severity: "critical",
            title: `injected and newly created dependency: ${dep.name}`,
            description:
              `HIGH RISK: "${dep.name}" is a new dependency (not present in the previous ` +
              `version) AND the package was created only ${formatAge(age.ageInDays)} ago. ` +
              `This is the exact pattern of the axios supply-chain attack (March 2026): ` +
              `compromised account -> malicious dependency injected -> RAT installed via postinstall.`,
          });
        }
      }
    }

    // 4. Suspicious names (prefix/suffix of well-known libraries)
    if (analysis.newDependencies) {
      for (const dep of analysis.newDependencies) {
        const suspicious = detectSuspiciousName(dep.name);
        if (suspicious) {
          matches.push({
            ruleGroup: this.name,
            id: "suspicious-name",
            severity: "high",
            title: `suspicious name: ${dep.name}`,
            description: suspicious,
          });
        }
      }
    }

    return matches;
  }
}

/**
 * Checks if a package name mimics a well-known library
 */
function detectSuspiciousName(name) {
  // Well-known libraries that are often imitated
  const wellKnown = [
    "crypto-js", "lodash", "express", "axios", "react", "vue",
    "angular", "moment", "chalk", "commander", "inquirer", "request",
    "underscore", "debug", "uuid", "semver", "glob", "minimatch",
    "async", "bluebird", "cheerio", "passport", "mongoose", "sequelize",
  ];

  // Suspicious prefixes/suffixes added to well-known names
  const suspiciousPrefixes = ["plain-", "simple-", "fast-", "lite-", "mini-", "pure-", "real-", "true-", "safe-", "my-"];
  const suspiciousSuffixes = ["-js", "-lib", "-util", "-helper", "-core", "-plus", "-pro", "-new"];

  for (const lib of wellKnown) {
    for (const prefix of suspiciousPrefixes) {
      if (name === prefix + lib) {
        return (
          `The name "${name}" looks like a copy of "${lib}" with the prefix "${prefix}". ` +
          `This pattern is typical of typosquatting (e.g. "plain-crypto-js" used in the axios attack).`
        );
      }
    }
    for (const suffix of suspiciousSuffixes) {
      if (name === lib + suffix) {
        return (
          `The name "${name}" looks like a copy of "${lib}" with the suffix "${suffix}". ` +
          `This could be a typosquatting attempt.`
        );
      }
    }
  }

  return null;
}

/**
 * Formats age in a human-readable way
 */
function formatAge(days) {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours <= 1 ? "less than an hour" : `${hours} hours`;
  }
  if (days < 2) return "1 day";
  return `${Math.round(days)} days`;
}

module.exports = { DependencyRiskRule, detectSuspiciousName, formatAge };
