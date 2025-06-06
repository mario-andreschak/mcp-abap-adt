const { spawn } = require('child_process');
const path = require('path');

/**
 * Test detailed parameter functionality in web interface
 */
async function testDetailedParameter() {
    console.log('🧪 Testing Detailed Parameter Functionality\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('🎯 Testing CL_BUS_ABSTRACT_MAIN_SCREEN class with different detailed values...\n');
    
    // Test 1: detailed=false (default)
    console.log('📋 TEST 1: detailed=false (minimal mode)');
    const minimalResult = await callMcpTool(serverPath, {
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
    
    if (!minimalResult.error) {
        const minimalResponse = JSON.parse(minimalResult.content[0].text);
        console.log(`   ✅ Success: Found ${minimalResponse.total_found}, Showing ${minimalResponse.total_references}, Filtered ${minimalResponse.filtered_out}`);
        console.log(`   🔍 Detailed mode: ${minimalResponse.detailed}`);
        console.log(`   📝 Sample results:`);
        minimalResponse.references.slice(0, 3).forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type})`);
        });
    } else {
        console.log(`   ❌ Error:`, minimalResult.error);
    }
    
    console.log('');
    
    // Test 2: detailed=true (full mode)
    console.log('📋 TEST 2: detailed=true (full mode)');
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
        const detailedResponse = JSON.parse(detailedResult.content[0].text);
        console.log(`   ✅ Success: Found ${detailedResponse.total_found}, Showing ${detailedResponse.total_references}, Filtered ${detailedResponse.filtered_out}`);
        console.log(`   🔍 Detailed mode: ${detailedResponse.detailed}`);
        console.log(`   📝 Sample results:`);
        detailedResponse.references.slice(0, 3).forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type})`);
        });
    } else {
        console.log(`   ❌ Error:`, detailedResult.error);
    }
    
    console.log('');
    
    // Test 3: No detailed parameter (should default to false)
    console.log('📋 TEST 3: No detailed parameter (should default to false)');
    const defaultResult = await callMcpTool(serverPath, {
        method: 'tools/call',
        params: {
            name: 'GetWhereUsed',
            arguments: {
                object_name: 'CL_BUS_ABSTRACT_MAIN_SCREEN',
                object_type: 'class'
                // No detailed parameter
            }
        }
    });
    
    if (!defaultResult.error) {
        const defaultResponse = JSON.parse(defaultResult.content[0].text);
        console.log(`   ✅ Success: Found ${defaultResponse.total_found}, Showing ${defaultResponse.total_references}, Filtered ${defaultResponse.filtered_out}`);
        console.log(`   🔍 Detailed mode: ${defaultResponse.detailed}`);
        console.log(`   📝 Sample results:`);
        defaultResponse.references.slice(0, 3).forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type})`);
        });
    } else {
        console.log(`   ❌ Error:`, defaultResult.error);
    }
    
    console.log('\n🎯 COMPARISON:');
    if (!minimalResult.error && !detailedResult.error && !defaultResult.error) {
        const minimalResponse = JSON.parse(minimalResult.content[0].text);
        const detailedResponse = JSON.parse(detailedResult.content[0].text);
        const defaultResponse = JSON.parse(defaultResult.content[0].text);
        
        console.log(`   📊 Minimal (detailed=false): ${minimalResponse.total_references} results`);
        console.log(`   📊 Detailed (detailed=true): ${detailedResponse.total_references} results`);
        console.log(`   📊 Default (no parameter): ${defaultResponse.total_references} results`);
        
        if (minimalResponse.total_references === defaultResponse.total_references) {
            console.log(`   ✅ Default correctly uses minimal mode`);
        } else {
            console.log(`   ❌ Default mode mismatch!`);
        }
        
        if (detailedResponse.total_references > minimalResponse.total_references) {
            console.log(`   ✅ Detailed mode shows more results than minimal`);
        } else {
            console.log(`   ❌ Detailed mode doesn't show more results!`);
        }
        
        console.log(`\n   🎯 Filtering efficiency: ${Math.round((minimalResponse.filtered_out / minimalResponse.total_found) * 100)}% noise reduction in minimal mode`);
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
testDetailedParameter().catch(console.error);
