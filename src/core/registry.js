const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Fetcher per il registry npm.
 * Classe astratta che permette di sostituire il metodo di fetch
 * (utile per test, cache, registry privati, ecc.)
 */
class RegistryFetcher {
  /**
   * Recupera il manifest di un pacchetto dal registry npm
   * @param {string} packageName - Nome del pacchetto (opzionalmente con @version)
   * @returns {object|null} Il manifest del pacchetto o null se non trovato
   */
  fetch(packageName) {
    try {
      const result = execSync(`npm view "${packageName}" --json 2>/dev/null`, {
        encoding: "utf-8",
        timeout: 15000,
      });
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  /**
   * Legge il package.json di un pacchetto installato localmente
   * @param {string} projectPath - Percorso del progetto
   * @param {string} packageName - Nome del pacchetto
   * @returns {object|null}
   */
  fetchLocal(projectPath, packageName) {
    const pkgPath = path.join(projectPath, "node_modules", packageName, "package.json");
    if (!fs.existsSync(pkgPath)) return null;

    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  }

  /**
   * Legge il package.json di un progetto
   * @param {string} projectPath - Percorso del progetto
   * @returns {object|null}
   */
  fetchProjectPackage(projectPath) {
    const pkgPath = path.join(projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) return null;

    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  }
}

module.exports = { RegistryFetcher };
