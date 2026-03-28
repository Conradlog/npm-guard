const path = require("path");
const fs = require("fs");

/**
 * Sistema di plugin per npm-guard.
 *
 * Un plugin e' un modulo Node.js che esporta una funzione `register`.
 * La funzione riceve un oggetto `api` con metodi per estendere npm-guard:
 *
 * @example
 * // mio-plugin/index.js
 * module.exports = {
 *   name: "mio-plugin",
 *   version: "1.0.0",
 *   register(api) {
 *     // Aggiungere una regola personalizzata
 *     api.addRule(new MiaRegola());
 *
 *     // Aggiungere un formatter personalizzato
 *     api.addFormatter("mio-formato", mioFormatter);
 *
 *     // Aggiungere pattern sicuri
 *     api.addSafePattern(/\bmy-safe-tool\b/);
 *   }
 * };
 */

class PluginLoader {
  constructor() {
    this.plugins = [];
    this.customRules = [];
    this.customFormatters = {};
    this.customSafePatterns = [];
  }

  /**
   * L'API esposta ai plugin
   */
  get api() {
    return {
      addRule: (rule) => this.customRules.push(rule),
      addFormatter: (name, fn) => (this.customFormatters[name] = fn),
      addSafePattern: (pattern) => this.customSafePatterns.push(pattern),
    };
  }

  /**
   * Carica i plugin dalla configurazione
   * @param {string[]} pluginNames - Nomi dei plugin (moduli npm o percorsi locali)
   * @param {string} basePath - Percorso base per i plugin locali
   */
  load(pluginNames, basePath) {
    for (const name of pluginNames) {
      try {
        let plugin;

        // Prova prima come percorso relativo
        const localPath = path.resolve(basePath, name);
        if (fs.existsSync(localPath) || fs.existsSync(localPath + ".js")) {
          plugin = require(localPath);
        } else {
          // Altrimenti come modulo npm
          plugin = require(name);
        }

        if (typeof plugin.register !== "function") {
          console.error(`Plugin "${name}": manca la funzione register()`);
          continue;
        }

        plugin.register(this.api);
        this.plugins.push({ name: plugin.name || name, version: plugin.version || "0.0.0" });
      } catch (err) {
        console.error(`Errore caricamento plugin "${name}": ${err.message}`);
      }
    }
  }
}

module.exports = { PluginLoader };
