# Contributing to npm-guard

Thanks for your interest in contributing! Here's how you can help.

## Getting Started

```bash
git clone https://github.com/YOUR_USER/npm-guard.git
cd npm-guard
npm install
npm test
```

## Project Structure

```
npm-guard/
├── bin/cli.js              # CLI entry point
├── src/
│   ├── index.js            # Public API exports
│   ├── core/
│   │   ├── engine.js       # Main orchestrator
│   │   ├── config.js       # Configuration loader
│   │   └── registry.js     # npm registry fetcher
│   ├── rules/
│   │   ├── base-rule.js    # Base class for all rules
│   │   ├── index.js        # Rule loader
│   │   └── *.js            # Individual rule groups
│   ├── formatters/
│   │   ├── index.js        # Formatter registry
│   │   ├── text.js         # Terminal output
│   │   ├── json.js         # JSON for CI/CD
│   │   └── html.js         # HTML report
│   ├── plugins/
│   │   └── loader.js       # Plugin system
│   └── ui/
│       ├── interactive.js  # Interactive mode
│       ├── spinner.js      # Terminal animations
│       └── colors.js       # Color theme
├── plugins/
│   └── example-plugin/     # Example plugin
├── test/                   # Tests mirroring src/
└── docs/                   # Documentation
```

## How to Add a New Rule

1. Create a new file in `src/rules/` extending `BaseRule`
2. Register it in `src/rules/index.js`
3. Add tests in `test/rules/`
4. Run `npm test`

```js
const { BaseRule } = require("./base-rule");

class MyRule extends BaseRule {
  get name() { return "my-rule"; }
  get description() { return "What this rule checks"; }
  get patterns() {
    return [{
      pattern: /\bsuspicious-cmd\b/,
      id: "suspicious-cmd",
      severity: "high",
      title: "Short title",
      description: "User-friendly explanation of the risk"
    }];
  }
}
```

## How to Add a Formatter

1. Create a file in `src/formatters/` exporting a `format(results, options)` function
2. Register it in `src/formatters/index.js`
3. Add tests

## How to Create a Plugin

See `plugins/example-plugin/index.js` and `docs/PLUGINS.md`.

## Pull Request Guidelines

- One feature/fix per PR
- Add tests for new rules and formatters
- Run `npm test` before submitting
- Write clear commit messages
- Update documentation if needed

## Code Style

- 2 spaces indentation
- No semicolons (optional, follow existing style)
- Use `const`/`let`, never `var`
- Prefer descriptive names

## Reporting Issues

When reporting bugs, include:
- Node.js version (`node -v`)
- OS and version
- Steps to reproduce
- Expected vs actual behavior
