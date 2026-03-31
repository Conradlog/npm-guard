const { BaseRule } = require("./base-rule");

/**
 * Regola avanzata: rileva dipendenze sospette iniettate in pacchetti legittimi.
 * Progettata per individuare attacchi come quello ad axios (marzo 2026):
 * - Dipendenze nuove rispetto alla versione precedente
 * - Pacchetti pubblicati di recente (< 7 giorni)
 * - Nomi di pacchetti che imitano librerie note (typosquatting)
 *
 * A differenza delle altre regole, questa non analizza i comandi degli script
 * ma riceve metadati sulle dipendenze tramite il campo context.
 */
class DependencyRiskRule extends BaseRule {
  get name() {
    return "dependency-risk";
  }

  get description() {
    return "Rileva dipendenze sospette: nuove, troppo recenti, o con nomi ingannevoli";
  }

  get patterns() {
    // Questa regola non usa pattern regex tradizionali.
    // L'analisi avviene in analyze() tramite i metadati nel context.
    return [];
  }

  /**
   * Analizza i metadati delle dipendenze per trovare segnali di attacco supply-chain.
   *
   * Il context deve contenere:
   * - context.dependencyAnalysis.newDependencies: array di { name, version } dipendenze nuove
   * - context.dependencyAnalysis.packageAges: oggetto { name: { ageInDays, publishedAt } }
   * - context.dependencyAnalysis.previousVersion: string della versione precedente
   *
   * @param {string} command - Il comando (non usato per questa regola)
   * @param {object} context - Contesto con metadati dipendenze
   * @returns {Array}
   */
  analyze(command, context = {}) {
    const matches = [];
    const analysis = context.dependencyAnalysis;
    if (!analysis) return matches;

    // 1. Dipendenze nuove rispetto alla versione precedente
    if (analysis.newDependencies && analysis.newDependencies.length > 0) {
      for (const dep of analysis.newDependencies) {
        matches.push({
          ruleGroup: this.name,
          id: "new-dependency",
          severity: "high",
          title: `nuova dipendenza: ${dep.name}`,
          description:
            `La dipendenza "${dep.name}" non esisteva nella versione precedente ` +
            `(${analysis.previousVersion || "sconosciuta"}). ` +
            `Potrebbe essere stata iniettata dopo la compromissione dell'account del maintainer.`,
        });
      }
    }

    // 2. Dipendenze pubblicate di recente (< 7 giorni)
    if (analysis.packageAges) {
      for (const [depName, ageInfo] of Object.entries(analysis.packageAges)) {
        if (ageInfo.ageInDays !== null && ageInfo.ageInDays < 7) {
          const severity = ageInfo.ageInDays < 1 ? "critical" : "high";
          matches.push({
            ruleGroup: this.name,
            id: "young-package",
            severity,
            title: `pacchetto molto recente: ${depName}`,
            description:
              `Il pacchetto "${depName}" e' stato pubblicato solo ${formatAge(ageInfo.ageInDays)} fa ` +
              `(${ageInfo.publishedAt}). I pacchetti appena creati usati come dipendenze ` +
              `di progetti affermati sono un forte indicatore di attacco supply-chain.`,
          });
        }
      }
    }

    // 3. Combinazione esplosiva: nuova dipendenza + giovane
    if (analysis.newDependencies && analysis.packageAges) {
      for (const dep of analysis.newDependencies) {
        const age = analysis.packageAges[dep.name];
        if (age && age.ageInDays !== null && age.ageInDays < 7) {
          matches.push({
            ruleGroup: this.name,
            id: "injected-young-dependency",
            severity: "critical",
            title: `dipendenza iniettata e appena creata: ${dep.name}`,
            description:
              `ALTO RISCHIO: "${dep.name}" e' una dipendenza nuova (non presente nella versione ` +
              `precedente) E il pacchetto e' stato creato solo ${formatAge(age.ageInDays)} fa. ` +
              `Questo e' il pattern esatto dell'attacco supply-chain ad axios (marzo 2026): ` +
              `account compromesso -> dipendenza malevola iniettata -> RAT installato via postinstall.`,
          });
        }
      }
    }

    // 4. Nomi sospetti (prefisso/suffisso di librerie note)
    if (analysis.newDependencies) {
      for (const dep of analysis.newDependencies) {
        const suspicious = detectSuspiciousName(dep.name);
        if (suspicious) {
          matches.push({
            ruleGroup: this.name,
            id: "suspicious-name",
            severity: "high",
            title: `nome sospetto: ${dep.name}`,
            description: suspicious,
          });
        }
      }
    }

    return matches;
  }
}

/**
 * Controlla se un nome di pacchetto imita una libreria nota
 */
function detectSuspiciousName(name) {
  // Librerie note che vengono spesso imitate
  const wellKnown = [
    "crypto-js", "lodash", "express", "axios", "react", "vue",
    "angular", "moment", "chalk", "commander", "inquirer", "request",
    "underscore", "debug", "uuid", "semver", "glob", "minimatch",
    "async", "bluebird", "cheerio", "passport", "mongoose", "sequelize",
  ];

  // Prefissi/suffissi sospetti aggiunti a nomi noti
  const suspiciousPrefixes = ["plain-", "simple-", "fast-", "lite-", "mini-", "pure-", "real-", "true-", "safe-", "my-"];
  const suspiciousSuffixes = ["-js", "-lib", "-util", "-helper", "-core", "-plus", "-pro", "-new"];

  for (const lib of wellKnown) {
    for (const prefix of suspiciousPrefixes) {
      if (name === prefix + lib) {
        return (
          `Il nome "${name}" sembra una copia di "${lib}" con il prefisso "${prefix}". ` +
          `Questo pattern e' tipico del typosquatting (es. "plain-crypto-js" usato nell'attacco ad axios).`
        );
      }
    }
    for (const suffix of suspiciousSuffixes) {
      if (name === lib + suffix) {
        return (
          `Il nome "${name}" sembra una copia di "${lib}" con il suffisso "${suffix}". ` +
          `Potrebbe essere un tentativo di typosquatting.`
        );
      }
    }
  }

  return null;
}

/**
 * Formatta l'eta' in modo leggibile
 */
function formatAge(days) {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours <= 1 ? "meno di un'ora" : `${hours} ore`;
  }
  if (days < 2) return "1 giorno";
  return `${Math.round(days)} giorni`;
}

module.exports = { DependencyRiskRule, detectSuspiciousName, formatAge };
