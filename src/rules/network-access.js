const { BaseRule } = require("./base-rule");

class NetworkAccessRule extends BaseRule {
  get name() {
    return "network-access";
  }

  get description() {
    return "Detects network access attempts (downloads, uploads, connections)";
  }

  get patterns() {
    return [
      {
        pattern: /\bcurl\b/,
        id: "curl",
        severity: "critical",
        title: "curl (network request)",
        description: "Downloads data from the internet or sends your data to an external server",
      },
      {
        pattern: /\bwget\b/,
        id: "wget",
        severity: "critical",
        title: "wget (file download)",
        description: "Downloads files from the internet to your computer",
      },
      {
        pattern: /\bnc\b/,
        id: "netcat",
        severity: "critical",
        title: "netcat (network connection)",
        description: "Opens a hidden network connection",
      },
      {
        pattern: /\|\s*sh\b/,
        id: "pipe-sh",
        severity: "critical",
        title: "pipe to shell",
        description: "Passes data directly to the shell to execute as commands",
      },
      {
        pattern: /\|\s*bash\b/,
        id: "pipe-bash",
        severity: "critical",
        title: "pipe to bash",
        description: "Passes data directly to bash to execute as commands",
      },
    ];
  }
}

module.exports = { NetworkAccessRule };
