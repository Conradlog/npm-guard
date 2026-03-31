# npm-guard

> Zero-friction supply chain security for npm. Protects humans and AI agents from malicious lifecycle scripts and dependency injection attacks.

When you run `npm install`, packages can execute hidden commands through lifecycle scripts (`preinstall`, `postinstall`). These scripts can steal tokens, delete files, install backdoors, or open reverse shells - silently, automatically. Worse, a legitimate package can be compromised to inject a malicious dependency that carries the payload (as happened with the [axios supply-chain attack of March 2026](https://thehackernews.com/2026/03/axios-supply-chain-attack-pushes-cross.html)).

**npm-guard** catches them **before** they run.

## Two Modes, One Engine

### For Humans: Transparent Wrapper
```bash
npm-guard setup     # One-time: wraps your npm command
npm install express  # npm-guard deep-scans automatically, then installs
```

### For AI Agents: Explicit Check
```bash
npm-guard check express --deep --json   # Machine-readable deep scan
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
npm-guard check express              # Shallow check (lifecycle scripts only)
npm-guard check lodash axios react   # Check multiple packages
npm-guard check express --json       # JSON for machines
npm-guard check express --html       # HTML report
```

### Deep Scan Mode (supply-chain protection)

```bash
npm-guard check axios --deep         # Full dependency tree analysis
npm-guard check axios --deep --json  # Deep scan with JSON output
npm-guard check axios --deep --html  # Deep scan HTML report
```

The `--deep` flag enables:
- Recursive scanning of all transitive dependencies
- Detection of newly-injected dependencies vs. the previous version
- Package age verification (flags packages published < 7 days ago)
- Typosquatting name detection (e.g. `plain-crypto-js` mimicking `crypto-js`)

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

After setup, every `npm install <package>` is automatically deep-scanned. If threats are found, the installation is blocked.

---

## What It Detects

### 7 Rule Groups (all pluggable)

| Rule Group | What it catches | Examples |
|------------|----------------|----------|
| **shell-commands** | File/system manipulation | `rm -rf`, `sudo`, `chmod`, `touch` |
| **network-access** | Unauthorized network calls | `curl`, `wget`, `netcat`, pipe to `sh` |
| **file-system** | Access to sensitive paths | `.npmrc`, `.ssh`, `.env`, `.aws`, `/etc/passwd` |
| **code-execution** | Dynamic/obfuscated execution | `eval`, `base64`, `node -e`, `PowerShell` |
| **sensitive-files** | Credential theft + exfiltration | `.pem`, `.key`, `id_rsa` + `cat \| curl` combo |
| **obfuscation** | Supply-chain attack patterns | `/dev/tcp`, hex strings, `Buffer.from(base64)`, `crontab`, `launchctl`, silent execution |
| **dependency-risk** | Dependency injection attacks | New deps vs. previous version, young packages, typosquatting names |

### Advanced Detection (obfuscation rule)

The obfuscation rule goes beyond simple pattern matching with **combinatorial analysis**:

- **Download + Execute**: `curl ... | bash` detected as supply-chain attack
- **Silent execution**: `> /dev/null 2>&1` flagged when hiding output
- **Reverse shells**: `/dev/tcp` connections detected
- **Payload dropping**: write hidden file + `chmod +x` + execute
- **Heavy obfuscation**: counts hex escape sequences, flags if > 10
- **Persistence**: `crontab`, `systemctl`, `launchctl` for backdoor installation

### Supply-Chain Attack Detection (dependency-risk rule, `--deep`)

The dependency-risk rule, activated by the `--deep` flag, detects the exact attack pattern used in the axios compromise:

| Detection | Severity | What it catches |
|-----------|----------|-----------------|
| **New dependency** | HIGH | A dependency was added that didn't exist in the previous version |
| **Young package** | HIGH/CRITICAL | A dependency was published less than 7 days ago (CRITICAL if < 24h) |
| **Injected + young** | CRITICAL | New dependency AND recently published (strongest signal of compromise) |
| **Suspicious name** | HIGH | Name mimics a well-known library with prefix/suffix (e.g. `plain-crypto-js`) |

**Example**: if `axios@1.14.1` adds `plain-crypto-js` (published 20 hours ago, name mimics `crypto-js`), npm-guard would flag it with 4+ findings at CRITICAL level and block the installation.

---

## AI Agent Integration

npm-guard is designed to be used as a **security tool by AI coding agents**.

### Protocol

```bash
# 1. Deep-check package before install
npm-guard check <package> --deep --json

# 2. Parse response
# summary.maxRiskLevel: "SICURO" | "BASSO" | "MEDIO" | "ALTO" | "CRITICO"
# results[].depRiskFindings: supply-chain specific alerts
# results[].suspiciousDependencies: transitive deps with dangerous scripts

# 3. Decision
# SICURO/BASSO -> install
# MEDIO -> install + inform user
# ALTO/CRITICO -> DO NOT install, warn user
```

### Claude Code

Add to your project's `CLAUDE.md`:

```markdown
Before running `npm install` for new packages, always run:
`npm-guard check <package> --deep --json`
If maxRiskLevel is ALTO or CRITICO, do not install.
Check depRiskFindings for supply-chain indicators.
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
    "obfuscation": true,
    "dependency-risk": true
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

// Shallow scan
const engine = new NpmGuardEngine({ format: "json" });
const result = engine.scanPackage("express");
const output = JSON.parse(engine.formatResults([result]));

if (output.summary.maxRiskLevel === "CRITICO") {
  console.error("Blocked!");
}

// Deep scan (recommended)
const deep = engine.scanPackageDeep("axios");
const deepOutput = JSON.parse(engine.formatDeepResults([deep], { format: "json" }));

if (deepOutput.summary.maxRiskLevel === "CRITICO") {
  console.error("Supply-chain threat detected!");
  console.error("Alerts:", deep.depRiskFindings);
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
│   │   ├── engine.js       # Orchestrator (shallow + deep scan)
│   │   ├── config.js       # Configuration
│   │   ├── registry.js     # npm registry + dependency tree resolver
│   │   └── wrapper.js      # Shell wrapper (setup/uninstall)
│   ├── rules/              # 7 rule groups (extensible)
│   │   ├── shell-commands.js
│   │   ├── network-access.js
│   │   ├── file-system.js
│   │   ├── code-execution.js
│   │   ├── sensitive-files.js
│   │   ├── obfuscation.js
│   │   └── dependency-risk.js
│   ├── formatters/         # text, json, html (extensible)
│   ├── plugins/            # Plugin loader
│   └── ui/                 # Interactive mode
├── AI_INSTRUCTIONS.md      # Protocol for AI agents
├── plugins/example-plugin/ # Example plugin
├── test/                   # 95 tests
└── docs/                   # Architecture, API, Plugins
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
