#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Get the path to the .env file from the command-line arguments
const envFilePath = process.argv[2];

if (!envFilePath || !fs.existsSync(envFilePath)) {
  console.error('❌ Error: Please provide a valid path to the .env file as the first argument.');
  process.exit(1);
}

// Load environment variables from the specified file
dotenv.config({ path: envFilePath });

// Resolve the path to the main script (assumes this script is in 'tools/' folder)
const mainScriptPath = path.resolve(__dirname, '../dist/index.js');

// Spawn the main Node.js process with inherited stdio and loaded environment
const nodeProcess = spawn('node', [mainScriptPath], {
  stdio: 'inherit',
  env: { ...process.env },
});

// Exit with the same code as the child process
nodeProcess.on('exit', (code) => {
  process.exit(code);
});
