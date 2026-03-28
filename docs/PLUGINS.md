# Plugin Guide

## What is a Plugin?

A plugin is a Node.js module that extends npm-guard with custom rules,
formatters, or safe patterns. Plugins use the same API as the core.

## Creating a Plugin

### Minimal Plugin

```js
// my-plugin/index.js
module.exports = {
  name: "my-plugin",
  version: "1.0.0",
  register(api) {
    // Your extensions here
  }
};
```

### Adding a Custom Rule

```js
const { BaseRule } = require("npm-guard");

class MyRule extends BaseRule {
  get name() { return "my-rule"; }
  get description() { return "Checks for something specific"; }
  get patterns() {
    return [{
      pattern: /\bdangerous-thing\b/,
      id: "dangerous-thing",
      severity: "high",
      title: "Dangerous thing detected",
      description: "This command does X which is risky because Y"
    }];
  }
}

module.exports = {
  name: "my-plugin",
  version: "1.0.0",
  register(api) {
    api.addRule(new MyRule());
  }
};
```

### Adding a Custom Formatter

```js
module.exports = {
  name: "csv-plugin",
  version: "1.0.0",
  register(api) {
    api.addFormatter("csv", {
      format(results) {
        const header = "name,version,risk_level,risk_score\n";
        const rows = results
          .filter(r => !r.error)
          .map(r => `${r.name},${r.version},${r.risk.level},${r.risk.score}`)
          .join("\n");
        return header + rows;
      }
    });
  }
};
```

### Adding Safe Patterns

```js
module.exports = {
  name: "company-plugin",
  version: "1.0.0",
  register(api) {
    // These commands won't trigger warnings
    api.addSafePattern(/\bour-internal-build-tool\b/);
    api.addSafePattern(/\bcompany-cli\b/);
  }
};
```

## Using a Plugin

### Local Plugin

```json
// .npmguardrc.json
{
  "plugins": ["./plugins/my-plugin"]
}
```

### npm Plugin

```bash
npm install npm-guard-plugin-my-rules
```

```json
{
  "plugins": ["npm-guard-plugin-my-rules"]
}
```

## Plugin API Reference

| Method | Description |
|--------|-------------|
| `api.addRule(rule)` | Add a rule instance (must extend `BaseRule`) |
| `api.addFormatter(name, formatter)` | Add a formatter `{ format(results, opts) → string }` |
| `api.addSafePattern(regex)` | Add a RegExp for commands that should be considered safe |

## Naming Convention

If publishing to npm, use the prefix `npm-guard-plugin-`:
- `npm-guard-plugin-company-rules`
- `npm-guard-plugin-crypto-detect`
- `npm-guard-plugin-csv-output`

## Example

See `plugins/example-plugin/` in the repository for a complete example
that adds a crypto-mining detection rule, a safe pattern, and a minimal
formatter.
