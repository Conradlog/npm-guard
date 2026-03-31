const fs = require("fs");
const path = require("path");
const os = require("os");

// Marker per identificare il blocco iniettato
const MARKER_START = "# >>> npm-guard wrapper (DO NOT EDIT) >>>";
const MARKER_END = "# <<< npm-guard wrapper <<<";

/**
 * Script shell che sovrascrive il comando npm per intercettare npm install.
 * Se npm-guard e' installato globalmente, lo usa; altrimenti usa npx.
 */
const WRAPPER_SCRIPT = `
${MARKER_START}
# npm-guard: intercetta npm install per scansionare i pacchetti prima dell'installazione
npm() {
  local cmd="\$1"

  # Intercetta solo "npm install" e "npm i" (non "npm ci", "npm test", ecc.)
  if [[ "\$cmd" == "install" || "\$cmd" == "i" ]]; then
    shift  # Rimuove "install"/"i"

    # Separa flags (--save-dev, --global, ecc.) dai nomi pacchetto
    local packages=()
    local flags=()
    for arg in "\$@"; do
      if [[ "\$arg" == -* ]]; then
        flags+=("\$arg")
      else
        packages+=("\$arg")
      fi
    done

    # Se ci sono pacchetti specifici, scansionali prima
    if [[ \${#packages[@]} -gt 0 ]]; then
      echo ""
      echo "\\033[36m  npm-guard:\\033[0m Scansione profonda pacchetti in corso..."
      echo ""

      # Usa il binario globale o npx come fallback (array per evitare word-splitting)
      local guard_cmd=()
      if command -v npm-guard &> /dev/null; then
        guard_cmd=("npm-guard")
      else
        guard_cmd=("npx" "--yes" "npm-guard")
      fi

      # Esegui la scansione profonda con output JSON per parsing affidabile
      local scan_output
      scan_output=$("\${guard_cmd[@]}" check "\${packages[@]}" --deep --json 2>/dev/null)
      local scan_exit=\$?

      if [[ \$scan_exit -ne 0 ]]; then
        echo ""
        # Mostra anche l'output human-readable con scansione profonda
        "\${guard_cmd[@]}" check "\${packages[@]}" --deep 2>/dev/null
        echo ""
        echo "\\033[31m  npm-guard: BLOCCATO - Trovate minacce nei pacchetti!\\033[0m"
        echo "\\033[33m  Per installare comunque: command npm \$cmd \"\${flags[@]}\" \"\${packages[@]}\"\\033[0m"
        echo ""
        return 1
      else
        echo "\\033[32m  npm-guard: Tutti i pacchetti sono sicuri.\\033[0m"
        echo ""
      fi
    fi

    # Procedi con l'installazione reale
    command npm "\$cmd" "\${flags[@]}" "\${packages[@]}"
  else
    # Per tutti gli altri comandi npm, esegui normalmente
    command npm "\$@"
  fi
}
${MARKER_END}
`;

/**
 * Rileva la shell corrente dell'utente
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
 * Verifica se il wrapper e' gia' installato
 * @param {string} rcFile - Percorso del file rc
 * @returns {boolean}
 */
function isInstalled(rcFile) {
  if (!fs.existsSync(rcFile)) return false;
  const content = fs.readFileSync(rcFile, "utf-8");
  return content.includes(MARKER_START);
}

/**
 * Installa il wrapper nella shell dell'utente
 * @param {string} rcFile - Percorso del file rc (opzionale, autodetect)
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
      error: "Fish shell non e' ancora supportata. Usa bash o zsh.",
    };
  }

  // Backup preventivo
  let backupFile = null;
  if (fs.existsSync(rcFile)) {
    if (isInstalled(rcFile)) {
      return {
        success: false,
        rcFile,
        backupFile: null,
        error: "npm-guard wrapper e' gia' installato.",
      };
    }
    backupFile = rcFile + ".npmguard-backup." + Date.now();
    fs.copyFileSync(rcFile, backupFile);
  }

  // Appende il wrapper
  fs.appendFileSync(rcFile, "\n" + WRAPPER_SCRIPT + "\n");

  return { success: true, rcFile, backupFile };
}

/**
 * Rimuove il wrapper dalla shell dell'utente
 * @param {string} rcFile - Percorso del file rc (opzionale, autodetect)
 * @returns {{ success: boolean, rcFile: string, error?: string }}
 */
function uninstall(rcFile) {
  const detected = detectShell();
  rcFile = rcFile || detected.rcFile;

  if (!fs.existsSync(rcFile)) {
    return { success: false, rcFile, error: "File non trovato: " + rcFile };
  }

  const content = fs.readFileSync(rcFile, "utf-8");
  if (!content.includes(MARKER_START)) {
    return { success: false, rcFile, error: "npm-guard wrapper non trovato in " + rcFile };
  }

  // Rimuovi il blocco tra i marker
  const regex = new RegExp(
    `\\n?${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}\\n?`,
    "g"
  );
  const cleaned = content.replace(regex, "\n");
  fs.writeFileSync(rcFile, cleaned);

  return { success: true, rcFile };
}

/**
 * Verifica lo stato del wrapper
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
