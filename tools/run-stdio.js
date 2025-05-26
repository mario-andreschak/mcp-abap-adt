#!/usr/bin/env node
/**
 * Script for running MCP server in stdio mode
 * 
 * Usage: 
 *   node run-stdio.js [--env path/to/.env]
 *   
 * Examples:
 *   node run-stdio.js                    # Uses default .env in project root
 *   node run-stdio.js --env ./dev.env    # Uses dev.env in current directory
 *   node run-stdio.js --env=/full/path/.env  # Uses the specified file
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let envPath = path.resolve(__dirname, '../.env'); // Default path

// Check for --env argument
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--env=')) {
    envPath = args[i].slice('--env='.length);
  } else if (args[i] === '--env' && i + 1 < args.length) {
    envPath = args[i + 1];
    i++; // Skip next argument
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: node run-stdio.js [--env path/to/.env]

Options:
  --env PATH    Path to environment file (.env)
  --help, -h    Show this help message

Examples:
  node run-stdio.js                    # Uses default .env in project root
  node run-stdio.js --env ./dev.env    # Uses dev.env in current directory
  node run-stdio.js --env=/full/path/.env  # Uses the specified file
`);
    process.exit(0);
  }
}

// Convert to absolute path if it's not already
if (!path.isAbsolute(envPath)) {
  envPath = path.resolve(process.cwd(), envPath);
}

// Check if the environment file exists
if (!fs.existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envPath}`);
  console.log('Use --help for usage information');
  process.exit(1);
}

// Absolute path to dist/index.js
// This will always be relative to this script, so we can run from anywhere
const serverPath = path.resolve(__dirname, '../dist/index.js');

// Functions for pretty output
const printBanner = (text) => {
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log(`  ${text}`);
  console.log(line + '\n');
};

printBanner('MCP ABAP ADT - SERVER (STDIO MODE)');
console.log(`Starting MCP server in stdio mode...`);
console.log(`Server path: ${serverPath}`);
console.log(`Environment file: ${envPath}\n`);

// Launch the MCP server process
const child = spawn('node', [serverPath, `--env=${envPath}`], {
  stdio: ['inherit', 'inherit', 'inherit']
});

// Handle process exit events
child.on('close', (code) => {
  console.log(`\nMCP server exited with code: ${code}`);
});

// Forward SIGINT signals (Ctrl+C) to the child process
process.on('SIGINT', () => {
  child.kill('SIGINT');
  // Wait a bit for child process to exit gracefully
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

console.log('MCP server is running in stdio mode. Press Ctrl+C to exit.');
