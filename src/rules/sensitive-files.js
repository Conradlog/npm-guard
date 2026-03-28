const { BaseRule } = require("./base-rule");

/**
 * Regola avanzata con logica personalizzata.
 * Dimostra come sovrascrivere il metodo `analyze` per aggiungere
 * logica di analisi oltre ai semplici pattern matching.
 */
class SensitiveFilesRule extends BaseRule {
  get name() {
    return "sensitive-files";
  }

  get description() {
    return "Rileva accesso a file sensibili e tentativi di esfiltrazione dati";
  }

  get patterns() {
    return [
      {
        pattern: /\.pem\b/,
        id: "pem-file",
        severity: "critical",
        title: "accesso file .pem (certificato)",
        description: "Accede a file di certificato/chiave privata",
      },
      {
        pattern: /\.key\b/,
        id: "key-file",
        severity: "critical",
        title: "accesso file .key (chiave privata)",
        description: "Accede a file di chiave privata",
      },
      {
        pattern: /id_rsa/,
        id: "id-rsa",
        severity: "critical",
        title: "accesso chiave RSA",
        description: "Accede alla chiave privata RSA (autenticazione SSH)",
      },
      {
        pattern: /\.kube\/config/,
        id: "kube-config",
        severity: "critical",
        title: "accesso config Kubernetes",
        description: "Accede alla configurazione dei cluster Kubernetes",
      },
      {
        pattern: /\.docker\/config/,
        id: "docker-config",
        severity: "high",
        title: "accesso config Docker",
        description: "Accede alla configurazione Docker (potrebbe contenere credenziali registry)",
      },
    ];
  }

  /**
   * Logica di analisi avanzata: controlla anche combinazioni sospette
   */
  analyze(command, context = {}) {
    const matches = super.analyze(command, context);

    // Combinazione pericolosa: lettura file + invio rete
    const readsFile = /\bcat\b|\bread\b|\bhead\b|\btail\b/.test(command);
    const sendsData = /\bcurl\b|\bwget\b|\bnc\b/.test(command);

    if (readsFile && sendsData) {
      matches.push({
        ruleGroup: this.name,
        id: "data-exfiltration",
        severity: "critical",
        title: "possibile esfiltrazione dati",
        description:
          "Il comando legge un file E lo invia via rete - potrebbe rubare dati dal tuo computer",
      });
    }

    return matches;
  }
}

module.exports = { SensitiveFilesRule };
