#!/usr/bin/env node
// Test script for GetIncludesList tool

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node test-get-includes-list.js <object_name> <object_type> [env_file]');
  console.error('Example: node test-get-includes-list.js RM07DOCS program');
  console.error('Example: node test-get-includes-list.js RM07DOCS program ../e19.env');
  process.exit(1);
}

const objectName = args[0];
const objectType = args[1];
const envFile = args[2] || '.env';

// Absolute path to dist/index.js
const serverPath = path.resolve(__dirname, '../dist/index.js');
const envPath = path.resolve(__dirname, '..', envFile);

// Functions for pretty output
const printBanner = (text) => {
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log(`  ${text}`);
  console.log(line + '\n');
};

const printSection = (title) => {
  console.log(`\n▶ ${title}\n${'-'.repeat(40)}`);
};

const formatJSON = (json) => {
  // Remove extra nesting levels for display
  if (json.result?.content?.[0]?.text) {
    return json.result.content[0].text;
  }
  return JSON.stringify(json, null, 2);
};

// Variable to track if response was received
let responseReceived = false;

printBanner(`GET INCLUDES LIST TEST - ${objectName} (${objectType})`);
console.log(`Testing with: ${objectName} as ${objectType}`);
console.log(`Using env file: ${envPath}`);
console.log('Starting MCP server in stdio mode...');

const child = spawn('node', [serverPath, `--env=${envPath}`], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  const dataStr = data.toString();
  
  try {
    // Try to parse data as JSON (MCP response)
    const jsonData = JSON.parse(dataStr);
    
    if (jsonData.id === 'test-get-includes-list') {
      printSection('SERVER RESPONSE: INCLUDES LIST');
      
      if (jsonData.error) {
        console.log(`❌ ERROR: ${jsonData.error.message} (code ${jsonData.error.code})`);
      } else {
        console.log(`✅ SUCCESS: Includes list received\n`);
        console.log(formatJSON(jsonData));
      }
      
      // Mark that response was received and terminate the process
      responseReceived = true;
      console.log('\nTest completed successfully. Stopping server...');
      child.kill();
      // Exit the Node.js process immediately
      process.exit(0);
    } else {
      console.log("\nReceived JSON response:");
      console.log(JSON.stringify(jsonData, null, 2));
    }
  } catch (e) {
    // Plain text data
    process.stdout.write(`[STDOUT] ${dataStr}`);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(`[STDERR] ${data}`);
});

child.on('close', (code) => {
  console.log(`MCP server exited with code: ${code}`);
});

// Send real MCP request to get includes list for specified program/include
function sendGetIncludesListRequest() {
  const request = {
    jsonrpc: "2.0",
    id: "test-get-includes-list",
    method: "tools/call",
    params: {
      name: "GetIncludesList",
      arguments: {
        object_name: objectName,
        object_type: objectType
      }
    }
  };
  child.stdin.write(JSON.stringify(request) + "\n");
  console.log(`[TEST] Sent MCP request for includes list in ${objectType} ${objectName}`);
}

// Give the server 2 seconds to start, then send the request
setTimeout(sendGetIncludesListRequest, 2000);

// Set timeout only as a fallback in case no response is received
setTimeout(() => {
  if (!responseReceived) {
    console.log('\nTimeout! No response received. Stopping server...');
    child.kill();
  }
}, 15000); // Increased timeout for includes analysis
