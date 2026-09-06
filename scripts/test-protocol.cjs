const path = require("node:path");
const { stdioSmoke } = require("./protocol-helper.cjs");
stdioSmoke(path.resolve("dist/index.js"), process.cwd())
  .then(() => console.log("Modern and legacy stdio protocol passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
