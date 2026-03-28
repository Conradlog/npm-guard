/**
 * Plugin di esempio per npm-guard.
 *
 * Questo plugin dimostra come:
 * 1. Aggiungere regole personalizzate
 * 2. Aggiungere pattern sicuri
 * 3. Aggiungere un formatter personalizzato
 *
 * Per usarlo, aggiungi al tuo .npmguardrc.json:
 * {
 *   "plugins": ["./plugins/example-plugin"]
 * }
 */

const { BaseRule } = require("../../src/rules/base-rule");

// ─── Regola personalizzata ───
class CryptoMiningRule extends BaseRule {
  get name() {
    return "crypto-mining";
  }

  get description() {
    return "Rileva possibili tentativi di crypto-mining nascosti";
  }

  get patterns() {
    return [
      {
        pattern: /\bxmrig\b/i,
        id: "xmrig",
        severity: "critical",
        title: "XMRig miner rilevato",
        description: "Software di mining Monero trovato - usa la CPU del tuo computer per minare criptovalute",
      },
      {
        pattern: /\bstratum\+tcp\b/,
        id: "stratum",
        severity: "critical",
        title: "Connessione a mining pool",
        description: "Connessione a un server di mining pool - il tuo computer verrebbe usato per minare",
      },
      {
        pattern: /\bcryptoni(?:ght|te)\b/i,
        id: "cryptonight",
        severity: "critical",
        title: "Algoritmo CryptoNight rilevato",
        description: "Algoritmo di mining trovato nel codice",
      },
    ];
  }
}

// ─── Formatter personalizzato (output minimo) ───
function minimalFormat(results) {
  const lines = [];
  for (const r of results) {
    if (r.error) {
      lines.push(`ERR ${r.error}`);
      continue;
    }
    const icon = r.risk.score === 0 ? "OK" : "!!";
    lines.push(`${icon} ${r.name}@${r.version} [${r.risk.level}]`);
  }
  return lines.join("\n");
}

// ─── Registrazione del plugin ───
module.exports = {
  name: "example-plugin",
  version: "1.0.0",

  register(api) {
    // Aggiunge la regola crypto-mining
    api.addRule(new CryptoMiningRule());

    // Aggiunge un pattern sicuro (esempio: tool interno aziendale)
    api.addSafePattern(/\bmy-company-build-tool\b/);

    // Aggiunge un formatter "minimal"
    api.addFormatter("minimal", { format: minimalFormat });
  },
};
