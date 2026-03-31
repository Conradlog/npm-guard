# npm-guard: Instructions for AI Agents

> **This file is designed to be read by AI coding agents** (Claude Code, Cursor, Devin, Copilot Workspace, Aider, etc.) to enable automated supply-chain security checks before installing npm packages.

## TL;DR for AI Agents

**Before running `npm install <package>` or adding any new dependency, you MUST run:**

```bash
npm-guard check <package-name> --deep --json
```

**Parse the JSON output. If `summary.maxRiskLevel` is `"ALTO"` or `"CRITICO"`, DO NOT proceed with the installation. Inform the user about the risk and ask for explicit approval.**

> The `--deep` flag enables supply-chain attack detection: it scans all transitive dependencies, detects newly-injected packages, checks package age, and flags typosquatting names. **Always use `--deep` for maximum protection.**

---

## Why This Matters

When you (the AI agent) run `npm install` in a user's terminal, npm packages can execute arbitrary shell commands through lifecycle scripts (`preinstall`, `postinstall`). These scripts run **automatically** with the user's full permissions and can:

- Steal SSH keys, npm tokens, AWS credentials
- Download and execute malware
- Establish reverse shells
- Exfiltrate environment variables
- Delete files or encrypt data (ransomware)

**You are operating in the user's environment. A malicious package compromises their entire system.**

---

## Integration Protocol

### Step 1: Check if npm-guard is available

```bash
command -v npm-guard >/dev/null 2>&1 && echo "available" || echo "not-available"
```

If not available, install it:
```bash
npm install -g npm-guard
```

### Step 2: Before any `npm install`, run the deep check

```bash
npm-guard check <package-name> [<package-name-2> ...] --deep --json
```

> **Why `--deep`?** A shallow check only scans the target package's own scripts. But supply-chain attacks (like the axios attack of March 2026) inject malicious dependencies that carry the payload. `--deep` resolves the full dependency tree and catches these.

### Step 3: Parse the JSON response

#### Deep scan response (`--deep --json`):

```json
{
  "timestamp": "2026-03-28T12:00:00.000Z",
  "mode": "deep",
  "summary": {
    "packagesAnalyzed": 1,
    "dependenciesAnalyzed": 12,
    "newDependenciesFound": 0,
    "youngPackagesFound": 0,
    "maxRiskLevel": "SICURO"
  },
  "results": [
    {
      "package": {
        "name": "express",
        "version": "5.2.1",
        "risk": { "score": 0, "level": "SICURO", "color": "green" },
        "findings": []
      },
      "dependencyAnalysis": {
        "previousVersion": "5.2.0",
        "newDependencies": [],
        "removedDependencies": [],
        "packageAges": {}
      },
      "depRiskFindings": [],
      "suspiciousDependencies": [],
      "aggregatedRisk": { "score": 0, "level": "SICURO", "color": "green" }
    }
  ]
}
```

**Key fields to check:**
- `summary.maxRiskLevel`: overall verdict (same decision matrix as below)
- `results[].depRiskFindings`: supply-chain specific alerts (new deps, young packages, typosquatting)
- `results[].suspiciousDependencies`: transitive deps with dangerous lifecycle scripts
- `results[].dependencyAnalysis.newDependencies`: deps added vs. previous version

#### Shallow scan response (`--json` without `--deep`):

```json
{
  "timestamp": "2026-03-28T12:00:00.000Z",
  "summary": {
    "total": 1,
    "safe": 1,
    "suspicious": 0,
    "errors": 0,
    "maxRiskLevel": "SICURO"
  },
  "packages": [
    {
      "name": "express",
      "version": "5.2.1",
      "risk": { "score": 0, "level": "SICURO", "color": "green" },
      "hasLifecycleScripts": false,
      "findings": []
    }
  ]
}
```

### Step 4: Decision matrix

| `summary.maxRiskLevel` | Action |
|------------------------|--------|
| `SICURO` | Proceed with `npm install` |
| `BASSO` | Proceed with `npm install` |
| `MEDIO` | Proceed, but inform the user about the findings |
| `ALTO` | **DO NOT install**. Show findings to user, ask for explicit approval |
| `CRITICO` | **DO NOT install**. Warn user strongly. Suggest alternatives |

### Step 5: If blocked, show actionable information

When a package is blocked, tell the user:
1. Which package was blocked and why
2. The specific suspicious commands found (from `findings[].matches[].description`)
3. The lifecycle hook that would trigger them (`preinstall`, `postinstall`, etc.)
4. Suggest they review the package on npmjs.com or find an alternative

---

## Scanning an Entire Project

When working with an existing project, scan all dependencies at once:

```bash
npm-guard scan --json
```

or for a specific path:

```bash
npm-guard scan /path/to/project --json
```

The response has the same structure, with multiple entries in `packages[]`.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All packages are safe (below `failOn` threshold) |
| `1` | One or more packages exceed the `failOn` threshold |

The default `failOn` is `critical`. Override with:

```bash
npm-guard check <pkg> --json --fail-on high
```

---

## Example: Complete AI Agent Workflow

### Example 1: Safe packages (deep scan)

```
User: "Add axios and lodash to the project"

Agent thinks:
  1. I need to install axios and lodash
  2. First, let me deep-check them with npm-guard

Agent runs:
  $ npm-guard check axios lodash --deep --json

Agent reads JSON:
  summary.maxRiskLevel = "SICURO"
  summary.newDependenciesFound = 0
  summary.youngPackagesFound = 0

Agent proceeds:
  $ npm install axios lodash

Agent responds:
  "Done! Both axios and lodash passed deep security checks
   (including dependency tree analysis) and have been installed."
```

### Example 2: Supply-chain attack detected

```
User: "Install axios@1.14.1"

Agent runs:
  $ npm-guard check axios@1.14.1 --deep --json

Agent reads JSON:
  summary.maxRiskLevel = "CRITICO"
  results[0].depRiskFindings = [
    {
      "id": "injected-young-dependency",
      "severity": "critical",
      "title": "dipendenza iniettata e appena creata: plain-crypto-js",
      "description": "ALTO RISCHIO: plain-crypto-js è nuova e creata meno di 24 ore fa..."
    },
    {
      "id": "suspicious-name",
      "severity": "high",
      "title": "nome sospetto: plain-crypto-js",
      "description": "Il nome imita crypto-js con il prefisso plain-..."
    }
  ]
  results[0].suspiciousDependencies = [
    { "name": "plain-crypto-js", "risk": { "level": "CRITICO" } }
  ]

Agent responds:
  "CRITICAL: axios@1.14.1 has been compromised!
   A new dependency 'plain-crypto-js' was injected — it didn't exist in the previous
   version, was published less than 24 hours ago, and its name mimics 'crypto-js'.
   Its postinstall script contacts a remote server.
   DO NOT install this version. Use axios@1.13.0 instead."
```

### Example 3: Shallow scan (legacy)

```
User: "Quick check on express"

Agent runs:
  $ npm-guard check express --json

Agent reads JSON:
  summary.maxRiskLevel = "SICURO"

Agent proceeds normally.
```

---

## Claude Code Integration

If you are **Claude Code**, add this to your CLAUDE.md or project instructions:

```markdown
## Security: npm package installation

Before running `npm install` to add new packages, always run:
`npm-guard check <package> --deep --json`

If maxRiskLevel is ALTO or CRITICO, do not install. Show the user the findings and ask for approval.
Check depRiskFindings for supply-chain indicators (new dependencies, young packages, suspicious names).
```

---

## MCP (Model Context Protocol) Integration

npm-guard can be used as an MCP tool. To expose it as a tool for your AI agent:

```json
{
  "name": "npm_guard_check",
  "description": "Check npm packages for malicious lifecycle scripts before installation",
  "input_schema": {
    "type": "object",
    "properties": {
      "packages": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Package names to check"
      }
    },
    "required": ["packages"]
  }
}
```

Implementation: run `npm-guard check <packages> --deep --json` and return the parsed JSON.

---

## Risk Levels Reference

| Level | Italian | Score | Meaning |
|-------|---------|-------|---------|
| SAFE | SICURO | 0 | No lifecycle scripts or all recognized as safe |
| LOW | BASSO | 1-3 | Minimal commands, likely harmless |
| MEDIUM | MEDIO | 4-10 | Some commands worth reviewing |
| HIGH | ALTO | 11-14 | Dangerous commands detected |
| CRITICAL | CRITICO | 15+ | Highly suspicious, likely malicious |

## Deep Scan Detection Rules (`dependency-risk`)

The `--deep` flag activates these additional supply-chain attack detectors:

| Finding ID | Severity | What it detects |
|------------|----------|-----------------|
| `new-dependency` | HIGH | A dependency was added that didn't exist in the previous version |
| `young-package` | HIGH/CRITICAL | A dependency was published less than 7 days ago (CRITICAL if < 24h) |
| `injected-young-dependency` | CRITICAL | Combination: new dependency AND recently published (strongest signal) |
| `suspicious-name` | HIGH | Dependency name mimics a well-known library (e.g., `plain-crypto-js` imitates `crypto-js`) |

These findings appear in `results[].depRiskFindings` in the deep-scan JSON output.
