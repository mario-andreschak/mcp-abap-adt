const { spawn } = require('child_process');
const path = require('path');

// Test the new two-step approach: GetRelatedObjectTypes -> GetObjectsByType
async function testTwoStepApproach() {
    console.log('🧪 Testing Two-Step Object Discovery Approach...\n');

    const parentName = 'SAPMV45A';
    const parentTechName = 'SAPMV45A';
    const parentType = 'PROG/P';

    // Step 1: Get available object types
    console.log('📋 Step 1: Discovering available object types...');
    console.log('─'.repeat(80));
    
    try {
        const typesResult = await callTool('GetRelatedObjectTypes', {
            parent_name: parentName,
            parent_tech_name: parentTechName,
            parent_type: parentType,
            with_short_descriptions: true
        });
        
        console.log('✅ Success! Available object types:');
        console.log(typesResult.substring(0, 2000));
        if (typesResult.length > 2000) {
            console.log(`\n... (truncated, total length: ${typesResult.length} characters)`);
        }
        
        // Extract node IDs from the response for testing Step 2
        const nodeIdMatches = typesResult.match(/Node ID: (\d+)/g);
        const nodeIds = nodeIdMatches ? nodeIdMatches.map(match => match.replace('Node ID: ', '')) : [];
        
        console.log(`\n🔍 Found ${nodeIds.length} node IDs for Step 2 testing`);
        
        // Step 2: Test getting objects for a few specific types
        const testNodeIds = nodeIds.slice(0, 3); // Test first 3 types
        
        for (const nodeId of testNodeIds) {
            console.log('\n' + '='.repeat(80));
            console.log(`📋 Step 2: Getting objects for node_id '${nodeId}'...`);
            console.log('─'.repeat(80));
            
            try {
                const objectsResult = await callTool('GetObjectsByType', {
                    parent_name: parentName,
                    parent_tech_name: parentTechName,
                    parent_type: parentType,
                    node_id: nodeId,
                    with_short_descriptions: true
                });
                
                console.log('✅ Success!');
                console.log('📄 Objects preview:');
                
                // Show first 1000 characters of response
                const preview = objectsResult.substring(0, 1000);
                console.log(preview);
                if (objectsResult.length > 1000) {
                    console.log(`\n... (truncated, total length: ${objectsResult.length} characters)`);
                }
                
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
        }
        
        // Step 3: Test with filter
        console.log('\n' + '='.repeat(80));
        console.log('📋 Step 3: Testing with object filter (enhancement)...');
        console.log('─'.repeat(80));
        
        try {
            const filteredResult = await callTool('GetRelatedObjectTypes', {
                parent_name: parentName,
                parent_tech_name: parentTechName,
                parent_type: parentType,
                object_filter: 'enhancement',
                with_short_descriptions: true
            });
            
            console.log('✅ Success! Filtered object types:');
            console.log(filteredResult);
            
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Error in Step 1:', error.message);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 Two-Step Approach Summary:');
    console.log('1. GetRelatedObjectTypes - Discovers available object types with node IDs');
    console.log('2. GetObjectsByType - Gets specific objects using node_id from step 1');
    console.log('3. Both support filtering and formatting options');
    console.log('='.repeat(80));
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
testTwoStepApproach().catch(console.error);
