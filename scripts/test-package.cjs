const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { stdioSmoke } = require("./protocol-helper.cjs");
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adt-package-"));
  try {
    const pack = JSON.parse(
      execFileSync(
        "npm",
        ["pack", "--ignore-scripts", "--json", "--pack-destination", dir],
        { encoding: "utf8" },
      ),
    )[0];
    assert.ok(pack.files.some((f) => f.path === "dist/index.js"));
    assert.ok(
      !pack.files.some(
        (f) =>
          f.path.startsWith("src/") ||
          f.path.includes(".test.") ||
          f.path === ".env",
      ),
    );
    await fs.writeFile(path.join(dir, "package.json"), '{"private":true}');
    execFileSync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--omit=dev",
        "--no-audit",
        "--no-fund",
        path.join(dir, pack.filename),
      ],
      { cwd: dir, stdio: "pipe", timeout: 120000 },
    );
    const pkg = JSON.parse(
      await fs.readFile(
        path.join(dir, "node_modules/mcp-abap-adt/package.json"),
      ),
    );
    assert.equal(pkg.dependencies.jest, undefined);
    await stdioSmoke(
      path.join(dir, "node_modules/mcp-abap-adt/dist/index.js"),
      dir,
    );
    console.log(
      "Packed production install: modern/legacy protocol, version, catalog, validation and EOF passed",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
