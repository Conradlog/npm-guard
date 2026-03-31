const fs = require("fs");
const path = require("path");
const os = require("os");

// Marker to identify the injected block
const MARKER_START = "# >>> npm-guard wrapper (DO NOT EDIT) >>>";
const MARKER_END = "# <<< npm-guard wrapper <<<";

/**
 * Shell script that overrides the npm command to intercept npm install.
 * If npm-guard is installed globally, it uses it; otherwise falls back to npx.
 */
const WRAPPER_SCRIPT = `
${MARKER_START}
# npm-guard: intercepts npm install to scan packages before installation
npm() {
  local cmd="\$1"

  # Intercept only "npm install" and "npm i" (not "npm ci", "npm test", etc.)
  if [[ "\$cmd" == "install" || "\$cmd" == "i" ]]; then
    shift  # Remove "install"/"i"

    # Separate flags (--save-dev, --global, etc.) from package names
    local packages=()
    local flags=()
    for arg in "\$@"; do
      if [[ "\$arg" == -* ]]; then
        flags+=("\$arg")
      else
        packages+=("\$arg")
      fi
    done

    # If there are specific packages, scan them first
    if [[ \${#packages[@]} -gt 0 ]]; then
      echo ""
      echo "\\033[36m  npm-guard:\\033[0m Deep scanning packages..."
      echo ""

      # Use the global binary or npx as fallback (array to avoid word-splitting)
      local guard_cmd=()
      if command -v npm-guard &> /dev/null; then
        guard_cmd=("npm-guard")
      else
        guard_cmd=("npx" "--yes" "npm-guard")
      fi

      # Run the deep scan with JSON output for reliable parsing
      local scan_output
      scan_output=$("\${guard_cmd[@]}" check "\${packages[@]}" --deep --json 2>/dev/null)
      local scan_exit=\$?

      if [[ \$scan_exit -ne 0 ]]; then
        echo ""
        # Also show human-readable output with deep scan
        "\${guard_cmd[@]}" check "\${packages[@]}" --deep 2>/dev/null
        echo ""
        echo "\\033[31m  npm-guard: BLOCKED - Threats found in packages!\\033[0m"
        echo "\\033[33m  To install anyway: command npm \$cmd \"\${flags[@]}\" \"\${packages[@]}\"\\033[0m"
        echo ""
        return 1
      else
        echo "\\033[32m  npm-guard: All packages are safe.\\033[0m"
        echo ""
      fi
    fi

    # Proceed with the actual installation
    command npm "\$cmd" "\${flags[@]}" "\${packages[@]}"
  else
    # For all other npm commands, run normally
    command npm "\$@"
  fi
}
${MARKER_END}
`;

/**
 * Detect the user's current shell
 * @returns {{ shell: string, rcFile: string }}
 */
function detectShell() {
  const shell = process.env.SHELL || "/bin/bash";
  const home = os.homedir();

  if (shell.includes("zsh")) {
    return { shell: "zsh", rcFile: path.join(home, ".zshrc") };
  }
  if (shell.includes("fish")) {
    return { shell: "fish", rcFile: path.join(home, ".config", "fish", "config.fish") };
  }
  // Default: bash
  return { shell: "bash", rcFile: path.join(home, ".bashrc") };
}

/**
 * Check if the wrapper is already installed
 * @param {string} rcFile - Path to the rc file
 * @returns {boolean}
 */
function isInstalled(rcFile) {
  if (!fs.existsSync(rcFile)) return false;
  const content = fs.readFileSync(rcFile, "utf-8");
  return content.includes(MARKER_START);
}

/**
 * Install the wrapper in the user's shell
 * @param {string} rcFile - Path to the rc file (optional, autodetect)
 * @returns {{ success: boolean, rcFile: string, backupFile: string|null, error?: string }}
 */
function install(rcFile) {
  const detected = detectShell();
  rcFile = rcFile || detected.rcFile;

  if (detected.shell === "fish") {
    return {
      success: false,
      rcFile,
      backupFile: null,
      error: "Fish shell is not yet supported. Use bash or zsh.",
    };
  }

  // Preventive backup
  let backupFile = null;
  if (fs.existsSync(rcFile)) {
    if (isInstalled(rcFile)) {
      return {
        success: false,
        rcFile,
        backupFile: null,
        error: "npm-guard wrapper is already installed.",
      };
    }
    backupFile = rcFile + ".npmguard-backup." + Date.now();
    fs.copyFileSync(rcFile, backupFile);
  }

  // Append the wrapper
  fs.appendFileSync(rcFile, "\n" + WRAPPER_SCRIPT + "\n");

  return { success: true, rcFile, backupFile };
}

/**
 * Remove the wrapper from the user's shell
 * @param {string} rcFile - Path to the rc file (optional, autodetect)
 * @returns {{ success: boolean, rcFile: string, error?: string }}
 */
function uninstall(rcFile) {
  const detected = detectShell();
  rcFile = rcFile || detected.rcFile;

  if (!fs.existsSync(rcFile)) {
    return { success: false, rcFile, error: "File not found: " + rcFile };
  }

  const content = fs.readFileSync(rcFile, "utf-8");
  if (!content.includes(MARKER_START)) {
    return { success: false, rcFile, error: "npm-guard wrapper not found in " + rcFile };
  }

  // Remove the block between the markers
  const regex = new RegExp(
    `\\n?${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}\\n?`,
    "g"
  );
  const cleaned = content.replace(regex, "\n");
  fs.writeFileSync(rcFile, cleaned);

  return { success: true, rcFile };
}

/**
 * Check the wrapper status
 * @returns {{ installed: boolean, shell: string, rcFile: string }}
 */
function status() {
  const detected = detectShell();
  return {
    installed: isInstalled(detected.rcFile),
    shell: detected.shell,
    rcFile: detected.rcFile,
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  install,
  uninstall,
  status,
  detectShell,
  isInstalled,
  MARKER_START,
  MARKER_END,
  WRAPPER_SCRIPT,
};
