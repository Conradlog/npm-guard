#!/usr/bin/env node

const { NpmGuardEngine } = require("../src/core/engine");
const { runInteractive } = require("../src/ui/interactive");
const wrapper = require("../src/core/wrapper");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const command = args[0];

// ── Routing subcommands ──
switch (command) {
  case "check":
    runCheck(args.slice(1));
    break;
  case "scan":
    runScan(args.slice(1));
    break;
  case "setup":
    runSetup(args.slice(1));
    break;
  case "uninstall":
    runUninstall();
    break;
  case "status":
    runStatus();
    break;
  case "--help":
  case "-h":
    showHelp();
    break;
  case "--version":
  case "-v":
    showVersion();
    break;
  case undefined:
  case "--interactive":
  case "-i":
    runInteractive(parseFlags(args));
    break;
  default:
    // Retrocompatibilita': se il primo arg non e' un subcommand, trattalo come pacchetto
    if (command.startsWith("-")) {
      // E' un flag: usa la vecchia logica diretta
      runLegacyDirect(args);
    } else {
      // E' un nome pacchetto: scansionalo
      runCheck(args);
    }
    break;
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: check <packages...>
// ═══════════════════════════════════════════
function runCheck(args) {
  const flags = parseFlags(args);
  const packages = args.filter((a) => !a.startsWith("-"));
  const deep = args.includes("--deep");

  if (packages.length === 0) {
    console.error(chalk.red("Specificare almeno un pacchetto. Esempio: npm-guard check express"));
    process.exit(1);
  }

  const engine = new NpmGuardEngine(flags);

  if (deep) {
    // Scansione profonda: analizza pacchetto + tutte le dipendenze transitive
    const allResults = [];
    const allDeepResults = [];

    const isTextOutput = !flags.format || flags.format === "text";

    for (const pkg of packages) {
      if (isTextOutput) {
        console.log(chalk.cyan(`\n  Scansione profonda di ${chalk.bold(pkg)}...`));
        console.log(chalk.gray("  Analisi dipendenze transitive, confronto versioni, controllo eta'...\n"));
      }

      const deepResult = engine.scanPackageDeep(pkg, {
        onProgress: (type, name, current, total) => {
          if (isTextOutput && type === "dep") {
            process.stderr.write(chalk.gray(`\r  Scansione dipendenza ${current + 1}/${total}: ${name}      `));
          }
        },
      });

      if (isTextOutput && deepResult.dependencies.length > 0) {
        process.stderr.write("\r" + " ".repeat(80) + "\r");
      }

      allDeepResults.push(deepResult);
      allResults.push(deepResult.root);
      allResults.push(...deepResult.dependencies.filter((d) => d.risk && d.risk.score > 0));
    }

    // Output formattato
    const output = engine.formatDeepResults(allDeepResults, { format: flags.format });
    console.log(output);

    // Exit code basato sul rischio aggregato (rispetta --fail-on)
    const deepFailed = allDeepResults.some((dr) => {
      if (!dr.aggregatedRisk) return false;
      return engine.shouldFail([{ risk: dr.aggregatedRisk }]);
    });
    process.exit(deepFailed || engine.shouldFail(allResults) ? 1 : 0);
  } else {
    const results = packages.map((pkg) => engine.scanPackage(pkg));
    console.log(engine.formatResults(results));
    process.exit(engine.shouldFail(results) ? 1 : 0);
  }
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: scan [path]
// ═══════════════════════════════════════════
function runScan(args) {
  const flags = parseFlags(args);
  const positional = args.filter((a) => !a.startsWith("-"));
  const projectPath = path.resolve(positional[0] || process.cwd());

  // Supporta anche --installed per retrocompatibilita'
  if (args.includes("--installed")) {
    const packages = positional;
    if (packages.length === 0) {
      console.error("Specificare almeno un pacchetto");
      process.exit(1);
    }
    const engine = new NpmGuardEngine(flags);
    const results = packages.map((p) => engine.scanInstalledPackage(process.cwd(), p));
    console.log(engine.formatResults(results));
    process.exit(0);
    return;
  }

  const engine = new NpmGuardEngine(flags, projectPath);

  if (flags.format !== "json") {
    console.log(chalk.gray(`\n  Scansione dipendenze in: ${projectPath}\n`));
  }

  const results = engine.scanProject(projectPath);
  if (results.error) {
    if (flags.format === "json") {
      console.log(JSON.stringify({ error: results.error }));
    } else {
      console.error(chalk.red(results.error));
    }
    process.exit(1);
  }

  console.log(engine.formatResults(results));
  process.exit(engine.shouldFail(results) ? 1 : 0);
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: setup
// ═══════════════════════════════════════════
function runSetup(args) {
  console.log("");
  console.log(chalk.bold.cyan("  npm-guard setup"));
  console.log(chalk.gray("  Installa il wrapper trasparente nella tua shell."));
  console.log(chalk.gray("  Dopo il setup, ogni 'npm install' verra' scansionato automaticamente."));
  console.log("");

  const detected = wrapper.detectShell();
  console.log(`  Shell rilevata:  ${chalk.bold(detected.shell)}`);
  console.log(`  File config:     ${chalk.bold(detected.rcFile)}`);
  console.log("");

  const result = wrapper.install();

  if (!result.success) {
    if (result.error.includes("gia' installato")) {
      console.log(chalk.yellow(`  ${result.error}`));
      console.log(chalk.gray("  Per reinstallare, esegui prima: npm-guard uninstall"));
    } else {
      console.log(chalk.red(`  Errore: ${result.error}`));
    }
    process.exit(1);
  }

  if (result.backupFile) {
    console.log(chalk.green(`  ✓ Backup creato: ${result.backupFile}`));
  }
  console.log(chalk.green(`  ✓ Wrapper installato in: ${result.rcFile}`));
  console.log("");
  console.log(chalk.bold("  Per attivarlo, esegui:"));
  console.log(chalk.cyan(`    source ${result.rcFile}`));
  console.log("");
  console.log(chalk.gray("  Oppure riapri il terminale."));
  console.log(chalk.gray("  Da ora ogni 'npm install <pacchetto>' verra' controllato automaticamente."));
  console.log(chalk.gray("  Per disabilitare: npm-guard uninstall"));
  console.log("");
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: uninstall
// ═══════════════════════════════════════════
function runUninstall() {
  const result = wrapper.uninstall();

  if (!result.success) {
    console.log(chalk.red(`  Errore: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`\n  ✓ Wrapper rimosso da: ${result.rcFile}`));
  console.log(chalk.gray("  Riapri il terminale per completare la disattivazione.\n"));
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: status
// ═══════════════════════════════════════════
function runStatus() {
  const wrapperStatus = wrapper.status();
  const pkg = require("../package.json");

  console.log("");
  console.log(chalk.bold.cyan("  npm-guard status"));
  console.log("");
  console.log(`  Versione:     ${chalk.bold("v" + pkg.version)}`);
  console.log(`  Shell:        ${chalk.bold(wrapperStatus.shell)}`);
  console.log(`  File config:  ${chalk.bold(wrapperStatus.rcFile)}`);
  console.log(
    `  Wrapper:      ${wrapperStatus.installed ? chalk.green.bold("ATTIVO") : chalk.yellow("NON INSTALLATO")}`
  );

  if (!wrapperStatus.installed) {
    console.log(chalk.gray("\n  Per attivare il wrapper: npm-guard setup"));
  }
  console.log("");
}

// ═══════════════════════════════════════════
//  LEGACY: vecchia modalita' diretta (--scan, --installed)
// ═══════════════════════════════════════════
function runLegacyDirect(args) {
  const flags = parseFlags(args);
  const positional = args.filter((a) => !a.startsWith("-"));
  const engine = new NpmGuardEngine(flags);

  if (args.includes("--scan")) {
    const projectPath = positional[0] || process.cwd();
    const results = engine.scanProject(path.resolve(projectPath));
    if (results.error) {
      console.error(results.error);
      process.exit(1);
    }
    console.log(engine.formatResults(results));
    process.exit(engine.shouldFail(results) ? 1 : 0);
  }

  if (args.includes("--installed")) {
    const packages = positional;
    const results = packages.map((p) => engine.scanInstalledPackage(process.cwd(), p));
    console.log(engine.formatResults(results));
    process.exit(0);
  }

  showHelp();
}

// ═══════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════
function parseFlags(args) {
  const flags = {};
  if (args.includes("--json")) flags.format = "json";
  if (args.includes("--html")) flags.format = "html";
  if (args.includes("--deep")) flags.deep = true;

  const formatIdx = args.indexOf("--format");
  if (formatIdx !== -1 && args[formatIdx + 1]) {
    flags.format = args[formatIdx + 1];
  }

  const failIdx = args.indexOf("--fail-on");
  if (failIdx !== -1 && args[failIdx + 1]) {
    flags.failOn = args[failIdx + 1];
  }

  return flags;
}

function showVersion() {
  const pkg = require("../package.json");
  console.log(`npm-guard v${pkg.version}`);
  process.exit(0);
}

function showHelp() {
  console.log(`
  ${chalk.bold.cyan("npm-guard")} - Proteggi il tuo PC dai pacchetti npm pericolosi

  ${chalk.bold("COMANDI:")}
    npm-guard                        Modalita' interattiva guidata
    npm-guard check <pkg...>         Scansiona pacchetti prima di installarli
    npm-guard scan [path]            Scansiona le dipendenze di un progetto
    npm-guard setup                  Installa il wrapper trasparente (npm auto-guard)
    npm-guard uninstall              Rimuove il wrapper dalla shell
    npm-guard status                 Mostra lo stato corrente

  ${chalk.bold("MODALITA' CHECK (AI / CI / Umani):")}
    npm-guard check express          Controlla un pacchetto
    npm-guard check lodash axios     Controlla piu' pacchetti
    npm-guard check express --json   Output JSON (per agenti IA e CI/CD)
    npm-guard check express --html   Output HTML (per report)
    npm-guard check axios --deep     Scansione profonda (dipendenze transitive)

  ${chalk.bold("MODALITA' SCAN:")}
    npm-guard scan                   Scansiona il progetto corrente
    npm-guard scan /percorso         Scansiona un progetto specifico
    npm-guard scan --json            Output JSON per CI/CD

  ${chalk.bold("OPZIONI:")}
    --json                           Output JSON (machine-readable)
    --html                           Output HTML (report visivo)
    --deep                           Scansione profonda: analizza dipendenze
                                     transitive, confronta versioni, controlla
                                     eta' pacchetti (anti supply-chain attack)
    --format <text|json|html>        Formato di output
    --fail-on <level>                Exit code 1 se rischio >= level
                                     (low, medium, high, critical)
    -v, --version                    Mostra la versione
    -h, --help                       Mostra questo messaggio

  ${chalk.bold("WRAPPER TRASPARENTE:")}
    Dopo aver eseguito ${chalk.cyan("npm-guard setup")}, ogni volta che fai
    'npm install <pacchetto>', npm-guard lo scansiona automaticamente.
    Se trova minacce, blocca l'installazione e ti avvisa.

  ${chalk.bold("USO CON AGENTI IA:")}
    Gli agenti IA devono usare: npm-guard check <pkg> --json
    Il campo "summary.maxRiskLevel" nel JSON indica il verdetto.
    Vedi ${chalk.cyan("AI_INSTRUCTIONS.md")} per le istruzioni complete.

  ${chalk.bold("USO IN CI/CD:")}
    npm-guard scan --json --fail-on high
`);
  process.exit(0);
}
