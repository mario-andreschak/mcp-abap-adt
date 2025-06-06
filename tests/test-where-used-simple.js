const { spawn } = require('child_process');
const path = require('path');

/**
 * Simple test to demonstrate GetWhereUsed filtering
 */
async function testWhereUsedSimple() {
    console.log('🔍 GetWhereUsed Filtering Demo\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('Testing with CL_BUS_ABSTRACT_MAIN_SCREEN class...\n');
    
    // Test minimal mode
    console.log('📋 MINIMAL MODE (default):');
    const minimalResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetWhereUsed',
            arguments: {
                object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                object_type: 'class'
            }
        }
    });
    
    if (!minimalResult.error) {
        const response = JSON.parse(minimalResult.content[0].text);
        console.log(`✅ Found: ${response.total_found}, Showing: ${response.total_references}, Filtered: ${response.filtered_out}`);
        console.log('📝 Key findings:');
        response.references.forEach((ref, index) => {
            console.log(`   ${index + 1}. ${ref.name} (${ref.type})`);
        });
    }
    
    console.log('\n📋 DETAILED MODE (detailed=true):');
    const detailedResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetWhereUsed',
            arguments: {
                object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                object_type: 'class',
                detailed: true
            }
        }
    });
    
    if (!detailedResult.error) {
        const response = JSON.parse(detailedResult.content[0].text);
        console.log(`✅ Found: ${response.total_found}, Showing: ${response.total_references}, Filtered: ${response.filtered_out}`);
        console.log('📝 All references (first 10):');
        response.references.slice(0, 10).forEach((ref, index) => {
            console.log(`   ${index + 1}. ${ref.name} (${ref.type}) - ${ref.usageInformation || 'no usage info'}`);
        });
        if (response.references.length > 10) {
            console.log(`   ... and ${response.references.length - 10} more`);
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
testWhereUsedSimple().catch(console.error);
