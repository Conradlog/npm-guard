const { BaseRule } = require("./base-rule");

class FileSystemRule extends BaseRule {
  get name() {
    return "file-system";
  }

  get description() {
    return "Detects suspicious file system operations";
  }

  get patterns() {
    return [
      {
        pattern: /\/etc\/passwd/,
        id: "etc-passwd",
        severity: "critical",
        title: "access to /etc/passwd",
        description: "Reads the system user list",
      },
      {
        pattern: /\/etc\/shadow/,
        id: "etc-shadow",
        severity: "critical",
        title: "access to /etc/shadow",
        description: "Attempts to read the system's encrypted passwords",
      },
      {
        pattern: /~\/\.ssh/,
        id: "ssh-keys",
        severity: "critical",
        title: "access to SSH keys",
        description: "Accesses your SSH keys (used to connect to servers)",
      },
      {
        pattern: /~\/\.npm/,
        id: "npm-config",
        severity: "high",
        title: "access to npm config",
        description: "Accesses the npm configuration",
      },
      {
        pattern: /\.npmrc/,
        id: "npmrc",
        severity: "critical",
        title: "access to .npmrc (token)",
        description: "Accesses the file containing your npm TOKENs (access credentials!)",
      },
      {
        pattern: /~\/\.aws/,
        id: "aws-credentials",
        severity: "critical",
        title: "access to AWS credentials",
        description: "Accesses your Amazon Web Services credentials",
      },
      {
        pattern: /~\/\.env/,
        id: "dotenv",
        severity: "critical",
        title: "access to .env file",
        description: "Accesses the environment variables file (often contains secrets)",
      },
      {
        pattern: /process\.env/,
        id: "process-env",
        severity: "high",
        title: "access to environment variables",
        description: "Reads your system's secret settings (passwords, tokens, etc.)",
      },
    ];
  }
}

module.exports = { FileSystemRule };
