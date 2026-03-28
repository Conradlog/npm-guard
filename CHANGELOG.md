# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-28

### Added
- **Shell wrapper**: `npm-guard setup` injects transparent wrapper into .zshrc/.bashrc
  - Automatic backup of shell config before injection
  - `npm-guard uninstall` to remove cleanly
  - `npm-guard status` to check wrapper state
- **AI Agent integration**: `AI_INSTRUCTIONS.md` with full protocol for Claude Code, Cursor, Devin, etc.
- **Subcommand CLI**: `check`, `scan`, `setup`, `uninstall`, `status`
- **Obfuscation rule group** (6th rule): detects supply-chain attack patterns
  - Reverse shells (`/dev/tcp`, `/dev/udp`)
  - Hex/Unicode escape obfuscation
  - `atob()`, `Buffer.from(base64)`, `String.fromCharCode`
  - Silent curl/wget (`-s`, `-q` flags)
  - Silent execution (`> /dev/null 2>&1`)
  - Persistence mechanisms (`crontab`, `systemctl`, `launchctl`)
  - Combinatorial analysis: download+execute, drop+execute, heavy obfuscation
- Backward compatibility with old CLI flags (`--scan`, `--installed`)

### Changed
- CLI restructured around subcommands (check, scan, setup)
- Default rule count: 5 → 6 (added obfuscation)
- Test count: 40 → 60

## [1.0.0] - 2026-03-28

### Added
- Initial release
- Core scanning engine with pluggable rule system
- 5 built-in rule groups: shell-commands, network-access, file-system, code-execution, sensitive-files
- Interactive CLI mode with guided menus
- Direct CLI mode for power users and CI/CD
- 3 output formatters: text, JSON, HTML
- Plugin system for custom rules, formatters, and safe patterns
- Configuration via `.npmguardrc.json` or `npmguard.config.js`
- Example plugin with crypto-mining detection
