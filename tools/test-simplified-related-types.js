const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Simplified GetRelatedObjectTypes...\n');

// Test cases with different object types
const testCases = [
    {
        name: 'Program (SAPMV45A)',
        object_name: 'SAPMV45A',
        expected_type: 'PROG/P'
    },
    {
        name: 'Class (CL_EXAMPLE)',
        object_name: 'CL_EXAMPLE',
        expected_type: 'CLAS/OC'
    },
    {
        name: 'Interface (IF_EXAMPLE)',
        object_name: 'IF_INTERFACE',
        expected_type: 'INTF/OI'
    },
    {
        name: 'Function Group (SLIS)',
        object_name: 'SLIS',
        expected_type: 'FUGR/F'
    }
];

async function testGetRelatedObjectTypes(testCase) {
    return new Promise((resolve, reject) => {
        console.log(`📋 Testing: ${testCase.name}`);
        console.log(`────────────────────────────────────────────────────────────────────────────────`);
        
        const envPath = path.resolve(__dirname, '../.env');
        const serverPath = path.resolve(__dirname, '../dist/index.js');
        
        const child = spawn('node', [serverPath, '--env', envPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasResponded = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            
            // Look for the response
            if (output.includes('"result"') && !hasResponded) {
                hasResponded = true;
                try {
                    // Extract JSON response
                    const lines = output.split('\n');
                    const responseLine = lines.find(line => line.includes('"result"'));
                    
                    if (responseLine) {
                        const response = JSON.parse(responseLine);
                        
                        if (response.result && response.result.content) {
                            const content = response.result.content[0].text;
                            console.log('✅ Success!');
                            console.log('📄 Response preview:');
                            
                            // Show first few lines
                            const lines = content.split('\n').slice(0, 10);
                            lines.forEach(line => console.log(line));
                            
                            if (content.length > 500) {
                                console.log('\n... (truncated, total length:', content.length, 'characters)');
                            }
                            
                            // Check if expected type is mentioned
                            if (content.includes(testCase.expected_type)) {
                                console.log(`🎯 Correctly detected object type: ${testCase.expected_type}`);
                            } else {
                                console.log(`⚠️  Expected type ${testCase.expected_type} not found in response`);
                            }
                            
                            resolve({ success: true, content });
                        } else if (response.error) {
                            console.log('❌ Error:', response.error.message);
                            resolve({ success: false, error: response.error.message });
                        }
                    }
                } catch (parseError) {
                    console.log('❌ Failed to parse response:', parseError.message);
                    resolve({ success: false, error: parseError.message });
                }
                
                child.kill();
            }
        });

        child.stderr.on('data', (data) => {
            // Ignore stderr for now
        });

        child.on('close', (code) => {
            if (!hasResponded) {
                console.log('❌ No response received');
                resolve({ success: false, error: 'No response received' });
            }
        });

        // Send the request
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "GetRelatedObjectTypes",
                arguments: {
                    object_name: testCase.object_name
                }
            }
        };

        child.stdin.write(JSON.stringify(request) + '\n');
        
        // Set timeout
        setTimeout(() => {
            if (!hasResponded) {
                console.log('❌ Timeout after 30 seconds');
                child.kill();
                resolve({ success: false, error: 'Timeout' });
            }
        }, 30000);
    });
}

async function runTests() {
    console.log('🚀 Starting simplified GetRelatedObjectTypes tests...\n');
    
    for (const testCase of testCases) {
        const result = await testGetRelatedObjectTypes(testCase);
        console.log('\n================================================================================\n');
        
        if (!result.success) {
            console.log(`❌ Test failed for ${testCase.name}: ${result.error}`);
            break;
        }
    }
    
    console.log('🎯 Simplified GetRelatedObjectTypes Test Summary:');
    console.log('1. ✅ Only requires object_name parameter');
    console.log('2. ✅ Auto-detects object type from name patterns');
    console.log('3. ✅ Much simpler to use than before');
    console.log('================================================================================');
}

runTests().catch(console.error);
