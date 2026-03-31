const { BaseRule } = require("./base-rule");

/**
 * Advanced rule: detects obfuscation, suspicious paths, and known
 * supply-chain attack patterns. Uses combinatorial logic beyond regex.
 */
class ObfuscationRule extends BaseRule {
  get name() {
    return "obfuscation";
  }

  get description() {
    return "Detects obfuscated code, suspicious paths, and supply-chain attack patterns";
  }

  get patterns() {
    return [
      // ─── Suspicious paths ───
      {
        pattern: /\/tmp\//,
        id: "tmp-path",
        severity: "high",
        title: "/tmp path",
        description: "Uses the system's temporary folder - often used to hide malicious files",
      },
      {
        pattern: /\/dev\/tcp\//,
        id: "dev-tcp",
        severity: "critical",
        title: "/dev/tcp (reverse shell)",
        description: "Opens a network connection via /dev/tcp - classic reverse shell technique",
      },
      {
        pattern: /\/dev\/udp\//,
        id: "dev-udp",
        severity: "critical",
        title: "/dev/udp (UDP connection)",
        description: "Opens a hidden UDP connection via /dev/udp",
      },
      {
        pattern: /\/dev\/null/,
        id: "dev-null-redirect",
        severity: "medium",
        title: "redirect to /dev/null",
        description: "Hides command output - could be masking malicious activity",
      },

      // ─── String obfuscation ───
      {
        pattern: /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){3,}/i,
        id: "hex-string",
        severity: "critical",
        title: "long hex string",
        description: "Contains hex-obfuscated code - impossible to read what it does",
      },
      {
        pattern: /\\u[0-9a-f]{4}(?:\\u[0-9a-f]{4}){3,}/i,
        id: "unicode-escape",
        severity: "critical",
        title: "obfuscated Unicode sequence",
        description: "Contains text hidden with Unicode escapes",
      },
      {
        pattern: /atob\s*\(/,
        id: "atob",
        severity: "critical",
        title: "atob() (JS Base64 decode)",
        description: "Decodes Base64 strings in JavaScript - hides the real code",
      },
      {
        pattern: /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/,
        id: "buffer-base64",
        severity: "critical",
        title: "Buffer.from(base64)",
        description: "Decodes Base64 payload via Node.js Buffer",
      },
      {
        pattern: /String\.fromCharCode/,
        id: "fromcharcode",
        severity: "high",
        title: "String.fromCharCode",
        description: "Builds strings from character codes - obfuscation technique",
      },

      // ─── Silent download + execution ───
      {
        pattern: /curl\s[^|]*-s/,
        id: "curl-silent",
        severity: "critical",
        title: "silent curl (-s)",
        description: "Downloads data from the internet in silent mode - hides activity",
      },
      {
        pattern: /wget\s[^|]*-q/,
        id: "wget-quiet",
        severity: "critical",
        title: "quiet wget (-q)",
        description: "Downloads files from the internet without showing any output",
      },
      {
        pattern: />\s*\/dev\/null\s*2>&1/,
        id: "silent-execution",
        severity: "critical",
        title: "fully silenced execution",
        description: "Runs a command hiding ALL output - both normal and errors",
      },
      {
        pattern: /2>&1\s*>\s*\/dev\/null/,
        id: "silent-execution-alt",
        severity: "critical",
        title: "fully silenced execution",
        description: "Runs a command hiding ALL output (alternative syntax)",
      },

      // ─── Scheduled / persistence ───
      {
        pattern: /\bcrontab\b/,
        id: "crontab",
        severity: "critical",
        title: "crontab (scheduled task)",
        description: "Installs a recurring task on the system - can persist after package removal",
      },
      {
        pattern: /\bsystemctl\b/,
        id: "systemctl",
        severity: "critical",
        title: "systemctl (system service)",
        description: "Manipulates system services - can install persistent backdoors",
      },
      {
        pattern: /\blaunchctl\b/,
        id: "launchctl",
        severity: "critical",
        title: "launchctl (macOS service)",
        description: "Manipulates macOS services - can install persistent agents",
      },
    ];
  }

  /**
   * Advanced analysis: detects suspicious combinations
   */
  analyze(command, context = {}) {
    const matches = super.analyze(command, context);

    // Download + immediate execution (curl ... | sh/bash/node)
    const downloads = /\bcurl\b|\bwget\b/.test(command);
    const pipesExec = /\|\s*(?:sh|bash|node|python|perl|ruby)\b/.test(command);
    if (downloads && pipesExec) {
      matches.push({
        ruleGroup: this.name,
        id: "download-and-execute",
        severity: "critical",
        title: "download + immediate execution",
        description: "Downloads code from the internet and executes it immediately - classic supply-chain attack",
      });
    }

    // Heavy obfuscation: too many escape sequences
    const escapeCount = (command.match(/\\x[0-9a-f]{2}/gi) || []).length;
    if (escapeCount >= 10) {
      matches.push({
        ruleGroup: this.name,
        id: "heavy-obfuscation",
        severity: "critical",
        title: "heavy obfuscation",
        description: `Found ${escapeCount} escape sequences - the command is heavily obfuscated`,
      });
    }

    // Write to hidden path + execute
    const writesHidden = />\s*[./]*\./.test(command);
    const executes = /&&\s*(?:sh|bash|node|chmod\s+\+x)/.test(command);
    if (writesHidden && executes) {
      matches.push({
        ruleGroup: this.name,
        id: "drop-and-execute",
        severity: "critical",
        title: "hidden file write + execution",
        description: "Writes a hidden file (dotfile) then executes it - malware dropper pattern",
      });
    }

    return matches;
  }
}

module.exports = { ObfuscationRule };
