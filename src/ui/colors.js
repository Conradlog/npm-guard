const chalk = require("chalk");

module.exports = {
  title: chalk.bold.cyan,
  subtitle: chalk.gray,
  success: chalk.green.bold,
  warning: chalk.yellow,
  danger: chalk.red,
  muted: chalk.gray,
  bold: chalk.bold.white,
  prompt: chalk.yellow,
  accent: chalk.cyan,
  divider: chalk.gray("─".repeat(50)),
};
