const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_OBJECT_NAME = 'RM07ALVI'; // Standard SAP include that should exist
const TEST_OBJECT_TYPE = 'include'; // Type of object to test

async function testWhereUsed() {
    console.log('🔍 Testing GetWhereUsed handler...');
    
    const serverPath = path.join(__dirname, '../dist/index.js');
    
    return new Promise((resolve, reject) => {
        const server = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });

        let responseData = '';
        let errorData = '';

        server.stdout.on('data', (data) => {
            responseData += data.toString();
        });

        server.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        server.on('close', (code) => {
            if (code !== 0) {
                console.error('❌ Server stderr:', errorData);
                reject(new Error(`Server exited with code ${code}`));
                return;
            }

            try {
                // Parse the response
                const lines = responseData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const response = JSON.parse(lastLine);

                console.log('✅ GetWhereUsed test completed');
                console.log('📊 Response structure:', {
                    hasContent: !!response.content,
                    contentLength: response.content ? response.content.length : 0,
                    isError: response.isError
                });

                if (response.content && response.content[0] && response.content[0].text) {
                    try {
                        const parsedContent = JSON.parse(response.content[0].text);
                        console.log('📋 Where-used analysis result:', {
                            objectName: parsedContent.object_name,
                            objectType: parsedContent.object_type,
                            totalReferences: parsedContent.total_references,
                            hasReferences: parsedContent.references && parsedContent.references.length > 0
                        });
                        
                        if (parsedContent.references && parsedContent.references.length > 0) {
                            console.log('🔗 Sample references:');
                            parsedContent.references.slice(0, 3).forEach((ref, index) => {
                                console.log(`   ${index + 1}. ${ref.name} (${ref.type})`);
                            });
                        }
                    } catch (parseError) {
                        console.log('📄 Raw response content (first 500 chars):', 
                            response.content[0].text.substring(0, 500));
                    }
                }

                resolve(response);
            } catch (error) {
                console.error('❌ Failed to parse response:', error.message);
                console.error('Raw response:', responseData);
                reject(error);
            }
        });

        // Send the test request
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "GetWhereUsed",
                arguments: {
                    object_name: TEST_OBJECT_NAME,
                    object_type: TEST_OBJECT_TYPE
                }
            }
        };

        console.log(`📤 Sending request for ${TEST_OBJECT_TYPE}: ${TEST_OBJECT_NAME}`);
        server.stdin.write(JSON.stringify(request) + '\n');
        server.stdin.end();

        // Set timeout
        setTimeout(() => {
            server.kill();
            reject(new Error('Test timeout after 30 seconds'));
        }, 30000);
    });
}

// Run the test
if (require.main === module) {
    testWhereUsed()
        .then(() => {
            console.log('🎉 Where-used test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Where-used test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testWhereUsed };
