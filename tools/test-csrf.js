#!/usr/bin/env node
// A simple test script to verify CSRF token fetching and handling

// Import required modules
const axios = require("axios");
const https = require("https");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Create an axios instance with the same settings as the main app
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED === "1",
  }),
});

// Get the SAP URL from environment variables
const sapUrl = process.env.SAP_URL;
if (!sapUrl) {
  console.error("Error: SAP_URL is not set in .env file");
  process.exit(1);
}

// Get the JWT token for authentication
const jwtToken = process.env.SAP_JWT_TOKEN;
if (!jwtToken) {
  console.error("Error: SAP_JWT_TOKEN is not set in .env file");
  process.exit(1);
}

// Function to test CSRF token fetching
async function testCsrfTokenFetching() {
  try {
    console.log("Testing CSRF token fetching...");
    console.log(`URL: ${sapUrl}`);
    console.log(
      `TLS Validation: ${
        process.env.TLS_REJECT_UNAUTHORIZED === "1" ? "Enabled" : "Disabled"
      }`
    );

    // Add /sap/bc/adt/discovery path to the URL
    let csrfUrl = `${sapUrl}/sap/bc/adt/discovery`;

    console.log(`Fetching CSRF token from: ${csrfUrl}`);

    // Make the request to fetch CSRF token
    const response = await axiosInstance({
      method: "GET",
      url: csrfUrl,
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "x-csrf-token": "fetch",
        Accept: "application/atomsvc+xml", // SAP ADT requires this specific Accept header
      },
    });

    // Check if we got a CSRF token
    const token = response.headers["x-csrf-token"];
    if (!token) {
      console.error("Error: No CSRF token in response headers");
      console.log("Headers:", response.headers);
      process.exit(1);
    }

    console.log("Successfully fetched CSRF token:", token);

    // Check if we got cookies
    if (response.headers["set-cookie"]) {
      console.log("Cookies received:", response.headers["set-cookie"].length);
    } else {
      console.warn("Warning: No cookies in response headers");
    }

    // Now test making a POST request with the CSRF token
    console.log("\nTesting POST request with CSRF token...");

    try {
      // This is just a test request, it may fail with 404 but that's OK
      // We just want to see if the CSRF token is being sent correctly
      const postResponse = await axiosInstance({
        method: "POST",
        url: `${sapUrl}/sap/bc/adt/discovery`,
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "x-csrf-token": token,
          "Content-Type": "application/json",
          Cookie: response.headers["set-cookie"]
            ? response.headers["set-cookie"].join("; ")
            : "",
        },
        data: { test: "data" },
      });

      console.log("POST request successful!");
      console.log("Status:", postResponse.status);
    } catch (error) {
      // Even if we get an error, let's check if it's due to CSRF token
      if (error.response) {
        console.log("POST request failed with status:", error.response.status);

        // If we get a 403 with CSRF token error, that's bad
        if (
          error.response.status === 403 &&
          (error.response.data?.includes("CSRF") ||
            error.message.includes("CSRF"))
        ) {
          console.error("Error: CSRF token validation failed");
          console.error("Response data:", error.response.data);
        } else {
          // Other errors are expected in this test
          console.log("POST request failed, but not due to CSRF token issues");
          console.log(
            "This is normal for this test, as we're not making a valid request"
          );
        }
      } else {
        console.error("Error making POST request:", error.message);
      }
    }

    console.log("\nTest completed!");
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testCsrfTokenFetching();
