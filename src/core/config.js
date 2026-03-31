const fs = require("fs");
const path = require("path");

const CONFIG_FILES = [
  ".npmguardrc.json",
  ".npmguardrc",
  "npmguard.config.js",
  "npmguard.config.json",
];

const DEFAULT_CONFIG = {
  // Enabled rules and their minimum severity for the report
  rules: {
    "shell-commands": true,
    "network-access": true,
    "file-system": true,
    "code-execution": true,
    "sensitive-files": true,
    "obfuscation": true,
    "dependency-risk": true,
  },

  // Minimum severity to display: "low" | "medium" | "high" | "critical"
  minSeverity: "low",

  // Risk score thresholds
  thresholds: {
    low: 3,
    medium: 10,
    high: 14,
    // Above high = critical
  },

  // Severity weights
  severityWeights: {
    low: 1,
    medium: 3,
    high: 7,
    critical: 15,
  },

  // Packages to ignore (trusted)
  ignore: [],

  // Additional safe patterns (regex strings)
  safePatterns: [],

  // Plugins to load
  plugins: [],

  // Output format: "text" | "json" | "html"
  format: "text",

  // Language: "it" | "en"
  lang: "it",

  // Exit code 1 if risk >= this threshold
  failOn: "critical",
};

/**
 * Search for and load the configuration file
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
 * Recursive merge of user configuration with defaults
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
