/**
 * Classe base per tutte le regole di npm-guard.
 *
 * Per creare una regola personalizzata, estendi questa classe e implementa:
 * - `name` (getter): identificativo unico della regola
 * - `description` (getter): descrizione breve
 * - `patterns` (getter): array di pattern da cercare
 *
 * Ogni pattern e' un oggetto con:
 * - pattern: RegExp da testare contro il comando
 * - id: identificativo univoco del pattern
 * - severity: "low" | "medium" | "high" | "critical"
 * - title: titolo breve del problema
 * - description: spiegazione dettagliata (per utenti non esperti)
 *
 * @example
 * class MyRule extends BaseRule {
 *   get name() { return "my-rule"; }
 *   get description() { return "Controlla qualcosa di specifico"; }
 *   get patterns() {
 *     return [
 *       {
 *         pattern: /\bdangerous-cmd\b/,
 *         id: "dangerous-cmd",
 *         severity: "high",
 *         title: "Comando pericoloso",
 *         description: "Questo comando puo' fare X e Y"
 *       }
 *     ];
 *   }
 * }
 */
class BaseRule {
  /**
   * @returns {string} Identificativo univoco della regola
   */
  get name() {
    throw new Error("Le regole devono implementare il getter 'name'");
  }

  /**
   * @returns {string} Descrizione della regola
   */
  get description() {
    throw new Error("Le regole devono implementare il getter 'description'");
  }

  /**
   * @returns {Array<{pattern: RegExp, id: string, severity: string, title: string, description: string}>}
   */
  get patterns() {
    throw new Error("Le regole devono implementare il getter 'patterns'");
  }

  /**
   * Analizza un comando e restituisce i match trovati.
   * Override per logica di analisi personalizzata.
   *
   * @param {string} command - Il comando da analizzare
   * @param {object} context - Contesto aggiuntivo { hook, packageName, scripts }
   * @returns {Array<{id: string, severity: string, title: string, description: string}>}
   */
  analyze(command, context = {}) {
    const matches = [];

    for (const rule of this.patterns) {
      if (rule.pattern.test(command)) {
        matches.push({
          ruleGroup: this.name,
          id: rule.id,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
        });
      }
    }

    return matches;
  }
}

module.exports = { BaseRule };
