const { spawn } = require('child_process');
const path = require('path');

/**
 * Final comparison test showing the difference between minimal and detailed modes
 */
async function testFinalComparison() {
    console.log('🎯 FINAL COMPARISON: Minimal vs Detailed Modes\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('🧪 Testing CL_BUS_ABSTRACT_MAIN_SCREEN class...\n');
    
    // Test minimal mode
    console.log('📋 MINIMAL MODE (detailed=false):');
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
        console.log(`   ✅ Found: ${minimalResponse.total_found}, Showing: ${minimalResponse.total_references}, Filtered: ${minimalResponse.filtered_out}`);
        console.log(`   🎯 Key findings:`);
        minimalResponse.references.slice(0, 5).forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type}) ${ref.isResult ? '⭐' : ''}`);
        });
    } else {
        console.log(`   ❌ Error:`, minimalResult.error);
    }
    
    console.log('');
    
    // Test detailed mode
    console.log('📋 DETAILED MODE (detailed=true):');
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
        console.log(`   ✅ Found: ${detailedResponse.total_found}, Showing: ${detailedResponse.total_references}, Filtered: ${detailedResponse.filtered_out}`);
        console.log(`   🔍 All references (first 10):`);
        detailedResponse.references.slice(0, 10).forEach((ref, i) => {
            const usage = ref.usageInformation || 'no usage info';
            console.log(`      ${i + 1}. ${ref.name} (${ref.type}) - ${usage} ${ref.isResult ? '⭐' : ''}`);
        });
        if (detailedResponse.references.length > 10) {
            console.log(`      ... and ${detailedResponse.references.length - 10} more`);
        }
    } else {
        console.log(`   ❌ Error:`, detailedResult.error);
    }
    
    console.log('\n🎯 SUMMARY:');
    if (!minimalResult.error && !detailedResult.error) {
        const minimalResponse = JSON.parse(minimalResult.content[0].text);
        const detailedResponse = JSON.parse(detailedResult.content[0].text);
        
        console.log(`   📊 Minimal mode: Shows ${minimalResponse.total_references}/${minimalResponse.total_found} most relevant results`);
        console.log(`   📊 Detailed mode: Shows ${detailedResponse.total_references}/${detailedResponse.total_found} all results`);
        console.log(`   🎯 Filtering efficiency: ${Math.round((minimalResponse.filtered_out / minimalResponse.total_found) * 100)}% noise reduction`);
        
        console.log('\n   🔍 What gets filtered out in minimal mode:');
        console.log('      ❌ Class internal sections (Public/Private/Protected Section)');
        console.log('      ❌ Internal class methods and attributes');
        console.log('      ❌ Package references (organizational structure)');
        console.log('      ❌ Function groups (shows only specific functions)');
        console.log('      ❌ Programs/includes without direct usage');
        
        console.log('\n   ✅ What stays in minimal mode:');
        console.log('      ⭐ Enhancement implementations (ENHO/XHH)');
        console.log('      ⭐ Main results marked as important');
        console.log('      ⭐ Function modules with direct usage');
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
testFinalComparison().catch(console.error);
