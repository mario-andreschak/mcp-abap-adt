const { spawn } = require('child_process');
const path = require('path');

/**
 * Test GetWhereUsed tool with detailed parameter
 */
async function testWhereUsedDetailed() {
    console.log('🧪 Testing GetWhereUsed with detailed parameter...\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    // Test cases
    const testCases = [
        {
            name: 'Minimal results (default)',
            request: {
                method: 'tools/call',
                params: {
                    name: 'GetWhereUsed',
                    arguments: {
                        object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                        object_type: 'class'
                    }
                }
            }
        },
        {
            name: 'Detailed results',
            request: {
                method: 'tools/call',
                params: {
                    name: 'GetWhereUsed',
                    arguments: {
                        object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                        object_type: 'class',
                        detailed: true
                    }
                }
            }
        },
        {
            name: 'Package where-used',
            request: {
                method: 'tools/call',
                params: {
                    name: 'GetWhereUsed',
                    arguments: {
                        object_name: 'BUS_TOOLS',
                        object_type: 'package'
                    }
                }
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 Test: ${testCase.name}`);
        console.log(`🎯 Object: ${testCase.request.params.arguments.object_name} (${testCase.request.params.arguments.object_type})`);
        if (testCase.request.params.arguments.detailed !== undefined) {
            console.log(`🔍 Detailed: ${testCase.request.params.arguments.detailed}`);
        }
        
        const startTime = Date.now();
        
        try {
            const result = await callMcpTool(serverPath, testCase.request);
            const duration = Date.now() - startTime;
            
            if (result.error) {
                console.log(`❌ Error: ${result.error.message}`);
                continue;
            }
            
            const response = JSON.parse(result.content[0].text);
            console.log(`✅ Success in ${duration}ms`);
            console.log(`📊 Total references: ${response.total_references}`);
            console.log(`🔍 Detailed mode: ${response.detailed}`);
            
            if (response.total_found && response.filtered_out !== undefined) {
                console.log(`📈 Found: ${response.total_found}, Filtered out: ${response.filtered_out}`);
            }
            
            // Show first few references
            if (response.references && response.references.length > 0) {
                console.log(`📝 Sample references:`);
                response.references.slice(0, 3).forEach((ref, index) => {
                    console.log(`   ${index + 1}. ${ref.name} (${ref.type}) - isResult: ${ref.isResult}, usage: ${ref.usageInformation || 'none'}`);
                });
                if (response.references.length > 3) {
                    console.log(`   ... and ${response.references.length - 3} more`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Test failed: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
}

/**
 * Call MCP tool via stdio
 */
function callMcpTool(serverPath, request) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}. Stderr: ${stderr}`));
                return;
            }

            try {
                // Parse JSON-RPC responses
                const lines = stdout.trim().split('\n');
                let result = null;
                
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.result) {
                            result = parsed.result;
                            break;
                        }
                    } catch (e) {
                        // Skip non-JSON lines
                    }
                }
                
                if (result) {
                    resolve(result);
                } else {
                    reject(new Error('No valid result found in output'));
                }
            } catch (error) {
                reject(new Error(`Failed to parse output: ${error.message}`));
            }
        });

        // Send the request
        const jsonRpcRequest = {
            jsonrpc: '2.0',
            id: 1,
            ...request
        };

        child.stdin.write(JSON.stringify(jsonRpcRequest) + '\n');
        child.stdin.end();
    });
}

// Run the test
testWhereUsedDetailed().catch(console.error);
