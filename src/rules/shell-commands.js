const { BaseRule } = require("./base-rule");

class ShellCommandsRule extends BaseRule {
  get name() {
    return "shell-commands";
  }

  get description() {
    return "Rileva comandi shell generici che manipolano file o il sistema";
  }

  get patterns() {
    return [
      {
        pattern: /\becho\b/,
        id: "echo",
        severity: "low",
        title: "echo (output arbitrario)",
        description: "Mostra un messaggio nel terminale (di solito innocuo)",
      },
      {
        pattern: /\btouch\b/,
        id: "touch",
        severity: "medium",
        title: "touch (creazione file)",
        description: "Crea un file vuoto sul tuo computer",
      },
      {
        pattern: /\bmkdir\b/,
        id: "mkdir",
        severity: "medium",
        title: "mkdir (creazione directory)",
        description: "Crea una cartella sul tuo computer",
      },
      {
        pattern: /\brm\s+-rf\b/,
        id: "rm-rf",
        severity: "critical",
        title: "rm -rf (rimozione ricorsiva)",
        description: "Cancella intere cartelle e tutto il loro contenuto - PERICOLOSO",
      },
      {
        pattern: /\brm\s(?!.*-rf)/,
        id: "rm",
        severity: "high",
        title: "rm (rimozione file)",
        description: "Cancella file dal tuo computer",
      },
      {
        pattern: /\bcp\s/,
        id: "cp",
        severity: "medium",
        title: "cp (copia file)",
        description: "Copia file da una posizione a un'altra",
      },
      {
        pattern: /\bmv\s/,
        id: "mv",
        severity: "medium",
        title: "mv (spostamento file)",
        description: "Sposta o rinomina file",
      },
      {
        pattern: /\bchmod\b/,
        id: "chmod",
        severity: "high",
        title: "chmod (modifica permessi)",
        description: "Cambia i permessi dei file (chi puo' leggerli/modificarli)",
      },
      {
        pattern: /\bchown\b/,
        id: "chown",
        severity: "high",
        title: "chown (modifica proprietario)",
        description: "Cambia il proprietario dei file",
      },
      {
        pattern: /\bsudo\b/,
        id: "sudo",
        severity: "critical",
        title: "sudo (esecuzione privilegiata)",
        description: "Esegue comandi come amministratore - accesso totale al sistema",
      },
      {
        pattern: /\bcat\b.*>/,
        id: "cat-redirect",
        severity: "high",
        title: "cat > (scrittura file)",
        description: "Scrive contenuto dentro un file",
      },
      {
        pattern: />\s*\//,
        id: "redirect-absolute",
        severity: "high",
        title: "redirect a percorso assoluto",
        description: "Scrive dati in un punto preciso del sistema",
      },
    ];
  }
}

module.exports = { ShellCommandsRule };
