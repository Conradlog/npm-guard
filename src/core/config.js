const fs = require("fs");
const path = require("path");

const CONFIG_FILES = [
  ".npmguardrc.json",
  ".npmguardrc",
  "npmguard.config.js",
  "npmguard.config.json",
];

const DEFAULT_CONFIG = {
  // Regole abilitate e loro severita' minima per il report
  rules: {
    "shell-commands": true,
    "network-access": true,
    "file-system": true,
    "code-execution": true,
    "sensitive-files": true,
    "obfuscation": true,
  },

  // Severita' minima da mostrare: "low" | "medium" | "high" | "critical"
  minSeverity: "low",

  // Soglie punteggio rischio
  thresholds: {
    low: 3,
    medium: 10,
    high: 14,
    // Sopra high = critico
  },

  // Pesi per severita'
  severityWeights: {
    low: 1,
    medium: 3,
    high: 7,
    critical: 15,
  },

  // Pacchetti da ignorare (fidati)
  ignore: [],

  // Pattern sicuri aggiuntivi (regex strings)
  safePatterns: [],

  // Plugin da caricare
  plugins: [],

  // Formato output: "text" | "json" | "html"
  format: "text",

  // Lingua: "it" | "en"
  lang: "it",

  // Exit code 1 se rischio >= questa soglia
  failOn: "critical",
};

/**
 * Cerca e carica il file di configurazione
 */
function loadConfig(projectPath) {
  const searchPath = projectPath || process.cwd();

  for (const filename of CONFIG_FILES) {
    const filePath = path.join(searchPath, filename);
    if (!fs.existsSync(filePath)) continue;

    if (filename.endsWith(".js")) {
      const userConfig = require(filePath);
      return mergeConfig(DEFAULT_CONFIG, userConfig);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const userConfig = JSON.parse(content);
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Merge ricorsivo della configurazione utente con i default
 */
function mergeConfig(defaults, overrides) {
  const result = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === "object" && !Array.isArray(value) && defaults[key]) {
      result[key] = mergeConfig(defaults[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

module.exports = { loadConfig, mergeConfig, DEFAULT_CONFIG, CONFIG_FILES };
