const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  install,
  uninstall,
  isInstalled,
  MARKER_START,
  MARKER_END,
} = require("../../src/core/wrapper");

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

console.log("\n  Wrapper Tests\n");

// Crea un file rc temporaneo per i test
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "npmguard-test-"));
const testRcFile = path.join(tmpDir, ".testrc");

// ─── Install ───

test("install in file vuoto", () => {
  fs.writeFileSync(testRcFile, "# existing config\nexport PATH=/usr/bin\n");
  const result = install(testRcFile);
  assert(result.success === true, "Install dovrebbe avere successo");
  assert(result.backupFile !== null, "Dovrebbe creare un backup");
  assert(fs.existsSync(result.backupFile), "Il file di backup dovrebbe esistere");

  const content = fs.readFileSync(testRcFile, "utf-8");
  assert(content.includes(MARKER_START), "Dovrebbe contenere il marker di inizio");
  assert(content.includes(MARKER_END), "Dovrebbe contenere il marker di fine");
  assert(content.includes("export PATH=/usr/bin"), "Dovrebbe preservare il contenuto esistente");
  assert(content.includes("npm()"), "Dovrebbe contenere la funzione npm wrapper");
});

test("install rileva wrapper gia' installato", () => {
  const result = install(testRcFile);
  assert(result.success === false, "Non dovrebbe reinstallare");
  assert(result.error.includes("gia' installato"), "Dovrebbe dire che e' gia' installato");
});

// ─── isInstalled ───

test("isInstalled ritorna true dopo install", () => {
  assert(isInstalled(testRcFile) === true);
});

test("isInstalled ritorna false per file senza wrapper", () => {
  const cleanFile = path.join(tmpDir, ".cleanrc");
  fs.writeFileSync(cleanFile, "# no wrapper here\n");
  assert(isInstalled(cleanFile) === false);
});

test("isInstalled ritorna false per file inesistente", () => {
  assert(isInstalled(path.join(tmpDir, ".nonexistent")) === false);
});

// ─── Uninstall ───

test("uninstall rimuove il wrapper", () => {
  const result = uninstall(testRcFile);
  assert(result.success === true, "Uninstall dovrebbe avere successo");

  const content = fs.readFileSync(testRcFile, "utf-8");
  assert(!content.includes(MARKER_START), "Non dovrebbe contenere il marker");
  assert(!content.includes("npm()"), "Non dovrebbe contenere la funzione wrapper");
  assert(content.includes("export PATH=/usr/bin"), "Dovrebbe preservare il contenuto originale");
});

test("uninstall su file senza wrapper da errore", () => {
  const result = uninstall(testRcFile);
  assert(result.success === false, "Dovrebbe fallire");
  assert(result.error.includes("non trovato"), "Dovrebbe dire che non e' trovato");
});

test("uninstall su file inesistente da errore", () => {
  const result = uninstall(path.join(tmpDir, ".nonexistent"));
  assert(result.success === false);
});

// ─── Install su file nuovo (non esistente) ───

test("install crea il file se non esiste", () => {
  const newFile = path.join(tmpDir, ".newrc");
  const result = install(newFile);
  assert(result.success === true);
  assert(result.backupFile === null, "Non dovrebbe creare backup per file nuovo");
  assert(fs.existsSync(newFile), "Dovrebbe creare il file");
  assert(isInstalled(newFile) === true);
});

// ─── Cleanup ───
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n  Risultati: ${passed} passati, ${failed} falliti\n`);
process.exit(failed > 0 ? 1 : 0);
