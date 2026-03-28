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
  SICURO: "Nessun comando sospetto durante l'installazione. Puoi installarlo tranquillamente.",
  BASSO: "Comandi minimi durante l'installazione. Rischio molto basso.",
  MEDIO: "Alcuni comandi da verificare durante l'installazione.",
  ALTO: "Comandi potenzialmente pericolosi. Valuta se ti fidi dell'autore.",
  CRITICO: "ATTENZIONE! Comandi molto sospetti. Potrebbe essere malevolo!",
};

const HOOK_EXPLANATIONS = {
  preinstall: "PRIMA dell'installazione",
  install: "DURANTE l'installazione",
  postinstall: "DOPO l'installazione",
  preuninstall: "PRIMA della disinstallazione",
  postuninstall: "DOPO la disinstallazione",
  prepublish: "Prima della pubblicazione",
  preprepare: "Prima della preparazione",
  prepare: "Durante la preparazione",
  postprepare: "Dopo la preparazione",
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
        ? chalk.yellow("⚠ ATTENZIONE")
        : chalk.red("✗ PERICOLO");

    lines.push("");
    lines.push(chalk.bold("  ┌─────────────────────────────────────────────────"));
    lines.push(
      chalk.bold(`  │  ${result.name}`) + chalk.gray(` versione ${result.version}`)
    );
    lines.push(
      `  │  Verdetto: ${riskIcon}   Punteggio: ${riskColor(result.risk.level)} (${result.risk.score}/100)`
    );
    lines.push(chalk.bold("  └─────────────────────────────────────────────────"));

    const explanation = RISK_EXPLANATIONS[result.risk.level];
    if (explanation) lines.push(chalk.gray(`\n  ${explanation}`));

    lines.push("");
    for (const finding of result.findings) {
      const hookExpl = HOOK_EXPLANATIONS[finding.hook] || finding.hook;
      lines.push(chalk.cyan(`  Quando: ${hookExpl}`));
      lines.push(chalk.gray(`  Comando: ${finding.command}`));

      if (finding.isSafe) {
        lines.push(chalk.green("  -> Riconosciuto come sicuro (build tool)\n"));
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
    lines.push(chalk.green.bold(`  ✓ ${safe.length} pacchett${safe.length === 1 ? "o sicuro" : "i sicuri"}:`));
    for (const r of safe) {
      lines.push(chalk.green(`    ✓ ${r.name}@${r.version}`));
    }
  }

  // Riepilogo
  lines.push("");
  lines.push(chalk.bold("  ════════════════════════════════"));
  lines.push(chalk.bold("           RIEPILOGO"));
  lines.push(chalk.bold("  ════════════════════════════════"));
  lines.push(`  Pacchetti analizzati:  ${chalk.bold(results.length - errors.length)}`);
  lines.push(`  Sicuri:                ${chalk.green.bold(safe.length)}`);
  lines.push(
    `  Con problemi:          ${suspicious.length > 0 ? chalk.red.bold(suspicious.length) : chalk.green.bold("0")}`
  );

  const critical = results.filter((r) => r.risk && r.risk.level === "CRITICO");
  if (critical.length > 0) {
    lines.push("");
    lines.push(chalk.bgRed.white.bold("  ╔═══════════════════════════════════════════════════╗"));
    lines.push(chalk.bgRed.white.bold("  ║  ATTENZIONE: Trovati pacchetti MOLTO pericolosi!  ║"));
    lines.push(chalk.bgRed.white.bold("  ╚═══════════════════════════════════════════════════╝"));
    lines.push("");
    lines.push(chalk.red("  Cosa fare:"));
    lines.push(chalk.red("  1. NON installare questi pacchetti"));
    lines.push(chalk.red("  2. Cerca alternative sicure su npmjs.com"));
    lines.push(chalk.red("  3. Se li conosci e ti fidi dell'autore, procedi con cautela"));
  } else if (suspicious.length > 0) {
    lines.push("");
    lines.push(chalk.yellow("  Verifica i dettagli sopra prima di procedere."));
  } else if (safe.length > 0) {
    lines.push("");
    lines.push(chalk.green.bold("  Tutto ok! Puoi procedere con l'installazione."));
  }

  lines.push("");
  return lines.join("\n");
}

module.exports = { format };
