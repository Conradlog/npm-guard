const { BaseRule } = require("./base-rule");

class NetworkAccessRule extends BaseRule {
  get name() {
    return "network-access";
  }

  get description() {
    return "Rileva tentativi di accesso alla rete (download, upload, connessioni)";
  }

  get patterns() {
    return [
      {
        pattern: /\bcurl\b/,
        id: "curl",
        severity: "critical",
        title: "curl (richiesta di rete)",
        description: "Scarica dati da internet o invia i tuoi dati a un server esterno",
      },
      {
        pattern: /\bwget\b/,
        id: "wget",
        severity: "critical",
        title: "wget (download file)",
        description: "Scarica file da internet sul tuo computer",
      },
      {
        pattern: /\bnc\b/,
        id: "netcat",
        severity: "critical",
        title: "netcat (connessione di rete)",
        description: "Apre una connessione di rete nascosta",
      },
      {
        pattern: /\|\s*sh\b/,
        id: "pipe-sh",
        severity: "critical",
        title: "pipe a shell",
        description: "Passa dati direttamente alla shell per eseguirli come comandi",
      },
      {
        pattern: /\|\s*bash\b/,
        id: "pipe-bash",
        severity: "critical",
        title: "pipe a bash",
        description: "Passa dati direttamente a bash per eseguirli come comandi",
      },
    ];
  }
}

module.exports = { NetworkAccessRule };
