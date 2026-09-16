const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/client");
const { StdioClientTransport } = require("@modelcontextprotocol/client/stdio");

for (const mode of ["auto", "legacy"]) {
  test(
    "SDK client " +
      mode +
      ": real SAP fixture read, paging, validation and cancellation",
    { timeout: 20000 },
    async () => {
      let count = 0;
      let seeSlow;
      const slowSeen = new Promise((resolve) => {
        seeSlow = resolve;
      });
      let seeClose;
      const slowClosed = new Promise((resolve) => {
        seeClose = resolve;
      });
      const sap = http.createServer((req, res) => {
        count++;
        assert.equal(
          req.headers.authorization,
          "Basic " +
            Buffer.from("fixture-user:fixture-secret").toString("base64"),
        );
        const url = new URL(req.url, "http://fixture");
        assert.equal(url.searchParams.get("sap-client"), "123");
        assert.equal(url.searchParams.get("sap-language"), "EN");
        if (url.pathname.includes("/ZSLOW/")) {
          res.on("close", seeClose);
          seeSlow();
          return;
        }
        assert.equal(
          url.pathname,
          "/sap/bc/adt/programs/programs/ZFIXTURE/source/main",
        );
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("REPORT zfixture.\nWRITE: / 'Grüße 🌍'.\nRETURN.");
      });
      sap.listen(0, "127.0.0.1");
      await once(sap, "listening");
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve("dist/index.js")],
        env: {
          ...process.env,
          SAP_URL: "http://127.0.0.1:" + sap.address().port,
          SAP_USERNAME: "fixture-user",
          SAP_PASSWORD: "fixture-secret",
          SAP_CLIENT: "123",
          SAP_LANGUAGE: "en",
          SAP_CA_FILE: "",
          TLS_REJECT_UNAUTHORIZED: "1",
          NO_PROXY: "*",
        },
        stderr: "pipe",
      });
      const client = new Client(
        { name: "fixture", version: "1" },
        { versionNegotiation: { mode } },
      );
      try {
        await client.connect(transport);
        assert.equal(
          client.getProtocolEra(),
          mode === "auto" ? "modern" : "legacy",
        );
        assert.equal(
          client.getNegotiatedProtocolVersion(),
          mode === "auto" ? "2026-07-28" : "2025-11-25",
        );
        assert.equal(
          client.getServerVersion().version,
          require("../package.json").version,
        );
        assert.equal((await client.listTools()).tools.length, 16);
        const result = await client.callTool({
          name: "GetProgram",
          arguments: { program_name: "ZFIXTURE", startLine: 2, maxLines: 1 },
        });
        assert.equal(result.isError, false);
        const page = JSON.parse(result.content[0].text);
        assert.equal(page.content, "WRITE: / 'Grüße 🌍'.");
        assert.equal(page.hasMore, true);
        const before = count;
        try {
          const invalid = await client.callTool({
            name: "GetProgram",
            arguments: { program_name: "ZFIXTURE", startLine: 1.5 },
          });
          assert.equal(invalid.isError, true);
        } catch (error) {
          assert.match(String(error), /valid|integer|parameter/i);
        }
        assert.equal(count, before);
        const controller = new AbortController();
        const pending = client.callTool(
          { name: "GetProgram", arguments: { program_name: "ZSLOW" } },
          { signal: controller.signal },
        );
        const rejected = assert.rejects(pending);
        await slowSeen;
        controller.abort();
        await rejected;
        await Promise.race([
          slowClosed,
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error("SAP connection was not cancelled")),
              3000,
            );
            timer.unref();
          }),
        ]);
      } finally {
        await client.close();
        sap.closeAllConnections();
        await new Promise((resolve) => sap.close(resolve));
      }
    },
  );
}
