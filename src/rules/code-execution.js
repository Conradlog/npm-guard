const { BaseRule } = require("./base-rule");

class CodeExecutionRule extends BaseRule {
  get name() {
    return "code-execution";
  }

  get description() {
    return "Detects dynamic or obfuscated code execution";
  }

  get patterns() {
    return [
      {
        pattern: /\beval\b/,
        id: "eval",
        severity: "critical",
        title: "eval (dynamic code execution)",
        description: "Executes dynamically generated code - impossible to know what it will do",
      },
      {
        pattern: /\bexec\b/,
        id: "exec",
        severity: "high",
        title: "exec (process execution)",
        description: "Starts another program on your computer",
      },
      {
        pattern: /\bbase64\b/,
        id: "base64",
        severity: "critical",
        title: "base64 (obfuscated decoding)",
        description: "Decodes hidden text - often used to conceal malicious code",
      },
      {
        pattern: /\bnode\s+-e\b/,
        id: "node-eval",
        severity: "high",
        title: "node -e (inline eval)",
        description: "Executes JavaScript code on the fly",
      },
      {
        pattern: /\bpython\b.*-c\b/,
        id: "python-eval",
        severity: "high",
        title: "python -c (inline eval)",
        description: "Executes Python code on the fly",
      },
      {
        pattern: /\bpowershell\b/i,
        id: "powershell",
        severity: "critical",
        title: "PowerShell (script execution)",
        description: "Executes advanced Windows commands",
      },
      {
        pattern: /\bcmd\b.*\/c\b/,
        id: "cmd",
        severity: "critical",
        title: "cmd /c (Windows execution)",
        description: "Executes commands in the Windows terminal",
      },
    ];
  }
}

module.exports = { CodeExecutionRule };
