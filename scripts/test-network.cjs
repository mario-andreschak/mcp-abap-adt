const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const dns = require("node:dns");
const { execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { AxiosError } = require("axios");
const utils = require("../dist/lib/utils.js");
const { getConfig } = require("../dist/config.js");
const {
  withRequestSignal,
  MAX_RESPONSE_BYTES,
} = require("../dist/lib/network.js");
let dir, server, origin;
let respond = (_req, res) => res.end("REPORT zfixture.");
const saved = { ...process.env };
before(async () => {
  dns.setDefaultResultOrder("ipv4first");
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-tls-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-keyout",
      path.join(dir, "key.pem"),
      "-out",
      path.join(dir, "cert.pem"),
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
    ],
    { stdio: "pipe" },
  );
  server = https.createServer(
    {
      key: fs.readFileSync(path.join(dir, "key.pem")),
      cert: fs.readFileSync(path.join(dir, "cert.pem")),
    },
    (req, res) => respond(req, res),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = "https://localhost:" + server.address().port;
  Object.assign(process.env, {
    SAP_URL: origin,
    SAP_USERNAME: "fixture-user",
    SAP_PASSWORD: "fixture-secret",
    SAP_CLIENT: "123",
    SAP_LANGUAGE: "",
    NO_PROXY: "*",
  });
  delete process.env.TLS_REJECT_UNAUTHORIZED;
  delete process.env.SAP_CA_FILE;
});
afterEach(() => {
  utils.cleanup();
  process.env.SAP_URL = origin;
  delete process.env.TLS_REJECT_UNAUTHORIZED;
  delete process.env.SAP_CA_FILE;
  respond = (_req, res) => res.end("REPORT zfixture.");
});
after(async () => {
  utils.cleanup();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
  process.env = saved;
});
const get = () =>
  utils.makeAdtRequest(
    process.env.SAP_URL + "/sap/bc/adt/programs/programs/zfixture/source/main",
    "GET",
    1000,
  );
const trust = () => {
  process.env.SAP_CA_FILE = path.join(dir, "cert.pem");
};

test("untrusted SAP certificate is rejected by default", async () => {
  await assert.rejects(get(), /self-signed certificate/);
});
test("custom CA succeeds and preserves Basic authentication and SAP client", async () => {
  trust();
  respond = (req, res) => {
    assert.equal(
      req.headers.authorization,
      "Basic " + Buffer.from("fixture-user:fixture-secret").toString("base64"),
    );
    assert.equal(
      new URL(req.url, origin).searchParams.get("sap-client"),
      "123",
    );
    res.end("REPORT zfixture.");
  };
  assert.equal((await get()).data, "REPORT zfixture.");
});
test("trusted CA still enforces hostname verification", async () => {
  trust();
  process.env.SAP_URL = origin.replace("localhost", "127.0.0.1");
  await assert.rejects(get(), /IP: 127.0.0.1 is not in the cert/);
});
test("explicit legacy TLS opt-out is honored and warns only on stderr", async () => {
  process.env.TLS_REJECT_UNAUTHORIZED = "0";
  const old = console.error;
  const warnings = [];
  console.error = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal((await get()).data, "REPORT zfixture.");
  } finally {
    console.error = old;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /disables SAP certificate/);
});
test("invalid CA and ambiguous TLS options fail closed", () => {
  process.env.TLS_REJECT_UNAUTHORIZED = "false";
  assert.throws(getConfig, /must be 1/);
  delete process.env.TLS_REJECT_UNAUTHORIZED;
  process.env.SAP_CA_FILE = path.join(dir, "missing");
  assert.throws(utils.createAxiosInstance, /readable PEM/);
});
test("redirects are not followed and upstream bodies are not returned as errors", async () => {
  trust();
  let count = 0;
  respond = (_req, res) => {
    count++;
    res.writeHead(302, { location: origin + "/sap/bc/adt/redirect" });
    res.end("fixture-secret");
  };
  let failure;
  try {
    await get();
  } catch (error) {
    failure = error;
  }
  assert.equal(count, 1);
  assert.equal(failure.response.status, 302);
  assert.equal(
    JSON.stringify(utils.return_error(failure)).includes("fixture-secret"),
    false,
  );
});
test("requests cannot leave the configured SAP ADT origin", async () => {
  await assert.rejects(
    utils.makeAdtRequest(
      "https://elsewhere.invalid/sap/bc/adt/test",
      "GET",
      1000,
    ),
    /configured ADT origin/,
  );
  await assert.rejects(
    utils.makeAdtRequest(origin + "/login", "GET", 1000),
    /configured ADT origin/,
  );
});
test("SAP URL cannot embed credentials or an ignored path", () => {
  for (const value of [
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com/?key=secret",
    "file:///etc/passwd",
  ]) {
    process.env.SAP_URL = value;
    assert.throws(getConfig, /SAP_URL must/);
  }
});
test("SAP language is validated and never injected into query syntax", () => {
  process.env.SAP_LANGUAGE = "EN&sap-client=000";
  assert.throws(getConfig, /two-letter language code/);
  process.env.SAP_LANGUAGE = "";
});
test("response download is bounded before text pagination", async () => {
  trust();
  respond = (_req, res) => res.end(Buffer.alloc(MAX_RESPONSE_BYTES + 1, "x"));
  await assert.rejects(get(), /maxContentLength/);
});
test("request cancellation aborts the active SAP connection", async () => {
  trust();
  const controller = new AbortController();
  let seen;
  const arrived = new Promise((resolve) => {
    seen = resolve;
  });
  respond = (_req, res) => {
    seen();
    res.on("close", () => {});
  };
  const pending = withRequestSignal(controller.signal, get);
  await arrived;
  controller.abort();
  await assert.rejects(pending, (error) => error.code === "ERR_CANCELED");
});
test("CSRF fetch and one refresh retry send only cookie pairs for the correct SAP client", async () => {
  trust();
  let gets = 0,
    posts = 0;
  respond = (req, res) => {
    assert.equal(
      new URL(req.url, origin).searchParams.get("sap-client"),
      "123",
    );
    if (req.method === "GET") {
      gets++;
      res.writeHead(200, {
        "x-csrf-token": "token-" + gets,
        "set-cookie": ["SAP_SESSIONID=fixture-" + gets + "; Path=/; HttpOnly"],
      });
      res.end("token");
    } else {
      posts++;
      assert.equal(req.headers.cookie, "SAP_SESSIONID=fixture-" + gets);
      assert.equal(req.headers["x-csrf-token"], "token-" + gets);
      if (posts === 1) {
        res.writeHead(403);
        res.end("CSRF token validation failed");
      } else res.end("rows");
    }
  };
  const result = await utils.makeAdtRequest(
    origin + "/sap/bc/adt/datapreview/freestyle",
    "POST",
    1000,
    "SELECT * FROM T000",
  );
  assert.equal(result.data, "rows");
  assert.equal(gets, 2);
  assert.equal(posts, 2);
});
test("arbitrary exceptions and SAP response bodies cannot reveal secrets", () => {
  for (const error of [
    new Error("fixture-secret"),
    new AxiosError("fixture-secret", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 500,
      data: "fixture-secret",
    }),
  ]) {
    assert.equal(
      JSON.stringify(utils.return_error(error)).includes("fixture-secret"),
      false,
    );
  }
});
