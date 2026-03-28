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
    const answer = await ask(c.prompt("  Scegli un'opzione (numero): "));
    const choice = parseInt(answer, 10);
    if (choice >= 1 && choice <= options.length) return options[choice - 1];
    console.log(chalk.red("  Scelta non valida. Riprova."));
  }
}

async function confirm(question) {
  while (true) {
    const answer = await ask(c.prompt(`  ${question} (s/n): `));
    const l = answer.toLowerCase();
    if (["s", "si", "y", "yes"].includes(l)) return true;
    if (["n", "no"].includes(l)) return false;
    console.log(c.muted("  Rispondi con 's' o 'n'"));
  }
}

function showBanner() {
  console.log("");
  console.log(c.title("  ╔══════════════════════════════════════════════╗"));
  console.log(c.title("  ║") + c.bold("        npm-guard  -  Proteggi il tuo PC       ") + c.title("║"));
  console.log(c.title("  ║") + c.muted("   Scansiona i pacchetti npm prima di usarli   ") + c.title("║"));
  console.log(c.title("  ╚══════════════════════════════════════════════╝"));
  console.log("");
  console.log(c.muted("  Quando installi un pacchetto con 'npm install', quel pacchetto"));
  console.log(c.muted("  potrebbe eseguire comandi nascosti sul tuo computer."));
  console.log(c.muted("  npm-guard li trova PRIMA che possano fare danni."));
}

function showExplanation() {
  console.log(`
  ${c.title("Come funziona npm-guard?")}
  ${c.divider}

  Quando installi un pacchetto con ${chalk.bold("npm install")}, quel pacchetto
  puo' eseguire dei comandi automatici chiamati ${chalk.bold("script lifecycle")}:

  ${c.accent("preinstall")}   -> Si esegue ${chalk.bold("PRIMA")} dell'installazione
  ${c.accent("postinstall")}  -> Si esegue ${chalk.bold("DOPO")} l'installazione
  ${c.accent("prepare")}      -> Si esegue durante la preparazione

  ${chalk.bold("Il problema:")}
  Un pacchetto malevolo potrebbe usare questi script per:
  ${chalk.red("  - Rubare le tue password e token")}
  ${chalk.red("  - Cancellare file dal tuo computer")}
  ${chalk.red("  - Scaricare virus da internet")}
  ${chalk.red("  - Inviare i tuoi dati a server esterni")}

  ${chalk.bold("La soluzione:")}
  npm-guard analizza ogni pacchetto ${chalk.bold("PRIMA")} che tu lo installi
  e ti avvisa con un report chiaro.

  ${chalk.bold("I livelli di rischio:")}
  ${chalk.green("  SICURO")}   - Nessun comando sospetto. Installa pure!
  ${chalk.yellow("  BASSO")}    - Comandi minimi, probabilmente innocui
  ${chalk.hex("#FFA500")("  MEDIO")}    - Alcuni comandi da verificare
  ${chalk.red("  ALTO")}     - Comandi pericolosi, fai attenzione
  ${chalk.bgRed.white("  CRITICO")}  - Molto sospetto! Non installare senza verifiche
`);
}

/**
 * Avvia la modalita' interattiva
 */
async function runInteractive(configOverrides = {}) {
  initReadline();
  showBanner();

  const engine = new NpmGuardEngine(configOverrides);
  let running = true;

  while (running) {
    const choice = await menu("Cosa vuoi fare?", [
      {
        label: chalk.bold("Controllare un pacchetto prima di installarlo"),
        hint: "Es: vuoi fare 'npm install qualcosa' ma prima vuoi controllare se e' sicuro",
        action: "scan-one",
      },
      {
        label: chalk.bold("Controllare piu' pacchetti insieme"),
        hint: "Scrivi i nomi separati da spazio o virgola",
        action: "scan-many",
      },
      {
        label: chalk.bold("Controllare tutti i pacchetti del mio progetto"),
        hint: "Analizza il file package.json e tutte le dipendenze",
        action: "scan-project",
      },
      {
        label: chalk.bold("Capire come funziona npm-guard"),
        hint: "Spiegazione semplice di cosa fa questo strumento",
        action: "explain",
      },
      {
        label: chalk.bold("Esci"),
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
      running = await confirm("Vuoi fare un'altra operazione?");
    }
  }

  console.log(c.accent("\n  Alla prossima! Il tuo PC e' al sicuro.\n"));
  rl.close();
}

async function scanOneInteractive(engine) {
  console.log("");
  console.log(c.muted("  Scrivi il nome del pacchetto da controllare."));
  console.log(c.muted("  Esempio: express, lodash, react, axios"));
  console.log("");

  const name = await ask(c.prompt("  Nome del pacchetto: "));
  if (!name) {
    console.log(chalk.red("  Nessun nome inserito."));
    return;
  }

  const spinner = createSpinner(`Sto analizzando "${name}"...`);
  const result = engine.scanPackage(name);

  if (result.error) {
    spinner.fail(`Pacchetto "${name}" non trovato`);
    console.log(c.muted("\n  Controlla di aver scritto il nome correttamente."));
    return;
  }

  spinner.stop(`Analisi di "${name}" completata`);
  console.log(engine.formatResults([result]));

  if (result.risk.score === 0) {
    console.log(c.success(`  Puoi installarlo con: npm install ${name}`));
  }
}

async function scanManyInteractive(engine) {
  console.log("");
  console.log(c.muted("  Scrivi i nomi separati da spazio o virgola."));
  console.log(c.muted("  Esempio: express lodash axios"));
  console.log("");

  const input = await ask(c.prompt("  Pacchetti: "));
  const names = input.split(/[\s,]+/).filter(Boolean);

  if (names.length === 0) {
    console.log(chalk.red("  Nessun pacchetto inserito."));
    return;
  }

  console.log("");
  const results = [];
  for (let i = 0; i < names.length; i++) {
    progressBar(i, names.length, names[i]);
    const result = engine.scanPackage(names[i]);
    if (!result.error) results.push(result);
  }
  progressBar(names.length, names.length, "Completato!");

  if (results.length === 0) {
    console.log(chalk.red("\n  Nessun pacchetto trovato."));
    return;
  }

  console.log(engine.formatResults(results));
}

async function scanProjectInteractive(engine) {
  console.log("");
  console.log(c.muted("  Inserisci il percorso della cartella del tuo progetto."));
  console.log(c.muted("  Premi Invio per usare la cartella corrente."));
  console.log("");

  const input = await ask(c.prompt("  Percorso progetto: "));
  const projectPath = path.resolve(input || process.cwd());

  if (!fs.existsSync(path.join(projectPath, "package.json"))) {
    console.log(chalk.red(`\n  Non ho trovato 'package.json' in: ${projectPath}`));
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
