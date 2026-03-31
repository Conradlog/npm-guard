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
    // Backward compatibility: if the first arg is not a subcommand, treat it as a package
    if (command.startsWith("-")) {
      // It's a flag: use the old direct logic
      runLegacyDirect(args);
    } else {
      // It's a package name: scan it
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
    console.error(chalk.red("Specify at least one package. Example: npm-guard check express"));
    process.exit(1);
  }

  const engine = new NpmGuardEngine(flags);

  if (deep) {
    // Deep scan: analyze package + all transitive dependencies
    const allResults = [];
    const allDeepResults = [];

    const isTextOutput = !flags.format || flags.format === "text";

    for (const pkg of packages) {
      if (isTextOutput) {
        console.log(chalk.cyan(`\n  Deep scanning ${chalk.bold(pkg)}...`));
        console.log(chalk.gray("  Analyzing transitive dependencies, comparing versions, checking age...\n"));
      }

      const deepResult = engine.scanPackageDeep(pkg, {
        onProgress: (type, name, current, total) => {
          if (isTextOutput && type === "dep") {
            process.stderr.write(chalk.gray(`\r  Scanning dependency ${current + 1}/${total}: ${name}      `));
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

    // Formatted output
    const output = engine.formatDeepResults(allDeepResults, { format: flags.format });
    console.log(output);

    // Exit code based on aggregated risk (respects --fail-on)
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

  // Also supports --installed for backward compatibility
  if (args.includes("--installed")) {
    const packages = positional;
    if (packages.length === 0) {
      console.error("Specify at least one package");
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
    console.log(chalk.gray(`\n  Scanning dependencies in: ${projectPath}\n`));
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
  console.log(chalk.gray("  Install the transparent wrapper in your shell."));
  console.log(chalk.gray("  After setup, every 'npm install' will be scanned automatically."));
  console.log("");

  const detected = wrapper.detectShell();
  console.log(`  Detected shell:  ${chalk.bold(detected.shell)}`);
  console.log(`  Config file:     ${chalk.bold(detected.rcFile)}`);
  console.log("");

  const result = wrapper.install();

  if (!result.success) {
    if (result.error.includes("already installed")) {
      console.log(chalk.yellow(`  ${result.error}`));
      console.log(chalk.gray("  To reinstall, first run: npm-guard uninstall"));
    } else {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
    process.exit(1);
  }

  if (result.backupFile) {
    console.log(chalk.green(`  ✓ Backup created: ${result.backupFile}`));
  }
  console.log(chalk.green(`  ✓ Wrapper installed in: ${result.rcFile}`));
  console.log("");
  console.log(chalk.bold("  To activate it, run:"));
  console.log(chalk.cyan(`    source ${result.rcFile}`));
  console.log("");
  console.log(chalk.gray("  Or reopen the terminal."));
  console.log(chalk.gray("  From now on, every 'npm install <package>' will be checked automatically."));
  console.log(chalk.gray("  To disable: npm-guard uninstall"));
  console.log("");
}

// ═══════════════════════════════════════════
//  SUBCOMMAND: uninstall
// ═══════════════════════════════════════════
function runUninstall() {
  const result = wrapper.uninstall();

  if (!result.success) {
    console.log(chalk.red(`  Error: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`\n  ✓ Wrapper removed from: ${result.rcFile}`));
  console.log(chalk.gray("  Reopen the terminal to complete the deactivation.\n"));
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
  console.log(`  Version:      ${chalk.bold("v" + pkg.version)}`);
  console.log(`  Shell:        ${chalk.bold(wrapperStatus.shell)}`);
  console.log(`  Config file:  ${chalk.bold(wrapperStatus.rcFile)}`);
  console.log(
    `  Wrapper:      ${wrapperStatus.installed ? chalk.green.bold("ACTIVE") : chalk.yellow("NOT INSTALLED")}`
  );

  if (!wrapperStatus.installed) {
    console.log(chalk.gray("\n  To activate the wrapper: npm-guard setup"));
  }
  console.log("");
}

// ═══════════════════════════════════════════
//  LEGACY: old direct mode (--scan, --installed)
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
  ${chalk.bold.cyan("npm-guard")} - Protect your PC from dangerous npm packages

  ${chalk.bold("COMMANDS:")}
    npm-guard                        Guided interactive mode
    npm-guard check <pkg...>         Scan packages before installing them
    npm-guard scan [path]            Scan the dependencies of a project
    npm-guard setup                  Install the transparent wrapper (npm auto-guard)
    npm-guard uninstall              Remove the wrapper from the shell
    npm-guard status                 Show the current status

  ${chalk.bold("CHECK MODE (AI / CI / Humans):")}
    npm-guard check express          Check a package
    npm-guard check lodash axios     Check multiple packages
    npm-guard check express --json   JSON output (for AI agents and CI/CD)
    npm-guard check express --html   HTML output (for reports)
    npm-guard check axios --deep     Deep scan (transitive dependencies)

  ${chalk.bold("SCAN MODE:")}
    npm-guard scan                   Scan the current project
    npm-guard scan /path             Scan a specific project
    npm-guard scan --json            JSON output for CI/CD

  ${chalk.bold("OPTIONS:")}
    --json                           JSON output (machine-readable)
    --html                           HTML output (visual report)
    --deep                           Deep scan: analyze transitive
                                     dependencies, compare versions, check
                                     package age (anti supply-chain attack)
    --format <text|json|html>        Output format
    --fail-on <level>                Exit code 1 if risk >= level
                                     (low, medium, high, critical)
    -v, --version                    Show the version
    -h, --help                       Show this message

  ${chalk.bold("TRANSPARENT WRAPPER:")}
    After running ${chalk.cyan("npm-guard setup")}, every time you run
    'npm install <package>', npm-guard scans it automatically.
    If threats are found, it blocks the installation and warns you.

  ${chalk.bold("USAGE WITH AI AGENTS:")}
    AI agents should use: npm-guard check <pkg> --json
    The "summary.maxRiskLevel" field in the JSON indicates the verdict.
    See ${chalk.cyan("AI_INSTRUCTIONS.md")} for complete instructions.

  ${chalk.bold("USAGE IN CI/CD:")}
    npm-guard scan --json --fail-on high
`);
  process.exit(0);
}
