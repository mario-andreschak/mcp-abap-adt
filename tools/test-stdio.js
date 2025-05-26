#!/usr/bin/env node
// Test script for verifying MCP server in stdio mode

const { spawn } = require('child_process');
const path = require('path');

// Absolute path to dist/index.js
const serverPath = path.resolve(__dirname, '../dist/index.js');
const envPath = path.resolve(__dirname, '../.env');

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

printBanner('MCP STDIO - SERVER TEST');
console.log('Starting MCP server in stdio mode...');

const child = spawn('node', [serverPath, `--env=${envPath}`], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  const dataStr = data.toString();
  
  try {
    // Try to parse data as JSON (MCP response)
    const jsonData = JSON.parse(dataStr);
    
    if (jsonData.id === 'test-get-table-t100') {
      printSection('SERVER RESPONSE: TABLE T100');
      
      if (jsonData.error) {
        console.log(`❌ ERROR: ${jsonData.error.message} (code ${jsonData.error.code})`);
      } else {
        console.log(`✅ SUCCESS: Table T100 structure received\n`);
        console.log(formatJSON(jsonData));
      }
      
      // Mark that response was received and terminate the process
      responseReceived = true;
      console.log('\nTest completed successfully. Stopping server...');
      child.kill();
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

// Send real MCP request to get T100 table definition
function sendGetTableDefinition() {
  const request = {
    jsonrpc: "2.0",
    id: "test-get-table-t100",
    method: "tools/call",
    params: {
      name: "GetTable",
      arguments: {
        table_name: "T100"
      }
    }
  };
  child.stdin.write(JSON.stringify(request) + "\n");
  console.log("[TEST] Sent MCP request for T100 table definition");
}

// Give the server 2 seconds to start, then send the request
setTimeout(sendGetTableDefinition, 2000);

// Set timeout only as a fallback in case no response is received
setTimeout(() => {
  if (!responseReceived) {
    console.log('\nTimeout! No response received. Stopping server...');
    child.kill();
  }
}, 10000);
