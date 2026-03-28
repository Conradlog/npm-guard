# npm-guard: Instructions for AI Agents

> **This file is designed to be read by AI coding agents** (Claude Code, Cursor, Devin, Copilot Workspace, Aider, etc.) to enable automated supply-chain security checks before installing npm packages.

## TL;DR for AI Agents

**Before running `npm install <package>` or adding any new dependency, you MUST run:**

```bash
npm-guard check <package-name> --json
```

**Parse the JSON output. If `summary.maxRiskLevel` is `"ALTO"` or `"CRITICO"`, DO NOT proceed with the installation. Inform the user about the risk and ask for explicit approval.**

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

### Step 2: Before any `npm install`, run the check

```bash
npm-guard check <package-name> [<package-name-2> ...] --json
```

### Step 3: Parse the JSON response

The response structure:

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
      "risk": {
        "score": 0,
        "level": "SICURO",
        "color": "green"
      },
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

```
User: "Add axios and lodash to the project"

Agent thinks:
  1. I need to install axios and lodash
  2. First, let me check them with npm-guard

Agent runs:
  $ npm-guard check axios lodash --json

Agent reads JSON:
  summary.maxRiskLevel = "SICURO"
  summary.safe = 2

Agent proceeds:
  $ npm install axios lodash

Agent responds:
  "Done! Both axios and lodash passed security checks and have been installed."
```

```
User: "Install super-cool-package"

Agent runs:
  $ npm-guard check super-cool-package --json

Agent reads JSON:
  summary.maxRiskLevel = "CRITICO"
  packages[0].findings[0].matches = [
    { "severity": "critical", "description": "Scarica dati da internet e li esegue immediatamente" }
  ]

Agent responds:
  "I found a critical security issue with super-cool-package.
   Its postinstall script downloads and executes code from the internet.
   I recommend NOT installing this package. Would you like me to find a safer alternative?"
```

---

## Claude Code Integration

If you are **Claude Code**, add this to your CLAUDE.md or project instructions:

```markdown
## Security: npm package installation

Before running `npm install` to add new packages, always run:
`npm-guard check <package> --json`

If maxRiskLevel is ALTO or CRITICO, do not install. Show the user the findings and ask for approval.
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

Implementation: run `npm-guard check <packages> --json` and return the parsed JSON.

---

## Risk Levels Reference

| Level | Italian | Score | Meaning |
|-------|---------|-------|---------|
| SAFE | SICURO | 0 | No lifecycle scripts or all recognized as safe |
| LOW | BASSO | 1-3 | Minimal commands, likely harmless |
| MEDIUM | MEDIO | 4-10 | Some commands worth reviewing |
| HIGH | ALTO | 11-14 | Dangerous commands detected |
| CRITICAL | CRITICO | 15+ | Highly suspicious, likely malicious |
