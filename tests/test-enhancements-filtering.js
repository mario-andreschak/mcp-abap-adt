const { spawn } = require('child_process');
const path = require('path');

/**
 * Test GetEnhancements with detailed parameter
 */
async function testEnhancementsFiltering() {
    console.log('🔍 GetEnhancements Filtering Demo\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('Testing with SAPMV45A program...\n');
    
    // Test minimal mode
    console.log('📋 MINIMAL MODE (default):');
    const minimalResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetEnhancements',
            arguments: {
                object_name: 'SAPMV45A'
            }
        }
    });
    
    if (!minimalResult.error) {
        const response = JSON.parse(minimalResult.content[0].text);
        console.log(`✅ Object: ${response.object_name} (${response.object_type})`);
        console.log(`📊 Total enhancements: ${response.total_enhancements || response.enhancements?.length || 0}`);
        console.log(`🔍 Detailed mode: ${response.detailed}`);
        
        if (response.enhancements && response.enhancements.length > 0) {
            console.log('📝 Enhancements (source code truncated):');
            response.enhancements.slice(0, 3).forEach((enh, index) => {
                const sourcePreview = enh.sourceCode ? 
                    (enh.sourceCode.length > 50 ? enh.sourceCode.substring(0, 50) + '...' : enh.sourceCode) 
                    : 'no source';
                console.log(`   ${index + 1}. ${enh.name} (${enh.type}) - ${sourcePreview}`);
            });
            if (response.enhancements.length > 3) {
                console.log(`   ... and ${response.enhancements.length - 3} more`);
            }
        }
    }
    
    console.log('\n📋 DETAILED MODE (detailed=true):');
    const detailedResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetEnhancements',
            arguments: {
                object_name: 'SAPMV45A',
                detailed: true
            }
        }
    });
    
    if (!detailedResult.error) {
        const response = JSON.parse(detailedResult.content[0].text);
        console.log(`✅ Object: ${response.object_name} (${response.object_type})`);
        console.log(`📊 Total enhancements: ${response.total_enhancements || response.enhancements?.length || 0}`);
        console.log(`🔍 Detailed mode: ${response.detailed}`);
        console.log(`📄 Raw XML included: ${response.raw_xml ? 'Yes' : 'No'}`);
        
        if (response.enhancements && response.enhancements.length > 0) {
            console.log('📝 Enhancements (full source code):');
            response.enhancements.slice(0, 2).forEach((enh, index) => {
                const sourceLines = enh.sourceCode ? enh.sourceCode.split('\n').length : 0;
                console.log(`   ${index + 1}. ${enh.name} (${enh.type}) - ${sourceLines} lines of code`);
                if (enh.sourceCode && sourceLines <= 5) {
                    console.log(`      Source: ${enh.sourceCode.replace(/\n/g, '\\n')}`);
                }
            });
            if (response.enhancements.length > 2) {
                console.log(`   ... and ${response.enhancements.length - 2} more`);
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
testEnhancementsFiltering().catch(console.error);
