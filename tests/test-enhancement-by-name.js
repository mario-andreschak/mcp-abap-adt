#!/usr/bin/env node

/**
 * Test script for GetEnhancementByName tool
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_ENHANCEMENT_SPOT = 'enhoxhh';
const TEST_ENHANCEMENT_NAME = 'zpartner_update_pai';

console.log('============================================================');
console.log('  MCP ENHANCEMENT BY NAME TEST');
console.log('============================================================');

async function testEnhancementByName() {
    return new Promise((resolve, reject) => {
        console.log('Starting MCP server in stdio mode...');
        
        // Start the MCP server
        const serverProcess = spawn('node', ['dist/index.js'], {
            cwd: path.resolve(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let responseReceived = false;
        let serverOutput = '';
        let serverError = '';

        // Handle server stderr (logging)
        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            console.log(`[STDERR] ${message.trim()}`);
            serverError += message;
        });

        // Handle server stdout (MCP responses)
        serverProcess.stdout.on('data', (data) => {
            const message = data.toString();
            serverOutput += message;
            
            try {
                // Try to parse each line as JSON (MCP messages are line-delimited JSON)
                const lines = message.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const response = JSON.parse(line);
                        
                        if (response.result && response.result.content) {
                            console.log('\n▶ SERVER RESPONSE: ENHANCEMENT BY NAME');
                            console.log('----------------------------------------');
                            
                            const content = response.result.content[0];
                            if (content && content.text) {
                                const enhancementData = JSON.parse(content.text);
                                
                                console.log('✅ SUCCESS: Enhancement retrieved');
                                console.log(`Enhancement Spot: ${enhancementData.enhancement_spot}`);
                                console.log(`Enhancement Name: ${enhancementData.enhancement_name}`);
                                console.log(`Source Code Length: ${enhancementData.source_code ? enhancementData.source_code.length : 0} characters`);
                                
                                if (enhancementData.source_code) {
                                    console.log('\nFirst 200 characters of source code:');
                                    console.log('----------------------------------------');
                                    console.log(enhancementData.source_code.substring(0, 200) + '...');
                                }
                            }
                            
                            responseReceived = true;
                            console.log('\nTest completed successfully. Stopping server...');
                            serverProcess.kill();
                            resolve();
                            return;
                        }
                        
                        if (response.error) {
                            console.log('\n❌ ERROR RESPONSE:');
                            console.log('----------------------------------------');
                            console.log(JSON.stringify(response.error, null, 2));
                            responseReceived = true;
                            serverProcess.kill();
                            resolve();
                            return;
                        }
                        
                    } catch (parseError) {
                        // Ignore JSON parse errors for non-JSON lines
                    }
                }
            } catch (error) {
                console.error('Error processing server output:', error);
            }
        });

        // Handle server process exit
        serverProcess.on('close', (code) => {
            if (!responseReceived) {
                console.log(`\n❌ Server exited with code ${code} before sending response`);
                console.log('Server Error Output:', serverError);
                console.log('Server Output:', serverOutput);
                reject(new Error(`Server exited with code ${code}`));
            }
        });

        // Send the test request after a short delay
        setTimeout(() => {
            console.log(`[TEST] Sending GetEnhancementByName request for ${TEST_ENHANCEMENT_SPOT}/${TEST_ENHANCEMENT_NAME}`);
            
            const request = {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: {
                    name: "GetEnhancementByName",
                    arguments: {
                        enhancement_spot: TEST_ENHANCEMENT_SPOT,
                        enhancement_name: TEST_ENHANCEMENT_NAME
                    }
                }
            };
            
            serverProcess.stdin.write(JSON.stringify(request) + '\n');
        }, 2000);

        // Set a timeout for the test
        setTimeout(() => {
            if (!responseReceived) {
                console.log('\n⏰ Test timeout - no response received within 30 seconds');
                serverProcess.kill();
                reject(new Error('Test timeout'));
            }
        }, 30000);
    });
}

// Run the test
testEnhancementByName()
    .then(() => {
        console.log('\n🎉 Test completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    });
