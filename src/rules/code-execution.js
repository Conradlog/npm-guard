const { BaseRule } = require("./base-rule");

class CodeExecutionRule extends BaseRule {
  get name() {
    return "code-execution";
  }

  get description() {
    return "Rileva esecuzione di codice dinamico o offuscato";
  }

  get patterns() {
    return [
      {
        pattern: /\beval\b/,
        id: "eval",
        severity: "critical",
        title: "eval (esecuzione codice dinamico)",
        description: "Esegue codice generato al momento - impossibile sapere cosa fara'",
      },
      {
        pattern: /\bexec\b/,
        id: "exec",
        severity: "high",
        title: "exec (esecuzione processo)",
        description: "Avvia un altro programma sul tuo computer",
      },
      {
        pattern: /\bbase64\b/,
        id: "base64",
        severity: "critical",
        title: "base64 (decodifica offuscata)",
        description: "Decodifica testo nascosto - spesso usato per nascondere codice malevolo",
      },
      {
        pattern: /\bnode\s+-e\b/,
        id: "node-eval",
        severity: "high",
        title: "node -e (eval inline)",
        description: "Esegue codice JavaScript al volo",
      },
      {
        pattern: /\bpython\b.*-c\b/,
        id: "python-eval",
        severity: "high",
        title: "python -c (eval inline)",
        description: "Esegue codice Python al volo",
      },
      {
        pattern: /\bpowershell\b/i,
        id: "powershell",
        severity: "critical",
        title: "PowerShell (esecuzione script)",
        description: "Esegue comandi Windows avanzati",
      },
      {
        pattern: /\bcmd\b.*\/c\b/,
        id: "cmd",
        severity: "critical",
        title: "cmd /c (esecuzione Windows)",
        description: "Esegue comandi nel terminale Windows",
      },
    ];
  }
}

module.exports = { CodeExecutionRule };
