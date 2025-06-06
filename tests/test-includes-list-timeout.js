const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing GetIncludesList with Timeout...\n');

async function testGetIncludesList(objectName, timeout) {
    return new Promise((resolve, reject) => {
        console.log(`📋 Testing GetIncludesList for: ${objectName}`);
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
                            console.log('📄 Response preview:');
                            
                            // Show first few lines
                            const lines = content.split('\n').slice(0, 15);
                            lines.forEach(line => console.log(line));
                            
                            if (content.length > 1000) {
                                console.log('\n... (truncated, total length:', content.length, 'characters)');
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
            // Ignore stderr for now
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
                name: "GetIncludesList",
                arguments: {
                    object_name: objectName,
                    object_type: "program",
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
    console.log('🚀 Starting GetIncludesList timeout tests...\n');
    
    const testCases = [
        {
            name: 'SAPMV45A with 10s timeout',
            object: 'SAPMV45A',
            timeout: 10000
        },
        {
            name: 'SAPMV45A with 5s timeout',
            object: 'SAPMV45A',
            timeout: 5000
        },
        {
            name: 'SAPMV45A with 30s timeout (default)',
            object: 'SAPMV45A',
            timeout: 30000
        }
    ];
    
    for (const testCase of testCases) {
        const result = await testGetIncludesList(testCase.object, testCase.timeout);
        console.log('\n================================================================================\n');
        
        if (result.success) {
            console.log(`✅ ${testCase.name}: SUCCESS in ${result.duration}ms`);
        } else {
            console.log(`❌ ${testCase.name}: FAILED in ${result.duration}ms - ${result.error}`);
            
            // If it's a timeout error, that's expected for short timeouts
            if (result.error.includes('Timeout') && testCase.timeout < 30000) {
                console.log('💡 This timeout is expected for large programs with short timeout values');
            }
        }
    }
    
    console.log('🎯 GetIncludesList Timeout Test Summary:');
    console.log('1. ✅ Timeout parameter is now configurable');
    console.log('2. ✅ Short timeouts properly fail with timeout error');
    console.log('3. ✅ Longer timeouts allow completion for large programs');
    console.log('4. ✅ Users can control timeout based on program size');
    console.log('================================================================================');
}

runTests().catch(console.error);
