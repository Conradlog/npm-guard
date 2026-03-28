const { BaseRule } = require("./base-rule");

/**
 * Regola avanzata: rileva offuscamento, percorsi sospetti, e pattern
 * di attacco supply-chain noti. Usa logica combinata oltre al regex.
 */
class ObfuscationRule extends BaseRule {
  get name() {
    return "obfuscation";
  }

  get description() {
    return "Rileva codice offuscato, percorsi sospetti e pattern di attacco supply-chain";
  }

  get patterns() {
    return [
      // ─── Percorsi sospetti ───
      {
        pattern: /\/tmp\//,
        id: "tmp-path",
        severity: "high",
        title: "percorso /tmp",
        description: "Usa la cartella temporanea del sistema - spesso usata per nascondere file malevoli",
      },
      {
        pattern: /\/dev\/tcp\//,
        id: "dev-tcp",
        severity: "critical",
        title: "/dev/tcp (reverse shell)",
        description: "Apre una connessione di rete via /dev/tcp - tecnica classica di reverse shell",
      },
      {
        pattern: /\/dev\/udp\//,
        id: "dev-udp",
        severity: "critical",
        title: "/dev/udp (connessione UDP)",
        description: "Apre una connessione UDP nascosta via /dev/udp",
      },
      {
        pattern: /\/dev\/null/,
        id: "dev-null-redirect",
        severity: "medium",
        title: "redirect a /dev/null",
        description: "Nasconde l'output di un comando - potrebbe mascherare attivita' malevola",
      },

      // ─── Offuscamento stringhe ───
      {
        pattern: /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){3,}/i,
        id: "hex-string",
        severity: "critical",
        title: "stringa esadecimale lunga",
        description: "Contiene codice offuscato in esadecimale - impossibile leggere cosa fa",
      },
      {
        pattern: /\\u[0-9a-f]{4}(?:\\u[0-9a-f]{4}){3,}/i,
        id: "unicode-escape",
        severity: "critical",
        title: "sequenza Unicode offuscata",
        description: "Contiene testo mascherato con escape Unicode",
      },
      {
        pattern: /atob\s*\(/,
        id: "atob",
        severity: "critical",
        title: "atob() (decodifica Base64 JS)",
        description: "Decodifica stringhe Base64 in JavaScript - nasconde il codice reale",
      },
      {
        pattern: /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/,
        id: "buffer-base64",
        severity: "critical",
        title: "Buffer.from(base64)",
        description: "Decodifica payload Base64 tramite Node.js Buffer",
      },
      {
        pattern: /String\.fromCharCode/,
        id: "fromcharcode",
        severity: "high",
        title: "String.fromCharCode",
        description: "Costruisce stringhe da codici numerici - tecnica di offuscamento",
      },

      // ─── Download + esecuzione silenziata ───
      {
        pattern: /curl\s[^|]*-s/,
        id: "curl-silent",
        severity: "critical",
        title: "curl silenzioso (-s)",
        description: "Scarica dati da internet in modalita' silenziosa - nasconde l'attivita'",
      },
      {
        pattern: /wget\s[^|]*-q/,
        id: "wget-quiet",
        severity: "critical",
        title: "wget silenzioso (-q)",
        description: "Scarica file da internet senza mostrare nulla a schermo",
      },
      {
        pattern: />\s*\/dev\/null\s*2>&1/,
        id: "silent-execution",
        severity: "critical",
        title: "esecuzione completamente silenziata",
        description: "Esegue un comando nascondendo TUTTO l'output - sia normale che errori",
      },
      {
        pattern: /2>&1\s*>\s*\/dev\/null/,
        id: "silent-execution-alt",
        severity: "critical",
        title: "esecuzione completamente silenziata",
        description: "Esegue un comando nascondendo TUTTO l'output (sintassi alternativa)",
      },

      // ─── Scheduled / persistence ───
      {
        pattern: /\bcrontab\b/,
        id: "crontab",
        severity: "critical",
        title: "crontab (task schedulato)",
        description: "Installa un'attivita' ricorrente sul sistema - puo' persistere dopo la rimozione del pacchetto",
      },
      {
        pattern: /\bsystemctl\b/,
        id: "systemctl",
        severity: "critical",
        title: "systemctl (servizio di sistema)",
        description: "Manipola servizi di sistema - puo' installare backdoor persistenti",
      },
      {
        pattern: /\blaunchctl\b/,
        id: "launchctl",
        severity: "critical",
        title: "launchctl (servizio macOS)",
        description: "Manipola servizi macOS - puo' installare agenti persistenti",
      },
    ];
  }

  /**
   * Analisi avanzata: rileva combinazioni sospette
   */
  analyze(command, context = {}) {
    const matches = super.analyze(command, context);

    // Download + esecuzione immediata (curl ... | sh/bash/node)
    const downloads = /\bcurl\b|\bwget\b/.test(command);
    const pipesExec = /\|\s*(?:sh|bash|node|python|perl|ruby)\b/.test(command);
    if (downloads && pipesExec) {
      matches.push({
        ruleGroup: this.name,
        id: "download-and-execute",
        severity: "critical",
        title: "download + esecuzione immediata",
        description: "Scarica codice da internet e lo esegue immediatamente - attacco supply-chain classico",
      });
    }

    // Offuscamento pesante: troppe escape sequences
    const escapeCount = (command.match(/\\x[0-9a-f]{2}/gi) || []).length;
    if (escapeCount >= 10) {
      matches.push({
        ruleGroup: this.name,
        id: "heavy-obfuscation",
        severity: "critical",
        title: "offuscamento pesante",
        description: `Trovate ${escapeCount} sequenze escape - il comando e' pesantemente offuscato`,
      });
    }

    // Scrittura in percorso nascosto + esecuzione
    const writesHidden = />\s*[./]*\./.test(command);
    const executes = /&&\s*(?:sh|bash|node|chmod\s+\+x)/.test(command);
    if (writesHidden && executes) {
      matches.push({
        ruleGroup: this.name,
        id: "drop-and-execute",
        severity: "critical",
        title: "scrittura file nascosto + esecuzione",
        description: "Scrive un file nascosto (dotfile) e poi lo esegue - pattern di dropper malware",
      });
    }

    return matches;
  }
}

module.exports = { ObfuscationRule };
