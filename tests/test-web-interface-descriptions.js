const { spawn } = require('child_process');
const path = require('path');

/**
 * Test that web interface shows updated tool descriptions with detailed parameter
 */
async function testWebInterfaceDescriptions() {
    console.log('🌐 Web Interface Tool Descriptions Test\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('📋 Testing tool descriptions in web interface...\n');
    
    // Get list of tools
    const toolsResult = await callMcpMethod(serverPath, {
        method: 'tools/list',
        params: {}
    });
    
    if (toolsResult.error) {
        console.error('❌ Failed to get tools list:', toolsResult.error);
        return;
    }
    
    const tools = toolsResult.tools;
    console.log(`✅ Found ${tools.length} tools\n`);
    
    // Check specific tools for detailed parameter
    const toolsToCheck = ['GetWhereUsed', 'GetEnhancements', 'GetIncludesList'];
    
    for (const toolName of toolsToCheck) {
        const tool = tools.find(t => t.name === toolName);
        if (!tool) {
            console.log(`❌ Tool ${toolName} not found`);
            continue;
        }
        
        console.log(`🔧 ${toolName}:`);
        console.log(`   📝 Description: ${tool.description.substring(0, 100)}...`);
        
        // Check if detailed parameter exists
        const detailedParam = tool.inputSchema?.properties?.detailed;
        if (detailedParam) {
            console.log(`   ✅ Has 'detailed' parameter:`);
            console.log(`      📄 Description: ${detailedParam.description}`);
            console.log(`      🔧 Type: ${detailedParam.type}`);
            console.log(`      📌 Default: ${detailedParam.default}`);
        } else {
            console.log(`   ❌ Missing 'detailed' parameter`);
        }
        
        console.log('');
    }
    
    // Test calling one tool with detailed parameter
    console.log('🧪 Testing actual tool call with detailed parameter...\n');
    
    const testResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetWhereUsed',
            arguments: {
                object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                object_type: 'class',
                detailed: false
            }
        }
    });
    
    if (!testResult.error) {
        const response = JSON.parse(testResult.content[0].text);
        console.log(`✅ GetWhereUsed test successful:`);
        console.log(`   📊 Total found: ${response.total_found}`);
        console.log(`   📋 Showing: ${response.total_references}`);
        console.log(`   🔍 Detailed mode: ${response.detailed}`);
        console.log(`   🎯 Filtered out: ${response.filtered_out}`);
    } else {
        console.log(`❌ GetWhereUsed test failed:`, testResult.error);
    }
}

/**
 * Call MCP method via stdio
 */
function callMcpMethod(serverPath, request) {
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

/**
 * Call MCP tool via stdio
 */
function callMcpTool(serverPath, request) {
    return callMcpMethod(serverPath, request);
}

// Run the test
testWebInterfaceDescriptions().catch(console.error);
