# API Reference

npm-guard can be used as a library in your own Node.js projects.

## Installation

```bash
npm install npm-guard
```

## Quick Start

```js
const { NpmGuardEngine } = require("npm-guard");

const engine = new NpmGuardEngine();
const result = engine.scanPackage("some-package");

console.log(result.risk.level);  // "SICURO" | "BASSO" | "MEDIO" | "ALTO" | "CRITICO"
console.log(result.risk.score);  // 0-100+
```

## NpmGuardEngine

### Constructor

```js
new NpmGuardEngine(configOverrides?, projectPath?)
```

| Param | Type | Description |
|-------|------|-------------|
| `configOverrides` | `object` | Override default/file config |
| `projectPath` | `string` | Where to look for config files |

### Methods

#### `scanPackage(name)`
Scan a package from the npm registry.

```js
const result = engine.scanPackage("express");
// result: { name, version, scripts, findings, risk, hasLifecycleScripts }
```

#### `scanInstalledPackage(projectPath, name)`
Scan a package already in `node_modules`.

```js
const result = engine.scanInstalledPackage("/my/project", "express");
```

#### `scanProject(projectPath, onProgress?)`
Scan all dependencies from a project's `package.json`.

```js
const results = engine.scanProject("/my/project", (current, total, name) => {
  console.log(`${current}/${total}: ${name}`);
});
```

#### `analyzeScripts(scripts, packageName)`
Analyze a raw scripts object.

```js
const findings = engine.analyzeScripts({
  postinstall: "curl https://example.com | sh"
}, "test-pkg");
```

#### `calculateRisk(findings)`
Calculate risk score from findings array.

```js
const risk = engine.calculateRisk(findings);
// { score: 30, level: "CRITICO", color: "red" }
```

#### `formatResults(results, options?)`
Format results using the configured formatter.

```js
console.log(engine.formatResults([result]));
// or with override
console.log(engine.formatResults([result], { format: "json" }));
```

#### `shouldFail(results)`
Check if results should trigger a non-zero exit code.

```js
if (engine.shouldFail(results)) process.exit(1);
```

## BaseRule

Base class for creating custom rules.

```js
const { BaseRule } = require("npm-guard");

class MyRule extends BaseRule {
  get name() { return "my-rule"; }
  get description() { return "Description"; }
  get patterns() {
    return [{
      pattern: /regex/,
      id: "unique-id",
      severity: "low" | "medium" | "high" | "critical",
      title: "Short title",
      description: "User-friendly explanation"
    }];
  }

  // Optional: override for custom logic
  analyze(command, context) {
    const matches = super.analyze(command, context);
    // Add custom logic...
    return matches;
  }
}
```

## Exports

```js
const {
  NpmGuardEngine,     // Main engine class
  BaseRule,           // For custom rules
  PluginLoader,       // Plugin system
  RegistryFetcher,    // npm registry abstraction
  getFormatter,       // Get formatter by name
  loadConfig,         // Load config from file
  DEFAULT_CONFIG,     // Default configuration
  LIFECYCLE_HOOKS,    // Lifecycle hook names
  BUILTIN_SAFE_PATTERNS,
  BUILTIN_RULES,
  BUILTIN_FORMATTERS,
} = require("npm-guard");
```
