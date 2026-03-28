const chalk = require("chalk");

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Crea uno spinner animato nel terminale
 * @param {string} text - Testo da mostrare
 * @returns {{ stop: function, fail: function }}
 */
function createSpinner(text) {
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(FRAMES[i])} ${text}`);
    i = (i + 1) % FRAMES.length;
  }, 80);

  return {
    stop(finalText) {
      clearInterval(interval);
      process.stdout.write(`\r  ${chalk.green("✓")} ${finalText || text}\n`);
    },
    fail(finalText) {
      clearInterval(interval);
      process.stdout.write(`\r  ${chalk.red("✗")} ${finalText || text}\n`);
    },
  };
}

/**
 * Mostra una barra di progresso
 */
function progressBar(current, total, name) {
  const width = 30;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  const pct = Math.round((current / total) * 100);
  process.stdout.write(`\r  ${bar} ${pct}% - ${name}${"".padEnd(30)}`);
  if (current === total) console.log("");
}

module.exports = { createSpinner, progressBar };
