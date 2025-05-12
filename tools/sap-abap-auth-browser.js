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
    // Check if .env file exists
    if (!fs.existsSync(ENV_FILE_PATH)) {
      console.error(`.env file not found at: ${ENV_FILE_PATH}`);
      console.log("Creating a new .env file...");

      // Create a basic .env file
      const defaultEnv = `SAP_URL=https://your-abap-system.com
SAP_CLIENT=100
SAP_LANGUAGE=en
TLS_REJECT_UNAUTHORIZED=0

# Authentication type: basic or xsuaa
SAP_AUTH_TYPE=xsuaa

# For JWT (XSUAA) authentication
SAP_JWT_TOKEN=your_jwt_token_here

# For basic authentication
# SAP_USERNAME=your_username
# SAP_PASSWORD=your_password
`;
      fs.writeFileSync(ENV_FILE_PATH, defaultEnv, "utf8");
    }

    // Read current .env file
    let envContent = fs.readFileSync(ENV_FILE_PATH, "utf8");

    // Update values in the .env file
    Object.entries(updates).forEach(([key, value]) => {
      // Check if the key exists in the file
      const regex = new RegExp(`^${key}=.*$`, "m");

      if (regex.test(envContent)) {
        // Update existing value
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add new value
        envContent += `\n${key}=${value}`;
      }
    });

    // Save the updated .env file
    fs.writeFileSync(ENV_FILE_PATH, envContent, "utf8");
    console.log(".env file updated successfully.");
  } catch (error) {
    console.error(`Error updating .env file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Gets the ABAP system API URL from the service key
 * @param {Object} serviceKey SAP BTP service key object
 * @returns {string} ABAP system API URL
 */
function getAbapUrl(serviceKey) {
  try {
    // Check various possible service key structures
    if (serviceKey.url) {
      return serviceKey.url;
    } else if (serviceKey.endpoints && serviceKey.endpoints.api) {
      return serviceKey.endpoints.api;
    } else if (serviceKey.abap && serviceKey.abap.url) {
      return serviceKey.abap.url;
    } else {
      throw new Error("Could not find ABAP system URL in service key");
    }
  } catch (error) {
    console.error(`Error getting ABAP system URL: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Gets the ABAP system client from the service key
 * @param {Object} serviceKey SAP BTP service key object
 * @returns {string} ABAP system client
 */
function getAbapClient(serviceKey) {
  try {
    // Check various possible service key structures
    if (serviceKey.sapClient) {
      return serviceKey.sapClient;
    } else if (serviceKey.abap && serviceKey.abap.sapClient) {
      return serviceKey.abap.sapClient;
    } else {
      // Default for cloud systems
      return "100";
    }
  } catch (error) {
    console.error(`Error getting ABAP system client: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Builds the XSUAA (OAuth2) authentication URL
 * @param {Object} serviceKey SAP BTP service key object
 * @param {number} port Redirect URL port
 * @returns {string} Authentication URL
 */
function getXsuaaAuthorizationUrl(serviceKey, port = 3001) {
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
 * @param {string} flow Flow type: xsuaa (OAuth2)
 * @returns {Promise<string>} Promise that resolves to the token
 */
async function startAuthServer(serviceKey, browser = "system", flow = "xsuaa") {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    const PORT = 3001;
    let serverInstance = null;

    // Choose the authorization URL
    const authorizationUrl = getXsuaaAuthorizationUrl(serviceKey, PORT);

    // XSUAA OAuth2 flow (get code, exchange for token)
    app.get("/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code) {
          res.status(400).send("Error: Authorization code missing");
          return reject(new Error("Authorization code missing"));
        }
        console.log("Authorization code received");
        res.send(
          `<html><body style='font-family:sans-serif;text-align:center;margin-top:100px;'><h1>✅ Authentication successful!</h1><p>You can close this window.</p></body></html>`
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
      "CLI utility for authentication in SAP ABAP systems via browser"
    )
    .version("1.0.0");

  program
    .command("auth")
    .description(
      "Authenticate in SAP ABAP system via browser and update .env file (JWT/XSUAA)"
    )
    .requiredOption(
      "-k, --key <path>",
      "Path to the service key file in JSON format"
    )
    .option(
      "-b, --browser <browser>",
      "Browser to open (chrome, edge, firefox, system)",
      "system"
    )
    .action(async (options) => {
      try {
        console.log("Starting authentication process...");
        const serviceKey = readServiceKey(options.key);
        console.log("Service key read successfully.");
        // Start the server for XSUAA authentication
        const token = await startAuthServer(
          serviceKey,
          options.browser,
          "xsuaa"
        );
        const abapUrl = getAbapUrl(serviceKey);
        const abapClient = getAbapClient(serviceKey);
        // Collect all relevant parameters from service key
        const envUpdates = {
          SAP_URL: abapUrl,
          SAP_CLIENT: abapClient,
          TLS_REJECT_UNAUTHORIZED: "0",
          SAP_AUTH_TYPE: "xsuaa",
          SAP_JWT_TOKEN: token,
        };
        // Optional: language
        if (serviceKey.language) {
          envUpdates.SAP_LANGUAGE = serviceKey.language;
        } else if (serviceKey.abap && serviceKey.abap.language) {
          envUpdates.SAP_LANGUAGE = serviceKey.abap.language;
        }
        // UAA details
        if (serviceKey.uaa) {
          if (serviceKey.uaa.clientid)
            envUpdates.UAA_CLIENTID = serviceKey.uaa.clientid;
          if (serviceKey.uaa.clientsecret)
            envUpdates.UAA_CLIENTSECRET = serviceKey.uaa.clientsecret;
          if (serviceKey.uaa.url) envUpdates.UAA_URL = serviceKey.uaa.url;
          if (serviceKey.uaa.tokenendpoint)
            envUpdates.UAA_TOKENENDPOINT = serviceKey.uaa.tokenendpoint;
        }
        // Endpoints
        if (serviceKey.endpoints && serviceKey.endpoints.api) {
          envUpdates.ENDPOINTS_API = serviceKey.endpoints.api;
        }
        updateEnvFile(envUpdates);
        console.log("Authentication completed successfully!");
        process.exit(0);
      } catch (error) {
        console.error(`Authentication error: ${error.message}`);
        process.exit(1);
      }
    });

  program.parse();
}

// Run the main function
main();
