#!/usr/bin/env node
// Test script for GetProgram tool to examine source code

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node test-get-program.js <program_name> [env_file]');
  console.error('Example: node test-get-program.js RM07DOCS');
  process.exit(1);
}

const programName = args[0];
const envFile = args[1] || '.env';

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

// Variable to track if response was received
let responseReceived = false;

printBanner(`GET PROGRAM TEST - ${programName}`);
console.log(`Testing with: ${programName}`);
console.log(`Using env file: ${envPath}`);
console.log('Starting MCP server in stdio mode...');

const child = spawn('node', [serverPath, `--env=${envPath}`], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  const dataStr = data.toString();
  
  try {
    const jsonData = JSON.parse(dataStr);
    
    if (jsonData.id === 'test-get-program') {
      console.log('\n▶ SERVER RESPONSE: PROGRAM SOURCE');
      console.log('-'.repeat(40));
      
      if (jsonData.error) {
        console.log(`❌ ERROR: ${jsonData.error.message} (code ${jsonData.error.code})`);
      } else {
        console.log(`✅ SUCCESS: Program source received\n`);
        
        // Extract and display source code
        let sourceCode = '';
        if (jsonData.result?.content?.[0]?.text) {
          sourceCode = jsonData.result.content[0].text;
        }
        
        console.log('SOURCE CODE:');
        console.log('='.repeat(80));
        console.log(sourceCode);
        console.log('='.repeat(80));
        
        // Analyze INCLUDE statements
        console.log('\n▶ INCLUDE ANALYSIS');
        console.log('-'.repeat(40));
        
        const includePattern = /^\s*INCLUDE\s+([A-Z0-9_<>']+)\s*\.\s*(?:\"|\*.*)?$/gim;
        const includes = [];
        let match;
        while ((match = includePattern.exec(sourceCode)) !== null) {
          let includeName = match[1];
          includeName = includeName.replace(/[<>']/g, '').toUpperCase();
          includes.push({
            original: match[0].trim(),
            name: includeName,
            line: sourceCode.substring(0, match.index).split('\n').length
          });
        }
        
        if (includes.length > 0) {
          console.log(`Found ${includes.length} INCLUDE statements:`);
          includes.forEach((inc, i) => {
            console.log(`${i+1}. Line ${inc.line}: ${inc.name}`);
            console.log(`   Raw: ${inc.original}`);
          });
        } else {
          console.log('No INCLUDE statements found');
        }
      }
      
      responseReceived = true;
      console.log('\nTest completed successfully. Stopping server...');
      child.kill();
      process.exit(0);
    }
  } catch (e) {
    process.stdout.write(`[STDOUT] ${dataStr}`);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(`[STDERR] ${data}`);
});

child.on('close', (code) => {
  console.log(`MCP server exited with code: ${code}`);
});

// Send MCP request to get program source
function sendGetProgramRequest() {
  const request = {
    jsonrpc: "2.0",
    id: "test-get-program",
    method: "tools/call",
    params: {
      name: "GetProgram",
      arguments: {
        program_name: programName
      }
    }
  };
  child.stdin.write(JSON.stringify(request) + "\n");
  console.log(`[TEST] Sent MCP request for program ${programName}`);
}

// Give the server 2 seconds to start, then send the request
setTimeout(sendGetProgramRequest, 2000);

// Set timeout
setTimeout(() => {
  if (!responseReceived) {
    console.log('\nTimeout! No response received. Stopping server...');
    child.kill();
  }
}, 15000);
