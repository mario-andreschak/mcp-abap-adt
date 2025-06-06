const { spawn } = require('child_process');
const path = require('path');

// Test the new node structure functionality
async function testNodeStructure() {
    console.log('🧪 Testing Node Structure Functions...\n');

    const testCases = [
        {
            name: 'GetObjectNodeStructure - Root Structure',
            tool: 'GetObjectNodeStructure',
            args: {
                parent_name: 'SAPMV45A',
                parent_tech_name: 'SAPMV45A',
                parent_type: 'PROG/P',
                node_key: '000000',
                with_short_descriptions: true
            }
        },
        {
            name: 'GetIncludesFromNodeStructure - Get Includes List',
            tool: 'GetIncludesFromNodeStructure',
            args: {
                parent_name: 'SAPMV45A',
                parent_tech_name: 'SAPMV45A',
                parent_type: 'PROG/P',
                with_short_descriptions: true
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        console.log(`🔧 Tool: ${testCase.tool}`);
        console.log(`📝 Args: ${JSON.stringify(testCase.args, null, 2)}`);
        console.log('─'.repeat(80));

        try {
            const result = await callTool(testCase.tool, testCase.args);
            console.log('✅ Success!');
            console.log('📄 Response preview:');
            
            // Show first 500 characters of response
            const preview = result.substring(0, 500);
            console.log(preview);
            if (result.length > 500) {
                console.log(`\n... (truncated, total length: ${result.length} characters)`);
            }
            
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

function callTool(toolName, args) {
    return new Promise((resolve, reject) => {
        // Path to the compiled JavaScript file
        const scriptPath = path.join(__dirname, '../dist/index.js');
        
        // Create the MCP request
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        };

        console.log(`🚀 Calling tool: ${toolName}`);
        
        const child = spawn('node', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
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
                // Parse the response
                const lines = stdout.trim().split('\n');
                const responseLine = lines.find(line => {
                    try {
                        const parsed = JSON.parse(line);
                        return parsed.id === 1 && parsed.result;
                    } catch {
                        return false;
                    }
                });

                if (!responseLine) {
                    reject(new Error('No valid response found in output'));
                    return;
                }

                const response = JSON.parse(responseLine);
                
                if (response.error) {
                    reject(new Error(`Tool error: ${JSON.stringify(response.error)}`));
                    return;
                }

                if (response.result && response.result.content && response.result.content[0]) {
                    resolve(response.result.content[0].text);
                } else {
                    reject(new Error('Unexpected response format'));
                }
            } catch (error) {
                reject(new Error(`Failed to parse response: ${error.message}`));
            }
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to start process: ${error.message}`));
        });

        // Send the request
        child.stdin.write(JSON.stringify(request) + '\n');
        child.stdin.end();
    });
}

// Run the test
testNodeStructure().catch(console.error);
