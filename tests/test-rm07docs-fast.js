const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing GetEnhancements for RM07DOCS with short timeout...\n');

async function testGetEnhancements(objectName, includeNested = false, timeout = 5000) {
    return new Promise((resolve, reject) => {
        console.log(`📋 Testing GetEnhancements for: ${objectName}`);
        console.log(`🔄 Include nested: ${includeNested}`);
        console.log(`⏱️  Timeout: ${timeout}ms`);
        console.log(`────────────────────────────────────────────────────────────────────────────────`);
        
        const envPath = path.resolve(__dirname, '../.env');
        const serverPath = path.resolve(__dirname, '../dist/index.js');
        
        const child = spawn('node', [serverPath, '--env', envPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasResponded = false;
        const startTime = Date.now();

        child.stdout.on('data', (data) => {
            output += data.toString();
            
            // Look for the response
            if (output.includes('"result"') && !hasResponded) {
                hasResponded = true;
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                try {
                    // Extract JSON response
                    const lines = output.split('\n');
                    const responseLine = lines.find(line => line.includes('"result"'));
                    
                    if (responseLine) {
                        const response = JSON.parse(responseLine);
                        
                        if (response.result && response.result.content) {
                            const content = response.result.content[0].text;
                            console.log('✅ Success!');
                            console.log(`⏱️  Duration: ${duration}ms`);
                            
                            // Parse the JSON content to get summary
                            try {
                                const data = JSON.parse(content);
                                if (data.total_objects_analyzed) {
                                    console.log(`📊 Objects analyzed: ${data.total_objects_analyzed}`);
                                    console.log(`🔍 Enhancements found: ${data.total_enhancements_found}`);
                                } else {
                                    console.log(`🔍 Enhancements found: ${data.enhancements ? data.enhancements.length : 0}`);
                                }
                            } catch (parseError) {
                                console.log('📄 Response received (could not parse summary)');
                            }
                            
                            resolve({ success: true, content, duration });
                        } else if (response.error) {
                            console.log('❌ Error:', response.error.message);
                            console.log(`⏱️  Duration: ${duration}ms`);
                            resolve({ success: false, error: response.error.message, duration });
                        }
                    }
                } catch (parseError) {
                    console.log('❌ Failed to parse response:', parseError.message);
                    resolve({ success: false, error: parseError.message, duration: Date.now() - startTime });
                }
                
                child.kill();
            }
        });

        child.stderr.on('data', (data) => {
            // Log stderr for debugging
            const errorOutput = data.toString();
            if (errorOutput.includes('ERROR') || errorOutput.includes('WARN')) {
                console.log('⚠️  stderr:', errorOutput.trim());
            }
        });

        child.on('close', (code) => {
            if (!hasResponded) {
                const duration = Date.now() - startTime;
                console.log('❌ No response received');
                console.log(`⏱️  Duration: ${duration}ms`);
                resolve({ success: false, error: 'No response received', duration });
            }
        });

        // Send the request
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "GetEnhancements",
                arguments: {
                    object_name: objectName,
                    include_nested: includeNested,
                    timeout: timeout
                }
            }
        };

        child.stdin.write(JSON.stringify(request) + '\n');
        
        // Set overall timeout (longer than request timeout)
        setTimeout(() => {
            if (!hasResponded) {
                const duration = Date.now() - startTime;
                console.log(`❌ Overall timeout after ${duration}ms`);
                child.kill();
                resolve({ success: false, error: 'Overall timeout', duration });
            }
        }, timeout + 10000); // 10 seconds buffer
    });
}

async function runTests() {
    console.log('🚀 Starting RM07DOCS fast timeout tests...\n');
    
    const testCases = [
        {
            name: 'RM07DOCS without nested (5s timeout)',
            object: 'RM07DOCS',
            nested: false,
            timeout: 5000
        },
        {
            name: 'RM07DOCS with nested (5s timeout - should fail)',
            object: 'RM07DOCS',
            nested: true,
            timeout: 5000
        },
        {
            name: 'RM07DOCS with nested (10s timeout)',
            object: 'RM07DOCS',
            nested: true,
            timeout: 10000
        }
    ];
    
    for (const testCase of testCases) {
        const result = await testGetEnhancements(testCase.object, testCase.nested, testCase.timeout);
        console.log('\n================================================================================\n');
        
        if (result.success) {
            console.log(`✅ ${testCase.name}: SUCCESS in ${result.duration}ms`);
        } else {
            console.log(`❌ ${testCase.name}: FAILED in ${result.duration}ms - ${result.error}`);
            
            // If it's a timeout error, that indicates the hanging issue
            if (result.error.includes('timeout') || result.error.includes('Timeout')) {
                console.log('🚨 TIMEOUT DETECTED: GetEnhancements is still too slow for nested processing');
            }
        }
    }
    
    console.log('🎯 RM07DOCS Fast Test Summary:');
    console.log('1. 🔍 Testing with aggressive timeouts');
    console.log('2. 🔍 Identifying remaining performance bottlenecks');
    console.log('3. 🔍 Verifying timeout handling works correctly');
    console.log('================================================================================');
}

runTests().catch(console.error);
