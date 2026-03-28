# npm-guard

> Zero-friction supply chain security for npm. Protects humans and AI agents from malicious lifecycle scripts.

When you run `npm install`, packages can execute hidden commands through lifecycle scripts (`preinstall`, `postinstall`). These scripts can steal tokens, delete files, install backdoors, or open reverse shells - silently, automatically.

**npm-guard** catches them **before** they run.

## Two Modes, One Engine

### For Humans: Transparent Wrapper
```bash
npm-guard setup     # One-time: wraps your npm command
npm install express  # npm-guard scans automatically, then installs
```

### For AI Agents: Explicit Check
```bash
npm-guard check express --json   # Machine-readable output
# AI agent parses JSON, decides whether to proceed
```

See [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) for the full AI integration protocol.

---

## Install

```bash
npm install -g npm-guard
```

## Quick Start

### Interactive Mode (beginners)

```bash
npm-guard
```

Guided menu with explanations in plain language.

### Check Mode (experts, CI, AI agents)

```bash
npm-guard check express              # Check one package
npm-guard check lodash axios react   # Check multiple
npm-guard check express --json       # JSON for machines
npm-guard check express --html       # HTML report
```

### Scan Mode (entire project)

```bash
npm-guard scan                       # Current project
npm-guard scan /path/to/project      # Specific path
npm-guard scan --json --fail-on high # CI/CD pipeline
```

### Wrapper Mode (transparent protection)

```bash
npm-guard setup      # Inject wrapper into .zshrc/.bashrc
npm-guard status     # Check if wrapper is active
npm-guard uninstall  # Remove wrapper
```

After setup, every `npm install <package>` is automatically scanned. If threats are found, the installation is blocked.

---

## What It Detects

### 6 Rule Groups (all pluggable)

| Rule Group | What it catches | Examples |
|------------|----------------|----------|
| **shell-commands** | File/system manipulation | `rm -rf`, `sudo`, `chmod`, `touch` |
| **network-access** | Unauthorized network calls | `curl`, `wget`, `netcat`, pipe to `sh` |
| **file-system** | Access to sensitive paths | `.npmrc`, `.ssh`, `.env`, `.aws`, `/etc/passwd` |
| **code-execution** | Dynamic/obfuscated execution | `eval`, `base64`, `node -e`, `PowerShell` |
| **sensitive-files** | Credential theft + exfiltration | `.pem`, `.key`, `id_rsa` + `cat | curl` combo |
| **obfuscation** | Supply-chain attack patterns | `/dev/tcp`, hex strings, `Buffer.from(base64)`, `crontab`, `launchctl`, silent execution |

### Advanced Detection (obfuscation rule)

The obfuscation rule goes beyond simple pattern matching with **combinatorial analysis**:

- **Download + Execute**: `curl ... | bash` detected as supply-chain attack
- **Silent execution**: `> /dev/null 2>&1` flagged when hiding output
- **Reverse shells**: `/dev/tcp` connections detected
- **Payload dropping**: write hidden file + `chmod +x` + execute
- **Heavy obfuscation**: counts hex escape sequences, flags if > 10
- **Persistence**: `crontab`, `systemctl`, `launchctl` for backdoor installation

---

## AI Agent Integration

npm-guard is designed to be used as a **security tool by AI coding agents**.

### Protocol

```bash
# 1. Check package
npm-guard check <package> --json

# 2. Parse response
# summary.maxRiskLevel: "SICURO" | "BASSO" | "MEDIO" | "ALTO" | "CRITICO"

# 3. Decision
# SICURO/BASSO → install
# MEDIO → install + inform user
# ALTO/CRITICO → DO NOT install, warn user
```

### Claude Code

Add to your project's `CLAUDE.md`:

```markdown
Before running `npm install` for new packages, always run:
`npm-guard check <package> --json`
If maxRiskLevel is ALTO or CRITICO, do not install.
```

Full protocol: [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md)

---

## Configuration

Create `.npmguardrc.json`:

```json
{
  "rules": {
    "shell-commands": true,
    "network-access": true,
    "file-system": true,
    "code-execution": true,
    "sensitive-files": true,
    "obfuscation": true
  },
  "ignore": ["trusted-package"],
  "failOn": "high",
  "format": "text"
}
```

See [`npmguard.config.example.js`](./npmguard.config.example.js) for all options.

## Plugins

Extend with custom rules, formatters, and safe patterns:

```js
const { BaseRule } = require("npm-guard");

class MyRule extends BaseRule {
  get name() { return "my-rule"; }
  get description() { return "Custom check"; }
  get patterns() {
    return [{
      pattern: /suspicious/,
      id: "suspicious",
      severity: "high",
      title: "Suspicious pattern",
      description: "Why this is dangerous"
    }];
  }
}

module.exports = {
  name: "my-plugin",
  register(api) { api.addRule(new MyRule()); }
};
```

See [Plugin Guide](./docs/PLUGINS.md).

## Use as Library

```js
const { NpmGuardEngine } = require("npm-guard");

const engine = new NpmGuardEngine({ format: "json" });
const result = engine.scanPackage("express");
const output = JSON.parse(engine.formatResults([result]));

if (output.summary.maxRiskLevel === "CRITICO") {
  console.error("Blocked!");
}
```

See [API Reference](./docs/API.md).

## Project Structure

```
npm-guard/
├── bin/cli.js              # CLI with subcommands
├── src/
│   ├── index.js            # Public API
│   ├── core/
│   │   ├── engine.js       # Orchestrator
│   │   ├── config.js       # Configuration
│   │   ├── registry.js     # npm registry (extensible)
│   │   └── wrapper.js      # Shell wrapper (setup/uninstall)
│   ├── rules/              # 6 rule groups (extensible)
│   ├── formatters/         # text, json, html (extensible)
│   ├── plugins/            # Plugin loader
│   └── ui/                 # Interactive mode
├── AI_INSTRUCTIONS.md      # Protocol for AI agents
├── plugins/example-plugin/ # Example plugin
├── test/                   # 60 tests
└── docs/                   # Architecture, API, Plugins
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
