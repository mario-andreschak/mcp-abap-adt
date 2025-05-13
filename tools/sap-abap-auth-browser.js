#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const { program } = require("commander");
const express = require("express");
const open = require("open").default;
const http = require("http");

// Path to the .env file relative to the project root
const ENV_FILE_PATH = path.resolve(process.cwd(), ".env");

// Browser selection via --browser option (chrome, edge, firefox, system)
const BROWSER_MAP = {
  chrome: "chrome",
  edge: "msedge",
  firefox: "firefox",
  system: undefined, // system default
};

/**
 * Reads a JSON service key file
 * @param {string} filePath Path to the service key file
 * @returns {object} Service key data object
 */
function readServiceKey(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading service key: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Updates the .env file with new values
 * @param {Object} updates Object with updated values
 */
function updateEnvFile(updates) {
  try {
    // Always remove the old .env file if it exists
    if (fs.existsSync(ENV_FILE_PATH)) {
      fs.unlinkSync(ENV_FILE_PATH);
    }
    let lines = [];
    if (updates.SAP_AUTH_TYPE === "jwt") {
      // jwt: write only relevant params
      const jwtAllowed = [
        "SAP_URL",
        "SAP_CLIENT",
        "SAP_LANGUAGE",
        "TLS_REJECT_UNAUTHORIZED",
        "SAP_AUTH_TYPE",
        "SAP_JWT_TOKEN",
      ];
      jwtAllowed.forEach((key) => {
        if (updates[key]) lines.push(`${key}=${updates[key]}`);
      });
      lines.push("");
      lines.push("# For JWT authentication");
      lines.push("# SAP_USERNAME=your_username");
      lines.push("# SAP_PASSWORD=your_password");
    } else {
      // basic: write only relevant params
      const basicAllowed = [
        "SAP_URL",
        "SAP_CLIENT",
        "SAP_LANGUAGE",
        "TLS_REJECT_UNAUTHORIZED",
        "SAP_AUTH_TYPE",
        "SAP_USERNAME",
        "SAP_PASSWORD",
      ];
      basicAllowed.forEach((key) => {
        if (updates[key]) lines.push(`${key}=${updates[key]}`);
      });
      lines.push("");
      lines.push("# For JWT authentication (not used for basic)");
      lines.push("# SAP_JWT_TOKEN=your_jwt_token_here");
    }
    fs.writeFileSync(ENV_FILE_PATH, lines.join("\n") + "\n", "utf8");
    console.log(".env file created successfully.");
  } catch (error) {
    console.error(`Error updating .env file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Builds the JWT (OAuth2) authentication URL
 * @param {Object} serviceKey SAP BTP service key object
 * @param {number} port Redirect URL port
 * @returns {string} Authentication URL
 */
function getJwtAuthorizationUrl(serviceKey, port = 3001) {
  const { url, clientid } = serviceKey.uaa;
  const redirectUri = `http://localhost:${port}/callback`;
  return `${url}/oauth/authorize?client_id=${encodeURIComponent(
    clientid
  )}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Starts a local server to intercept the authentication response
 * @param {Object} serviceKey SAP BTP service key object
 * @param {string} browser Browser to open
 * @param {string} flow Flow type: jwt (OAuth2)
 * @returns {Promise<string>} Promise that resolves to the token
 */
async function startAuthServer(serviceKey, browser = "system", flow = "jwt") {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    const PORT = 3001;
    let serverInstance = null;

    // Choose the authorization URL
    const authorizationUrl = getJwtAuthorizationUrl(serviceKey, PORT);

    // JWT OAuth2 flow (get code, exchange for token)
    app.get("/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code) {
          res.status(400).send("Error: Authorization code missing");
          return reject(new Error("Authorization code missing"));
        }
        console.log("Authorization code received");
        res.send(
          `<html><body style=\'font-family:sans-serif;text-align:center;margin-top:100px;\'><h1>✅ Authentication successful!</h1><p>You can close this window.</p></body></html>`
        );
        try {
          const token = await exchangeCodeForToken(serviceKey, code);
          server.close(() => {
            console.log("Authentication server stopped");
          });
          resolve(token);
        } catch (error) {
          reject(error);
        }
      } catch (error) {
        console.error("Error handling callback:", error);
        res.status(500).send("Error processing authentication");
        reject(error);
      }
    });

    serverInstance = server.listen(PORT, () => {
      console.log(`Authentication server started on port ${PORT}`);
      console.log("Opening browser for authentication...");
      const browserApp = BROWSER_MAP[browser] || undefined;
      if (browserApp) {
        open(authorizationUrl, { app: { name: browserApp } });
      } else {
        open(authorizationUrl);
      }
    });

    setTimeout(() => {
      if (serverInstance) {
        serverInstance.close();
        reject(new Error("Authentication timeout. Process aborted."));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Exchanges the authorization code for a token
 * @param {Object} serviceKey SAP BTP service key object
 * @param {string} code Authorization code
 * @returns {Promise<string>} Promise that resolves to the token
 */
async function exchangeCodeForToken(serviceKey, code) {
  try {
    const { url, clientid, clientsecret } = serviceKey.uaa;
    const tokenUrl = `${url}/oauth/token`;
    const redirectUri = "http://localhost:3001/callback";

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

    const authString = Buffer.from(`${clientid}:${clientsecret}`).toString(
      "base64"
    );

    const response = await axios({
      method: "post",
      url: tokenUrl,
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: params.toString(),
    });

    if (response.data && response.data.access_token) {
      console.log("OAuth token received successfully.");
      return response.data.access_token;
    } else {
      throw new Error("Response does not contain access_token");
    }
  } catch (error) {
    if (error.response) {
      console.error(
        `API error (${error.response.status}): ${JSON.stringify(
          error.response.data
        )}`
      );
    } else {
      console.error(`Error obtaining OAuth token: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Main program function
 */
async function main() {
  program
    .name("sap-abap-auth-browser")
    .description(
      "CLI utility for authentication in SAP BTP ABAP Environment (Steampunk) via browser."
    )
    .version("1.0.0")
    .helpOption("-h, --help", "Show help for all commands and options");

  program
    .command("auth")
    .description(
      "Authenticate in SAP BTP ABAP Environment (Steampunk) via browser and update .env file (JWT)"
    )
    .requiredOption(
      "-k, --key <path>",
      "Path to the service key file in JSON format"
    )
    .option(
      "-b, --browser <browser>",
      "Browser to open (chrome, edge, firefox, system). Default: system",
      "system"
    )
    .helpOption("-h, --help", "Show help for the auth command")
    .action(async (options) => {
      try {
        console.log("Starting authentication process...");
        const serviceKey = readServiceKey(options.key);
        console.log("Service key read successfully.");
        // Start the server for JWT authentication
        const token = await startAuthServer(
          serviceKey,
          options.browser,
          "jwt"
        );
        const abapUrl =
          serviceKey.url || serviceKey.abap?.url || serviceKey.sap_url;
        const abapClient =
          serviceKey.client || serviceKey.abap?.client || serviceKey.sap_client;
        // Collect all relevant parameters from service key
        const envUpdates = {
          SAP_URL: abapUrl,
          SAP_CLIENT: abapClient,
          TLS_REJECT_UNAUTHORIZED: "0",
          SAP_AUTH_TYPE: "jwt",
          SAP_JWT_TOKEN: token,
        };
        // Optional: language
        if (serviceKey.language) {
          envUpdates.SAP_LANGUAGE = serviceKey.language;
        } else if (serviceKey.abap && serviceKey.abap.language) {
          envUpdates.SAP_LANGUAGE = serviceKey.abap.language;
        }
        updateEnvFile(envUpdates);
        console.log("Authentication completed successfully!");
        process.exit(0);
      } catch (error) {
        console.error(`Authentication error: ${error.message}`);
        process.exit(1);
      }
    });

  // Show help if no arguments are provided
  if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  program.parse();
}

// Run the main function
main();
