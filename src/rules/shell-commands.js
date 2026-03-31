const { BaseRule } = require("./base-rule");

class ShellCommandsRule extends BaseRule {
  get name() {
    return "shell-commands";
  }

  get description() {
    return "Detects generic shell commands that manipulate files or the system";
  }

  get patterns() {
    return [
      {
        pattern: /\becho\b/,
        id: "echo",
        severity: "low",
        title: "echo (arbitrary output)",
        description: "Displays a message in the terminal (usually harmless)",
      },
      {
        pattern: /\btouch\b/,
        id: "touch",
        severity: "medium",
        title: "touch (file creation)",
        description: "Creates an empty file on your computer",
      },
      {
        pattern: /\bmkdir\b/,
        id: "mkdir",
        severity: "medium",
        title: "mkdir (directory creation)",
        description: "Creates a folder on your computer",
      },
      {
        pattern: /\brm\s+-rf\b/,
        id: "rm-rf",
        severity: "critical",
        title: "rm -rf (recursive removal)",
        description: "Deletes entire folders and all their contents - DANGEROUS",
      },
      {
        pattern: /\brm\s(?!.*-rf)/,
        id: "rm",
        severity: "high",
        title: "rm (file removal)",
        description: "Deletes files from your computer",
      },
      {
        pattern: /\bcp\s/,
        id: "cp",
        severity: "medium",
        title: "cp (file copy)",
        description: "Copies files from one location to another",
      },
      {
        pattern: /\bmv\s/,
        id: "mv",
        severity: "medium",
        title: "mv (file move)",
        description: "Moves or renames files",
      },
      {
        pattern: /\bchmod\b/,
        id: "chmod",
        severity: "high",
        title: "chmod (permission change)",
        description: "Changes file permissions (who can read/modify them)",
      },
      {
        pattern: /\bchown\b/,
        id: "chown",
        severity: "high",
        title: "chown (ownership change)",
        description: "Changes the owner of files",
      },
      {
        pattern: /\bsudo\b/,
        id: "sudo",
        severity: "critical",
        title: "sudo (privileged execution)",
        description: "Runs commands as administrator - full system access",
      },
      {
        pattern: /\bcat\b.*>/,
        id: "cat-redirect",
        severity: "high",
        title: "cat > (file write)",
        description: "Writes content into a file",
      },
      {
        pattern: />\s*\//,
        id: "redirect-absolute",
        severity: "high",
        title: "redirect to absolute path",
        description: "Writes data to a specific location on the system",
      },
    ];
  }
}

module.exports = { ShellCommandsRule };
