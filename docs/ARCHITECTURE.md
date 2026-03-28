# Architecture

## Overview

npm-guard follows a modular, layered architecture designed for extensibility.

```
┌──────────────────────────────────────────────────┐
│                    CLI / UI                       │
│         bin/cli.js  +  src/ui/*                   │
├──────────────────────────────────────────────────┤
│                  Engine (core)                    │
│              src/core/engine.js                   │
│    Orchestrates: config, rules, scan, output      │
├────────────┬──────────────┬──────────────────────┤
│   Rules    │  Formatters  │      Plugins         │
│ src/rules/ │src/formatters│   src/plugins/       │
│ base-rule  │  text/json/  │   loader.js          │
│ 5 groups   │  html        │   custom rules/fmt   │
├────────────┴──────────────┴──────────────────────┤
│                  Registry                         │
│             src/core/registry.js                  │
│         npm view / node_modules / fs              │
├──────────────────────────────────────────────────┤
│                  Config                           │
│              src/core/config.js                   │
│    .npmguardrc.json / npmguard.config.js          │
└──────────────────────────────────────────────────┘
```

## Data Flow

```
User Input (package name)
    │
    ▼
Registry.fetch()          ← Fetches package manifest from npm
    │
    ▼
Engine.analyzeScripts()   ← Extracts lifecycle hooks
    │
    ▼
Rules[].analyze()         ← Each rule scans for its patterns
    │
    ▼
Engine.calculateRisk()    ← Aggregates severity scores
    │
    ▼
Formatter.format()        ← Renders output (text/json/html)
    │
    ▼
CLI Output / Exit Code
```

## Key Design Decisions

### 1. Rule-based System
Each rule group is an independent class extending `BaseRule`. This means:
- Rules can be added/removed without touching core code
- Custom rules via plugins use the same API
- Rules can override `analyze()` for complex logic (see `sensitive-files.js`)

### 2. Plugin System
Plugins receive an `api` object with three extension points:
- `addRule(rule)` - Add custom rule instances
- `addFormatter(name, formatter)` - Add output formats
- `addSafePattern(regex)` - Mark patterns as safe

### 3. Configuration Cascade
Config resolution: defaults → `.npmguardrc.json` → CLI flags

### 4. Formatter Abstraction
Output is completely decoupled from scanning. Any module exporting
`format(results, options) → string` can be a formatter.

### 5. Registry Abstraction
`RegistryFetcher` is a class that can be extended for:
- Private registries
- Caching layers
- Mock data in tests

## Extension Points

| What | How | Where |
|------|-----|-------|
| New rule group | Extend `BaseRule` | `src/rules/` or plugin |
| New output format | Export `format()` | `src/formatters/` or plugin |
| Safe patterns | Config or plugin | `.npmguardrc.json` |
| Custom registry | Extend `RegistryFetcher` | Plugin |
| Risk thresholds | Config | `.npmguardrc.json` |
