const { BaseRule } = require("./base-rule");

/**
 * Advanced rule with custom logic.
 * Demonstrates how to override the `analyze` method to add
 * analysis logic beyond simple pattern matching.
 */
class SensitiveFilesRule extends BaseRule {
  get name() {
    return "sensitive-files";
  }

  get description() {
    return "Detects access to sensitive files and data exfiltration attempts";
  }

  get patterns() {
    return [
      {
        pattern: /\.pem\b/,
        id: "pem-file",
        severity: "critical",
        title: "access to .pem file (certificate)",
        description: "Accesses certificate/private key files",
      },
      {
        pattern: /\.key\b/,
        id: "key-file",
        severity: "critical",
        title: "access to .key file (private key)",
        description: "Accesses private key files",
      },
      {
        pattern: /id_rsa/,
        id: "id-rsa",
        severity: "critical",
        title: "access to RSA key",
        description: "Accesses the RSA private key (SSH authentication)",
      },
      {
        pattern: /\.kube\/config/,
        id: "kube-config",
        severity: "critical",
        title: "access to Kubernetes config",
        description: "Accesses the Kubernetes cluster configuration",
      },
      {
        pattern: /\.docker\/config/,
        id: "docker-config",
        severity: "high",
        title: "access to Docker config",
        description: "Accesses the Docker configuration (may contain registry credentials)",
      },
    ];
  }

  /**
   * Advanced analysis logic: also checks for suspicious combinations
   */
  analyze(command, context = {}) {
    const matches = super.analyze(command, context);

    // Dangerous combination: file read + network send
    const readsFile = /\bcat\b|\bread\b|\bhead\b|\btail\b/.test(command);
    const sendsData = /\bcurl\b|\bwget\b|\bnc\b/.test(command);

    if (readsFile && sendsData) {
      matches.push({
        ruleGroup: this.name,
        id: "data-exfiltration",
        severity: "critical",
        title: "possible data exfiltration",
        description:
          "The command reads a file AND sends it over the network - could be stealing data from your computer",
      });
    }

    return matches;
  }
}

module.exports = { SensitiveFilesRule };
