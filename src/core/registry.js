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
   * Recupera le dipendenze dirette di un pacchetto dal registry
   * @param {string} packageName - Nome del pacchetto (opzionalmente con @version)
   * @returns {object|null} Oggetto { dependencies, name, version } o null
   */
  fetchDependencies(packageName) {
    try {
      const result = execSync(
        `npm view "${packageName}" dependencies name version --json 2>/dev/null`,
        { encoding: "utf-8", timeout: 15000 }
      );
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  /**
   * Recupera le dipendenze di una versione precedente del pacchetto.
   * Utile per confrontare e individuare dipendenze iniettate.
   * @param {string} packageName - Nome base del pacchetto (senza versione)
   * @param {string} currentVersion - La versione corrente da cui tornare indietro
   * @returns {object|null} { dependencies, version } della versione precedente, o null
   */
  fetchPreviousVersionDeps(packageName, currentVersion) {
    try {
      // Recupera tutte le versioni disponibili
      const versionsRaw = execSync(
        `npm view "${packageName}" versions --json 2>/dev/null`,
        { encoding: "utf-8", timeout: 15000 }
      );
      const versions = JSON.parse(versionsRaw);
      if (!Array.isArray(versions) || versions.length < 2) return null;

      // Trova la versione immediatamente precedente a quella corrente
      const currentIdx = versions.indexOf(currentVersion);
      if (currentIdx <= 0) return null;

      const previousVersion = versions[currentIdx - 1];
      const prevData = this.fetchDependencies(`${packageName}@${previousVersion}`);
      if (!prevData) return null;

      return {
        version: previousVersion,
        dependencies: prevData.dependencies || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Recupera i timestamp di pubblicazione di un pacchetto (time field dal registry).
   * @param {string} packageName - Nome del pacchetto
   * @returns {object|null} Oggetto con { created, modified, [version]: timestamp }
   */
  fetchPackageTimestamps(packageName) {
    try {
      const result = execSync(
        `npm view "${packageName}" time --json 2>/dev/null`,
        { encoding: "utf-8", timeout: 15000 }
      );
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  /**
   * Risolve ricorsivamente l'intero albero delle dipendenze di un pacchetto.
   * Restituisce un array piatto di manifest (con scripts) per ogni dipendenza.
   * @param {string} packageName - Nome del pacchetto root
   * @param {number} maxDepth - Profondita' massima di ricorsione (default: 3)
   * @param {Set} visited - Set di pacchetti gia' visitati (per evitare cicli)
   * @returns {Array<object>} Array di { name, version, scripts, dependencies, depth }
   */
  fetchDependencyTree(packageName, maxDepth = 3, visited = new Set(), _manifestCache = new Map()) {
    const results = [];

    // Usa la cache per evitare fetch ridondanti
    let manifest = _manifestCache.get(packageName);
    if (!manifest) {
      manifest = this.fetch(packageName);
      if (manifest) _manifestCache.set(packageName, manifest);
    }
    if (!manifest) return results;

    const name = manifest.name;
    const version = manifest.version || manifest["dist-tags"]?.latest;
    const key = `${name}@${version}`;

    if (visited.has(key)) return results;
    visited.add(key);

    const deps = manifest.dependencies || {};
    const depEntries = Object.entries(deps);

    for (const [depName, depRange] of depEntries) {
      // Controlla visited prima del fetch per evitare chiamate di rete inutili
      const rangeKey = `${depName}@${depRange}`;
      if (visited.has(rangeKey)) continue;

      let depManifest = _manifestCache.get(depName);
      if (!depManifest) {
        depManifest = this.fetch(depName);
        if (depManifest) _manifestCache.set(depName, depManifest);
      }
      if (!depManifest) continue;

      const depVersion = depManifest.version || depManifest["dist-tags"]?.latest;
      const resolvedKey = `${depManifest.name}@${depVersion}`;
      if (visited.has(resolvedKey)) continue;

      results.push({
        name: depManifest.name,
        version: depVersion,
        scripts: depManifest.scripts || {},
        dependencies: depManifest.dependencies || {},
        depth: 1,
      });

      visited.add(resolvedKey);

      // Ricorsione sulle sotto-dipendenze (passa la cache)
      if (maxDepth > 1) {
        const subDeps = this.fetchDependencyTree(depManifest.name, maxDepth - 1, visited, _manifestCache);
        for (const sub of subDeps) {
          sub.depth = (sub.depth || 1) + 1;
          results.push(sub);
        }
      }
    }

    return results;
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
