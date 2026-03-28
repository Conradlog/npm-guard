const textFormatter = require("./text");
const jsonFormatter = require("./json");
const htmlFormatter = require("./html");

const BUILTIN_FORMATTERS = {
  text: textFormatter,
  json: jsonFormatter,
  html: htmlFormatter,
};

/**
 * Restituisce il formatter in base al nome
 * @param {string} name - Nome del formatter
 * @param {object} customFormatters - Formatters custom (da plugin)
 * @returns {{ format: function }}
 */
function getFormatter(name, customFormatters = {}) {
  const all = { ...BUILTIN_FORMATTERS, ...customFormatters };
  const formatter = all[name];

  if (!formatter) {
    throw new Error(
      `Formatter "${name}" non trovato. Disponibili: ${Object.keys(all).join(", ")}`
    );
  }

  return formatter;
}

module.exports = { getFormatter, BUILTIN_FORMATTERS };
