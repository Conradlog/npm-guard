const readline = require("readline");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");
const { NpmGuardEngine } = require("../core/engine");
const { createSpinner, progressBar } = require("./spinner");
const c = require("./colors");

let rl;

function initReadline() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function menu(title, options) {
  console.log("");
  console.log(c.title(`  ${title}`));
  console.log(`  ${c.divider}`);
  console.log("");

  for (let i = 0; i < options.length; i++) {
    console.log(`  ${c.bold(`[${i + 1}]`)}  ${options[i].label}`);
    if (options[i].hint) console.log(c.muted(`       ${options[i].hint}`));
  }

  console.log("");
  while (true) {
    const answer = await ask(c.prompt("  Choose an option (number): "));
    const choice = parseInt(answer, 10);
    if (choice >= 1 && choice <= options.length) return options[choice - 1];
    console.log(chalk.red("  Invalid choice. Please try again."));
  }
}

async function confirm(question) {
  while (true) {
    const answer = await ask(c.prompt(`  ${question} (y/n): `));
    const l = answer.toLowerCase();
    if (["s", "si", "y", "yes"].includes(l)) return true;
    if (["n", "no"].includes(l)) return false;
    console.log(c.muted("  Please answer with 'y' or 'n'"));
  }
}

function showBanner() {
  console.log("");
  console.log(c.title("  ╔══════════════════════════════════════════════╗"));
  console.log(c.title("  ║") + c.bold("        npm-guard  -  Protect your PC          ") + c.title("║"));
  console.log(c.title("  ║") + c.muted("    Scan npm packages before using them         ") + c.title("║"));
  console.log(c.title("  ╚══════════════════════════════════════════════╝"));
  console.log("");
  console.log(c.muted("  When you install a package with 'npm install', that package"));
  console.log(c.muted("  could run hidden commands on your computer."));
  console.log(c.muted("  npm-guard finds them BEFORE they can do any damage."));
}

function showExplanation() {
  console.log(`
  ${c.title("How does npm-guard work?")}
  ${c.divider}

  When you install a package with ${chalk.bold("npm install")}, that package
  can run automatic commands called ${chalk.bold("lifecycle scripts")}:

  ${c.accent("preinstall")}   -> Runs ${chalk.bold("BEFORE")} installation
  ${c.accent("postinstall")}  -> Runs ${chalk.bold("AFTER")} installation
  ${c.accent("prepare")}      -> Runs during preparation

  ${chalk.bold("The problem:")}
  A malicious package could use these scripts to:
  ${chalk.red("  - Steal your passwords and tokens")}
  ${chalk.red("  - Delete files from your computer")}
  ${chalk.red("  - Download malware from the internet")}
  ${chalk.red("  - Send your data to external servers")}

  ${chalk.bold("The solution:")}
  npm-guard analyzes every package ${chalk.bold("BEFORE")} you install it
  and warns you with a clear report.

  ${chalk.bold("Risk levels:")}
  ${chalk.green("  SICURO")}   - No suspicious commands. Safe to install!
  ${chalk.yellow("  BASSO")}    - Minimal commands, probably harmless
  ${chalk.hex("#FFA500")("  MEDIO")}    - Some commands to review
  ${chalk.red("  ALTO")}     - Dangerous commands, be careful
  ${chalk.bgRed.white("  CRITICO")}  - Very suspicious! Do not install without verification
`);
}

/**
 * Start interactive mode
 */
async function runInteractive(configOverrides = {}) {
  initReadline();
  showBanner();

  const engine = new NpmGuardEngine(configOverrides);
  let running = true;

  while (running) {
    const choice = await menu("What would you like to do?", [
      {
        label: chalk.bold("Check a package before installing it"),
        hint: "E.g.: you want to run 'npm install something' but first want to check if it's safe",
        action: "scan-one",
      },
      {
        label: chalk.bold("Check multiple packages at once"),
        hint: "Enter the names separated by spaces or commas",
        action: "scan-many",
      },
      {
        label: chalk.bold("Check all packages in my project"),
        hint: "Analyze the package.json file and all dependencies",
        action: "scan-project",
      },
      {
        label: chalk.bold("Learn how npm-guard works"),
        hint: "A simple explanation of what this tool does",
        action: "explain",
      },
      {
        label: chalk.bold("Exit"),
        action: "exit",
      },
    ]);

    switch (choice.action) {
      case "scan-one":
        await scanOneInteractive(engine);
        break;
      case "scan-many":
        await scanManyInteractive(engine);
        break;
      case "scan-project":
        await scanProjectInteractive(engine);
        break;
      case "explain":
        showExplanation();
        break;
      case "exit":
        running = false;
        break;
    }

    if (running) {
      console.log("");
      running = await confirm("Would you like to do something else?");
    }
  }

  console.log(c.accent("\n  See you next time! Your PC is safe.\n"));
  rl.close();
}

async function scanOneInteractive(engine) {
  console.log("");
  console.log(c.muted("  Enter the package name to check."));
  console.log(c.muted("  Example: express, lodash, react, axios"));
  console.log("");

  const name = await ask(c.prompt("  Package name: "));
  if (!name) {
    console.log(chalk.red("  No name entered."));
    return;
  }

  const spinner = createSpinner(`Analyzing "${name}"...`);
  const result = engine.scanPackage(name);

  if (result.error) {
    spinner.fail(`Package "${name}" not found`);
    console.log(c.muted("\n  Make sure you typed the name correctly."));
    return;
  }

  spinner.stop(`Analysis of "${name}" completed`);
  console.log(engine.formatResults([result]));

  if (result.risk.score === 0) {
    console.log(c.success(`  You can install it with: npm install ${name}`));
  }
}

async function scanManyInteractive(engine) {
  console.log("");
  console.log(c.muted("  Enter the names separated by spaces or commas."));
  console.log(c.muted("  Example: express lodash axios"));
  console.log("");

  const input = await ask(c.prompt("  Packages: "));
  const names = input.split(/[\s,]+/).filter(Boolean);

  if (names.length === 0) {
    console.log(chalk.red("  No packages entered."));
    return;
  }

  console.log("");
  const results = [];
  for (let i = 0; i < names.length; i++) {
    progressBar(i, names.length, names[i]);
    const result = engine.scanPackage(names[i]);
    if (!result.error) results.push(result);
  }
  progressBar(names.length, names.length, "Done!");

  if (results.length === 0) {
    console.log(chalk.red("\n  No packages found."));
    return;
  }

  console.log(engine.formatResults(results));
}

async function scanProjectInteractive(engine) {
  console.log("");
  console.log(c.muted("  Enter the path to your project folder."));
  console.log(c.muted("  Press Enter to use the current directory."));
  console.log("");

  const input = await ask(c.prompt("  Project path: "));
  const projectPath = path.resolve(input || process.cwd());

  if (!fs.existsSync(path.join(projectPath, "package.json"))) {
    console.log(chalk.red(`\n  Could not find 'package.json' in: ${projectPath}`));
    return;
  }

  const results = engine.scanProject(projectPath, (cur, total, name) => {
    progressBar(cur, total, name);
  });

  if (results.error) {
    console.log(chalk.red(`\n  ${results.error}`));
    return;
  }

  console.log(engine.formatResults(results));
}

module.exports = { runInteractive };
