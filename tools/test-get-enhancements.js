#!/usr/bin/env node
// Test script for GetEnhancements tool

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node test-get-enhancements.js <object_name> [program] [include_nested] [view_code] [env_file]');
  console.error('Example: node test-get-enhancements.js RM07DOCS');
  console.error('Example: node test-get-enhancements.js RM07DOCS "" true false');
  console.error('Example: node test-get-enhancements.js mv45afzz SAPMV45A false true');
  console.error('');
  console.error('Parameters:');
  console.error('  object_name    - Name of the ABAP program or include');
  console.error('  program        - Optional program context for includes (use "" to skip)');
  console.error('  include_nested - true/false to include nested enhancements (default: false)');
  console.error('  view_code      - true/false to display enhancement source code (default: false)');
  console.error('  env_file       - Environment file to use (default: .env)');
  process.exit(1);
}

const objectName = args[0];
const program = args[1] && args[1] !== "" ? args[1] : undefined;
const includeNested = args[2] === 'true';
const viewCode = args[3] === 'true';
const envFile = args[4] || '.env';

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

// Function to parse and format enhancement data
const formatEnhancements = (enhancementData, showCode = false) => {
  try {
    // Handle error messages
    if (typeof enhancementData === 'string' && enhancementData.startsWith('Error:')) {
      return `❌ ${enhancementData}`;
    }
    
    const data = typeof enhancementData === 'string' ? JSON.parse(enhancementData) : enhancementData;
    
    // Check if this is a nested enhancement response (with objects array)
    if (data.objects && Array.isArray(data.objects)) {
      return formatNestedEnhancements(data, showCode);
    }
    
    // Handle single object enhancement response
    if (!data.enhancements || data.enhancements.length === 0) {
      return '📋 No enhancements found';
    }

    let output = `📋 Found ${data.enhancements.length} enhancement(s):\n\n`;
    
    data.enhancements.forEach((enhancement, index) => {
      // Determine the best name to display
      let displayName = enhancement.name;
      
      // If name is auto-generated (like enhancement_1), try to use other fields
      if (displayName && displayName.match(/^enhancement_\d+$/)) {
        // Look for better name fields
        if (enhancement.implementation_name) {
          displayName = enhancement.implementation_name;
        } else if (enhancement.enhancement_name) {
          displayName = enhancement.enhancement_name;
        } else if (enhancement.enhancement_impl) {
          displayName = enhancement.enhancement_impl;
        }
      }
      
      output += `${index + 1}. Enhancement: ${displayName}\n`;
      
      // Show original technical name if different from display name
      if (enhancement.name && enhancement.name !== displayName) {
        output += `   Technical Name: ${enhancement.name}\n`;
      }
      
      if (enhancement.description) {
        output += `   Description: ${enhancement.description}\n`;
      }
      if (enhancement.type) {
        output += `   Type: ${enhancement.type}\n`;
      }
      if (enhancement.object) {
        output += `   Object: ${enhancement.object}\n`;
      }
      if (enhancement.include) {
        output += `   Include: ${enhancement.include}\n`;
      }
      
      if (showCode && enhancement.sourceCode && enhancement.sourceCode.length > 0) {
        const sourceLines = enhancement.sourceCode.split('\n');
        output += `   📄 Source Code (${sourceLines.length} lines):\n`;
        output += '   ' + '─'.repeat(50) + '\n';
        sourceLines.forEach((line, lineIndex) => {
          output += `   ${String(lineIndex + 1).padStart(3)}: ${line}\n`;
        });
        output += '   ' + '─'.repeat(50) + '\n';
      } else if (!showCode && enhancement.sourceCode && enhancement.sourceCode.length > 0) {
        const sourceLines = enhancement.sourceCode.split('\n');
        output += `   📄 Source available (${sourceLines.length} lines) - use view_code=true to display\n`;
      } else if (showCode && enhancement.source_lines && enhancement.source_lines.length > 0) {
        // Fallback for source_lines field format
        output += `   📄 Source Code (${enhancement.source_lines.length} lines):\n`;
        output += '   ' + '─'.repeat(50) + '\n';
        enhancement.source_lines.forEach((line, lineIndex) => {
          output += `   ${String(lineIndex + 1).padStart(3)}: ${line}\n`;
        });
        output += '   ' + '─'.repeat(50) + '\n';
      } else if (!showCode && enhancement.source_lines && enhancement.source_lines.length > 0) {
        // Fallback for source_lines field format
        output += `   📄 Source available (${enhancement.source_lines.length} lines) - use view_code=true to display\n`;
      }
      
      output += '\n';
    });

    // Add summary information if available
    if (data.summary) {
      output += '📊 Summary:\n';
      Object.entries(data.summary).forEach(([key, value]) => {
        output += `   ${key}: ${value}\n`;
      });
    }

    return output;
  } catch (error) {
    console.error('Error formatting enhancements:', error);
    return enhancementData; // Return original data if parsing fails
  }
};

// Function to format nested enhancement response (when include_nested=true)
const formatNestedEnhancements = (data, showCode = false) => {
  let output = `🔍 NESTED ENHANCEMENT SEARCH RESULTS\n\n`;
  
  if (data.main_object) {
    output += `📁 Main Object: ${data.main_object.name} (${data.main_object.type})\n`;
  }
  
  output += `📊 Analysis Summary:\n`;
  output += `   • Objects analyzed: ${data.total_objects_analyzed || 0}\n`;
  output += `   • Total enhancements found: ${data.total_enhancements_found || 0}\n`;
  output += `   • Include nested search: ${data.include_nested ? 'YES' : 'NO'}\n\n`;

  if (!data.objects || data.objects.length === 0) {
    output += '📋 No objects were analyzed\n';
    return output;
  }

  let totalEnhancements = 0;
  
  data.objects.forEach((obj, objIndex) => {
    const enhancementCount = obj.enhancements ? obj.enhancements.length : 0;
    totalEnhancements += enhancementCount;
    
    output += `${objIndex + 1}. 📄 Object: ${obj.object_name} (${obj.object_type})\n`;
    if (obj.context) {
      output += `   Context: ${obj.context}\n`;
    }
    
    if (enhancementCount === 0) {
      output += `   📋 No enhancements found\n`;
    } else {
      output += `   📋 Found ${enhancementCount} enhancement(s):\n`;
      
      obj.enhancements.forEach((enhancement, enhIndex) => {
        // Determine the best name to display
        let displayName = enhancement.name;
        
        // If name is auto-generated (like enhancement_1), try to use other fields
        if (displayName && displayName.match(/^enhancement_\d+$/)) {
          // Look for better name fields
          if (enhancement.implementation_name) {
            displayName = enhancement.implementation_name;
          } else if (enhancement.enhancement_name) {
            displayName = enhancement.enhancement_name;
          } else if (enhancement.enhancement_impl) {
            displayName = enhancement.enhancement_impl;
          }
        }
        
        output += `      ${enhIndex + 1}. Enhancement: ${displayName}\n`;
        
        // Show original technical name if different from display name
        if (enhancement.name && enhancement.name !== displayName) {
          output += `         Technical Name: ${enhancement.name}\n`;
        }
        
        if (enhancement.description) {
          output += `         Description: ${enhancement.description}\n`;
        }
        if (enhancement.type) {
          output += `         Type: ${enhancement.type}\n`;
        }
        
        if (showCode && enhancement.sourceCode && enhancement.sourceCode.length > 0) {
          const sourceLines = enhancement.sourceCode.split('\n');
          output += `         📄 Source Code (${sourceLines.length} lines):\n`;
          output += '         ' + '─'.repeat(40) + '\n';
          sourceLines.forEach((line, lineIndex) => {
            output += `         ${String(lineIndex + 1).padStart(3)}: ${line}\n`;
          });
          output += '         ' + '─'.repeat(40) + '\n';
        } else if (!showCode && enhancement.sourceCode && enhancement.sourceCode.length > 0) {
          const sourceLines = enhancement.sourceCode.split('\n');
          output += `         📄 Source available (${sourceLines.length} lines) - use view_code=true to display\n`;
        }
      });
    }
    output += '\n';
  });

  if (totalEnhancements > 0) {
    output += `🎯 TOTAL: Found ${totalEnhancements} enhancement(s) across ${data.objects.length} object(s)\n`;
  }

  return output;
};

// Variable to track if response was received
let responseReceived = false;

printBanner(`GET ENHANCEMENTS TEST - ${objectName}`);
console.log(`Testing with: ${objectName}`);
if (program) console.log(`Program context: ${program}`);
console.log(`Include nested: ${includeNested}`);
console.log(`View code: ${viewCode}`);
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
    
    if (jsonData.id === 'test-get-enhancements') {
      printSection('SERVER RESPONSE: ENHANCEMENTS');
      
      if (jsonData.error) {
        console.log(`❌ ERROR: ${jsonData.error.message} (code ${jsonData.error.code})`);
      } else {
        console.log(`✅ SUCCESS: Enhancements data received\n`);
        
        // Extract and format the enhancement data
        const enhancementText = formatJSON(jsonData);
        const formattedEnhancements = formatEnhancements(enhancementText, viewCode);
        
        console.log(formattedEnhancements);
        
        // Optionally show raw JSON for debugging (uncomment if needed)
        // console.log('\n' + '─'.repeat(60));
        // console.log('RAW JSON RESPONSE:');
        // console.log('─'.repeat(60));
        // console.log(enhancementText);
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

// Send real MCP request to get enhancements for specified object
function sendGetEnhancementsRequest() {
  const requestArgs = {
    object_name: objectName
  };
  
  if (program) {
    requestArgs.program = program;
  }
  
  if (includeNested) {
    requestArgs.include_nested = includeNested;
  }
  
  const request = {
    jsonrpc: "2.0",
    id: "test-get-enhancements",
    method: "tools/call",
    params: {
      name: "GetEnhancements",
      arguments: requestArgs
    }
  };
  child.stdin.write(JSON.stringify(request) + "\n");
  console.log(`[TEST] Sent MCP request for enhancements in object ${objectName}`);
  console.log(`[TEST] Request arguments:`, requestArgs);
}

// Give the server 2 seconds to start, then send the request
setTimeout(sendGetEnhancementsRequest, 2000);

// Set timeout only as a fallback in case no response is received
setTimeout(() => {
  if (!responseReceived) {
    console.log('\nTimeout! No response received. Stopping server...');
    child.kill();
  }
}, 30000); // Increased timeout for enhancements analysis with includes
