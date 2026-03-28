const { BaseRule } = require("./base-rule");

class FileSystemRule extends BaseRule {
  get name() {
    return "file-system";
  }

  get description() {
    return "Rileva operazioni sospette sul file system";
  }

  get patterns() {
    return [
      {
        pattern: /\/etc\/passwd/,
        id: "etc-passwd",
        severity: "critical",
        title: "accesso /etc/passwd",
        description: "Legge la lista degli utenti del sistema",
      },
      {
        pattern: /\/etc\/shadow/,
        id: "etc-shadow",
        severity: "critical",
        title: "accesso /etc/shadow",
        description: "Tenta di leggere le password cifrate del sistema",
      },
      {
        pattern: /~\/\.ssh/,
        id: "ssh-keys",
        severity: "critical",
        title: "accesso chiavi SSH",
        description: "Accede alle tue chiavi SSH (usate per connettersi a server)",
      },
      {
        pattern: /~\/\.npm/,
        id: "npm-config",
        severity: "high",
        title: "accesso config npm",
        description: "Accede alla configurazione di npm",
      },
      {
        pattern: /\.npmrc/,
        id: "npmrc",
        severity: "critical",
        title: "accesso .npmrc (token)",
        description: "Accede al file con i tuoi TOKEN npm (credenziali di accesso!)",
      },
      {
        pattern: /~\/\.aws/,
        id: "aws-credentials",
        severity: "critical",
        title: "accesso credenziali AWS",
        description: "Accede alle tue credenziali Amazon Web Services",
      },
      {
        pattern: /~\/\.env/,
        id: "dotenv",
        severity: "critical",
        title: "accesso file .env",
        description: "Accede al file con le variabili d'ambiente (spesso contiene segreti)",
      },
      {
        pattern: /process\.env/,
        id: "process-env",
        severity: "high",
        title: "accesso variabili d'ambiente",
        description: "Legge le impostazioni segrete del tuo sistema (password, token, ecc.)",
      },
    ];
  }
}

module.exports = { FileSystemRule };
