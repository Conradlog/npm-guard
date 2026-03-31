/**
 * Esempio di configurazione npm-guard.
 *
 * Copia questo file come `.npmguardrc.json` (senza le funzioni JS)
 * oppure come `npmguard.config.js` nella root del tuo progetto.
 */
module.exports = {
  // ─── Regole ───
  // Abilita/disabilita gruppi di regole
  rules: {
    "shell-commands": true,
    "network-access": true,
    "file-system": true,
    "code-execution": true,
    "sensitive-files": true,
    "obfuscation": true,
    "dependency-risk": true,  // Rileva dipendenze iniettate, pacchetti giovani, typosquatting (usata con --deep)
  },

  // ─── Soglie ───
  // Personalizza i punteggi per ogni livello di rischio
  thresholds: {
    low: 3,      // 0-3 = BASSO
    medium: 10,  // 4-10 = MEDIO
    high: 20,    // 11-20 = ALTO
    // >20 = CRITICO
  },

  // ─── Pesi ───
  // Quanto "pesa" ogni livello di severita' nel punteggio
  severityWeights: {
    low: 1,
    medium: 3,
    high: 7,
    critical: 15,
  },

  // ─── Pacchetti fidati ───
  // Questi pacchetti non verranno scansionati
  ignore: [
    // "pacchetto-fidato",
  ],

  // ─── Pattern sicuri aggiuntivi ───
  // Regex (come stringhe) per comandi da considerare sicuri
  safePatterns: [
    // "\\bmy-build-tool\\b",
  ],

  // ─── Plugin ───
  // Percorsi o nomi npm dei plugin da caricare
  plugins: [
    // "./plugins/example-plugin",
    // "npm-guard-plugin-company-rules",
  ],

  // ─── Output ───
  // Formato: "text" (terminale), "json" (CI/CD), "html" (report)
  format: "text",

  // ─── CI/CD ───
  // Exit code 1 se il rischio massimo >= questo livello
  // Valori: "low", "medium", "high", "critical"
  failOn: "critical",
};
