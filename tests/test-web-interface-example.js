const { spawn } = require('child_process');
const path = require('path');

/**
 * Example usage for web interface
 */
async function webInterfaceExample() {
    console.log('🌐 Web Interface Usage Example\n');
    console.log('📋 How to use GetWhereUsed tool in web interface:\n');

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    
    console.log('🎯 EXAMPLE 1: Quick overview (minimal mode)');
    console.log('   Parameters:');
    console.log('   - object_name: "CL_BUS_ABSTRACT_MAIN_SCREEN"');
    console.log('   - object_type: "class"');
    console.log('   - detailed: false (or leave empty)');
    console.log('');
    
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
        const response = JSON.parse(minimalResult.content[0].text);
        console.log('   📊 Result:');
        console.log(`   - Total found: ${response.total_found}`);
        console.log(`   - Showing: ${response.total_references} (most relevant)`);
        console.log(`   - Filtered out: ${response.filtered_out} (noise)`);
        console.log('   📝 Key findings:');
        response.references.forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type}) ${ref.isResult ? '⭐' : ''}`);
        });
    }
    
    console.log('\n🎯 EXAMPLE 2: Complete analysis (detailed mode)');
    console.log('   Parameters:');
    console.log('   - object_name: "CL_BUS_ABSTRACT_MAIN_SCREEN"');
    console.log('   - object_type: "class"');
    console.log('   - detailed: true');
    console.log('');
    
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
        console.log('   📊 Result:');
        console.log(`   - Total found: ${response.total_found}`);
        console.log(`   - Showing: ${response.total_references} (everything)`);
        console.log(`   - Filtered out: ${response.filtered_out}`);
        console.log('   📝 All references (first 10):');
        response.references.slice(0, 10).forEach((ref, i) => {
            console.log(`      ${i + 1}. ${ref.name} (${ref.type}) ${ref.isResult ? '⭐' : ''}`);
        });
        if (response.references.length > 10) {
            console.log(`      ... and ${response.references.length - 10} more`);
        }
    }
    
    console.log('\n📋 SUPPORTED OBJECT TYPES:');
    console.log('   - class: ABAP classes (e.g., "CL_BUS_ABSTRACT_MAIN_SCREEN")');
    console.log('   - program: ABAP programs (e.g., "SAPMV45A")');
    console.log('   - include: ABAP includes (e.g., "MV45AFZZ")');
    console.log('   - function: Function modules (e.g., "BAPI_CUSTOMER_GETDETAIL2")');
    console.log('   - interface: ABAP interfaces (e.g., "IF_SERIALIZABLE_OBJECT")');
    console.log('   - package: ABAP packages (e.g., "BUS_TOOLS")');
    
    console.log('\n🎯 WHEN TO USE EACH MODE:');
    console.log('   📋 Minimal mode (detailed=false):');
    console.log('      ✅ Quick overview of main usages');
    console.log('      ✅ Focus on enhancements and direct usage');
    console.log('      ✅ 90% noise reduction');
    console.log('      ✅ Perfect for initial analysis');
    
    console.log('\n   📋 Detailed mode (detailed=true):');
    console.log('      ✅ Complete audit of all references');
    console.log('      ✅ Includes internal class structure');
    console.log('      ✅ Shows packages and organizational info');
    console.log('      ✅ Perfect for thorough investigation');
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

// Run the example
webInterfaceExample().catch(console.error);
