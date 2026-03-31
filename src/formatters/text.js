const chalk = require("chalk");

const SEVERITY_COLORS = {
  low: chalk.yellow,
  medium: chalk.hex("#FFA500"),
  high: chalk.red,
  critical: chalk.bgRed.white.bold,
};

const RISK_COLORS = {
  green: chalk.green.bold,
  yellow: chalk.yellow.bold,
  red: chalk.red.bold,
};

const RISK_EXPLANATIONS = {
  SICURO: "No suspicious commands during installation. You can install it safely.",
  BASSO: "Minimal commands during installation. Very low risk.",
  MEDIO: "Some commands to review during installation.",
  ALTO: "Potentially dangerous commands. Consider whether you trust the author.",
  CRITICO: "WARNING! Very suspicious commands. Could be malicious!",
};

const HOOK_EXPLANATIONS = {
  preinstall: "BEFORE installation",
  install: "DURING installation",
  postinstall: "AFTER installation",
  preuninstall: "BEFORE uninstallation",
  postuninstall: "AFTER uninstallation",
  prepublish: "Before publishing",
  preprepare: "Before preparation",
  prepare: "During preparation",
  postprepare: "After preparation",
};

/**
 * Formatter testuale con colori per il terminale
 */
function format(results, options = {}) {
  const lines = [];

  if (!Array.isArray(results)) results = [results];

  const suspicious = results.filter((r) => r.risk && r.risk.score > 0);
  const safe = results.filter((r) => r.risk && r.risk.score === 0);
  const errors = results.filter((r) => r.error);

  // Errori
  for (const r of errors) {
    lines.push(chalk.red(`\n  ✗ ${r.error}`));
  }

  // Pacchetti sospetti - dettagli
  for (const result of suspicious) {
    const riskColor = RISK_COLORS[result.risk.color] || chalk.white;
    const riskIcon =
      result.risk.score <= 10
        ? chalk.yellow("⚠ WARNING")
        : chalk.red("✗ DANGER");

    lines.push("");
    lines.push(chalk.bold("  ┌─────────────────────────────────────────────────"));
    lines.push(
      chalk.bold(`  │  ${result.name}`) + chalk.gray(` version ${result.version}`)
    );
    lines.push(
      `  │  Verdict: ${riskIcon}   Score: ${riskColor(result.risk.level)} (${result.risk.score}/100)`
    );
    lines.push(chalk.bold("  └─────────────────────────────────────────────────"));

    const explanation = RISK_EXPLANATIONS[result.risk.level];
    if (explanation) lines.push(chalk.gray(`\n  ${explanation}`));

    lines.push("");
    for (const finding of result.findings) {
      const hookExpl = HOOK_EXPLANATIONS[finding.hook] || finding.hook;
      lines.push(chalk.cyan(`  When: ${hookExpl}`));
      lines.push(chalk.gray(`  Command: ${finding.command}`));

      if (finding.isSafe) {
        lines.push(chalk.green("  -> Recognized as safe (build tool)\n"));
        continue;
      }

      for (const match of finding.matches) {
        const color = SEVERITY_COLORS[match.severity] || chalk.white;
        lines.push(`    ${color(`[${match.severity.toUpperCase()}]`)} ${match.description}`);
      }
      lines.push("");
    }
  }

  // Pacchetti sicuri
  if (safe.length > 0) {
    lines.push("");
    lines.push(chalk.green.bold(`  ✓ ${safe.length} safe package${safe.length === 1 ? "" : "s"}:`));
    for (const r of safe) {
      lines.push(chalk.green(`    ✓ ${r.name}@${r.version}`));
    }
  }

  // Riepilogo
  lines.push("");
  lines.push(chalk.bold("  ════════════════════════════════"));
  lines.push(chalk.bold("           SUMMARY"));
  lines.push(chalk.bold("  ════════════════════════════════"));
  lines.push(`  Packages analyzed:     ${chalk.bold(results.length - errors.length)}`);
  lines.push(`  Safe:                  ${chalk.green.bold(safe.length)}`);
  lines.push(
    `  With issues:           ${suspicious.length > 0 ? chalk.red.bold(suspicious.length) : chalk.green.bold("0")}`
  );

  const critical = results.filter((r) => r.risk && r.risk.level === "CRITICO");
  if (critical.length > 0) {
    lines.push("");
    lines.push(chalk.bgRed.white.bold("  ╔═══════════════════════════════════════════════════╗"));
    lines.push(chalk.bgRed.white.bold("  ║  WARNING: Found VERY dangerous packages!          ║"));
    lines.push(chalk.bgRed.white.bold("  ╚═══════════════════════════════════════════════════╝"));
    lines.push("");
    lines.push(chalk.red("  What to do:"));
    lines.push(chalk.red("  1. DO NOT install these packages"));
    lines.push(chalk.red("  2. Look for safe alternatives on npmjs.com"));
    lines.push(chalk.red("  3. If you know and trust the author, proceed with caution"));
  } else if (suspicious.length > 0) {
    lines.push("");
    lines.push(chalk.yellow("  Review the details above before proceeding."));
  } else if (safe.length > 0) {
    lines.push("");
    lines.push(chalk.green.bold("  All clear! You can proceed with the installation."));
  }

  lines.push("");
  return lines.join("\n");
}

module.exports = { format };
