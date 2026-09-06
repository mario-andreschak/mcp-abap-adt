const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");
const assert = require("node:assert/strict");
const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};
async function stdioSmoke(entry, cwd) {
  for (const protocol of ["2026-07-28", "2025-11-25"]) {
    const child = spawn(process.execPath, [entry], {
      cwd,
      env: {
        ...process.env,
        SAP_URL: "",
        SAP_USERNAME: "",
        SAP_PASSWORD: "",
        SAP_CLIENT: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const exited = new Promise((resolve) =>
      child.once("exit", (code) => resolve(code)),
    );
    let stderr = "";
    child.stderr.on("data", (x) => (stderr += x));
    const pending = new Map();
    const parsed = [];
    createInterface({ input: child.stdout }).on("line", (line) => {
      try {
        const data = JSON.parse(line);
        assert.equal(data.jsonrpc, "2.0");
        parsed.push(data);
        pending.get(data.id)?.(data);
      } catch (error) {
        for (const done of pending.values())
          done({ badLine: line, error: String(error) });
      }
    });
    let id = 0;
    const request = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const next = ++id;
        const timer = setTimeout(
          () => reject(new Error("Timed out: " + method + " " + stderr)),
          10000,
        );
        pending.set(next, (value) => {
          clearTimeout(timer);
          pending.delete(next);
          resolve(value);
        });
        const actual =
          protocol === "2026-07-28" ? { ...params, _meta: modernMeta } : params;
        child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", id: next, method, params: actual }) +
            "\n",
        );
      });
    try {
      if (protocol === "2026-07-28") {
        const r = await request("server/discover");
        assert.equal(r.result.resultType, "complete");
      } else {
        const r = await request("initialize", {
          protocolVersion: protocol,
          capabilities: {},
          clientInfo: { name: "smoke", version: "1" },
        });
        assert.equal(r.result.protocolVersion, protocol);
        assert.equal(r.result.serverInfo.version, "1.2.0");
        child.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized",
          }) + "\n",
        );
      }
      const catalog = await request("tools/list");
      assert.equal(catalog.result.tools.length, 16);
      for (const tool of catalog.result.tools) {
        assert.equal(tool.annotations.readOnlyHint, true);
        assert.equal(tool.inputSchema.properties.startLine.type, "integer");
      }
      const invalid = await request("tools/call", {
        name: "GetProgram",
        arguments: {},
      });
      assert.ok(invalid.error || invalid.result?.isError);
      for (const max_rows of [-1, 1.2, 10001]) {
        const bad = await request("tools/call", {
          name: "GetTableContents",
          arguments: { table_name: "T000", max_rows },
        });
        assert.ok(bad.error || bad.result?.isError);
      }
      const unknown = await request("tools/call", {
        name: "does-not-exist",
        arguments: {},
      });
      assert.ok(unknown.error || unknown.result?.isError);
      const missing = await request("tools/call", {
        name: "GetProgram",
        arguments: { program_name: "ZTEST" },
      });
      assert.equal(missing.result.isError, true);
      assert.match(
        missing.result.content[0].text,
        /Missing required environment variables/,
      );
      assert.ok(parsed.every((x) => x.jsonrpc === "2.0"));
      assert.ok(!stderr.includes("Error:"));
      child.stdin.end();
      const code = await Promise.race([
        exited,
        new Promise((_, reject) => {
          const t = setTimeout(
            () => reject(new Error("EOF did not exit")),
            5000,
          );
          t.unref();
        }),
      ]);
      assert.equal(code, 0);
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
}

module.exports = { stdioSmoke, modernMeta };
