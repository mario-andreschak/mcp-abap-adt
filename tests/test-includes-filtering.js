const { spawn } = require('child_process');
const path = require('path');

/**
 * Test GetIncludesList with detailed parameter
 */
async function testIncludesFiltering() {
    console.log('🔍 GetIncludesList Filtering Demo\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('Testing with SAPMV45A program...\n');
    
    // Test minimal mode
    console.log('📋 MINIMAL MODE (default):');
    const minimalResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetIncludesList',
            arguments: {
                object_name: 'SAPMV45A',
                object_type: 'program'
            }
        }
    });
    
    if (!minimalResult.error) {
        console.log('✅ Response (text format):');
        console.log(minimalResult.content[0].text);
    }
    
    console.log('\n📋 DETAILED MODE (detailed=true):');
    const detailedResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetIncludesList',
            arguments: {
                object_name: 'SAPMV45A',
                object_type: 'program',
                detailed: true
            }
        }
    });
    
    if (!detailedResult.error) {
        const response = JSON.parse(detailedResult.content[0].text);
        console.log(`✅ Object: ${response.object_name} (${response.object_type})`);
        console.log(`📊 Total includes: ${response.total_includes}`);
        console.log(`🔍 Detailed mode: ${response.detailed}`);
        console.log(`📄 Raw XML included: ${response.raw_xml ? 'Yes' : 'No'}`);
        console.log(`🔧 Node info: ${JSON.stringify(response.includes_node_info)}`);
        
        if (response.includes && response.includes.length > 0) {
            console.log('📝 Includes list:');
            response.includes.slice(0, 10).forEach((include, index) => {
                console.log(`   ${index + 1}. ${include}`);
            });
            if (response.includes.length > 10) {
                console.log(`   ... and ${response.includes.length - 10} more`);
            }
        }
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
testIncludesFiltering().catch(console.error);
