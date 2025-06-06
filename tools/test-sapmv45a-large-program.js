#!/usr/bin/env node

/**
 * Test script for SAPMV45A - large SAP program with many includes
 * Tests individual operations: program reading, includes list, enhancements
 */

const { spawn } = require('child_process');
const path = require('path');

const PROGRAM_NAME = 'SAPMV45A';

// Test scenarios for SAPMV45A
const testScenarios = [
    {
        name: "1. Read program source code",
        tool: "get_program",
        args: {
            program_name: PROGRAM_NAME
        },
        timeout: 30000, // 30 seconds
        description: "Retrieve the main program source code"
    },
    {
        name: "2. Get includes list (without recursion)",
        tool: "get_includes_list", 
        args: {
            object_name: PROGRAM_NAME,
            object_type: "program",
            recursive: false  // Non-recursive to be faster
        },
        timeout: 60000, // 1 minute
        description: "Get direct includes only (non-recursive)"
    },
    {
        name: "3. Get includes list (with recursion - risky)",
        tool: "get_includes_list",
        args: {
            object_name: PROGRAM_NAME,
            object_type: "program", 
            recursive: true   // Full recursive - might timeout
        },
        timeout: 120000, // 2 minutes
        description: "Get all includes recursively (might timeout due to size)"
    },
    {
        name: "4. Get enhancements (main program only)",
        tool: "get_enhancements",
        args: {
            object_name: PROGRAM_NAME,
            include_nested: false  // Only main program
        },
        timeout: 45000, // 45 seconds
        description: "Get enhancements from main program only"
    },
    {
        name: "5. Get enhancements (limited nested - 5 includes)",
        tool: "get_enhancements",
        args: {
            object_name: PROGRAM_NAME,
            include_nested: true,
            max_includes: 5,           // Very limited
            timeout_per_include: 10000, // 10 seconds per include
            total_timeout: 90000       // 1.5 minutes total
        },
        timeout: 120000, // 2 minutes test timeout
        description: "Get enhancements with very limited nested search"
    },
    {
        name: "6. Get enhancements (medium nested - 20 includes)",
        tool: "get_enhancements", 
        args: {
            object_name: PROGRAM_NAME,
            include_nested: true,
            max_includes: 20,          // Medium limit
            timeout_per_include: 15000, // 15 seconds per include
            total_timeout: 180000      // 3 minutes total
        },
        timeout: 240000, // 4 minutes test timeout
        description: "Get enhancements with medium nested search"
    }
];

async function runSingleTest(scenario) {
    console.log(`\n🧪 ${scenario.name}`);
    console.log(`📋 ${scenario.description}`);
    console.log(`🔧 Tool: ${scenario.tool}`);
    console.log(`📝 Args:`, JSON.stringify(scenario.args, null, 2));
    
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        // Prepare the MCP request
        const mcpRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: scenario.tool,
                arguments: scenario.args
            }
        };
        
        // Path to the compiled JavaScript file
        const scriptPath = path.join(__dirname, '..', 'dist', 'index.js');
        
        // Spawn the MCP server
        const child = spawn('node', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        let completed = false;
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (completed) return; // Avoid double resolution
            completed = true;
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`⏱️  Completed in ${duration}ms (${(duration/1000).toFixed(1)}s)`);
            
            if (code === 0) {
                try {
                    // Parse the JSON response
                    const lines = stdout.trim().split('\n');
                    const responseLine = lines.find(line => {
                        try {
                            const parsed = JSON.parse(line);
                            return parsed.result;
                        } catch {
                            return false;
                        }
                    });
                    
                    if (responseLine) {
                        const response = JSON.parse(responseLine);
                        
                        if (response.result && response.result.content) {
                            const resultText = response.result.content[0].text;
                            
                            // Try to parse as JSON for structured results
                            let parsedResult;
                            try {
                                parsedResult = JSON.parse(resultText);
                            } catch {
                                parsedResult = { raw: resultText };
                            }
                            
                            let summary = '';
                            if (scenario.tool === 'get_program') {
                                const lines = resultText.split('\n').length;
                                summary = `📄 Program has ${lines} lines`;
                            } else if (scenario.tool === 'get_includes_list') {
                                if (typeof parsedResult === 'object' && parsedResult.includes) {
                                    summary = `📁 Found ${parsedResult.includes.length} includes`;
                                } else {
                                    const includesMatch = resultText.match(/Found (\d+) includes/);
                                    summary = includesMatch ? `📁 Found ${includesMatch[1]} includes` : '📁 Includes listed';
                                }
                            } else if (scenario.tool === 'get_enhancements') {
                                if (typeof parsedResult === 'object') {
                                    const total = parsedResult.total_enhancements_found || 0;
                                    const objects = parsedResult.total_objects_analyzed || 1;
                                    const partial = parsedResult.partial_result ? ' (partial)' : '';
                                    summary = `🔧 Found ${total} enhancements in ${objects} objects${partial}`;
                                } else {
                                    summary = '🔧 Enhancements retrieved';
                                }
                            }
                            
                            console.log(`✅ Success! ${summary}`);
                            
                            resolve({
                                success: true,
                                duration: duration,
                                summary: summary,
                                dataSize: resultText.length
                            });
                        } else {
                            console.log(`❌ No content in response`);
                            resolve({
                                success: false,
                                duration: duration,
                                error: 'No content in response'
                            });
                        }
                    } else {
                        console.log(`❌ No valid JSON response found`);
                        console.log(`📤 First 200 chars of STDOUT:`, stdout.slice(0, 200));
                        resolve({
                            success: false,
                            duration: duration,
                            error: 'No valid JSON response'
                        });
                    }
                } catch (error) {
                    console.log(`❌ Failed to parse response:`, error.message);
                    console.log(`📤 First 200 chars of STDOUT:`, stdout.slice(0, 200));
                    resolve({
                        success: false,
                        duration: duration,
                        error: error.message
                    });
                }
            } else {
                console.log(`❌ Process exited with code ${code}`);
                if (stderr) {
                    console.log(`📤 STDERR:`, stderr.slice(0, 300));
                }
                resolve({
                    success: false,
                    duration: duration,
                    error: `Process exited with code ${code}`
                });
            }
        });
        
        child.on('error', (error) => {
            if (completed) return;
            completed = true;
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`❌ Process error:`, error.message);
            resolve({
                success: false,
                duration: duration,
                error: error.message
            });
        });
        
        // Send the request
        child.stdin.write(JSON.stringify(mcpRequest) + '\n');
        child.stdin.end();
        
        // Set scenario-specific timeout
        setTimeout(() => {
            if (!completed && !child.killed) {
                completed = true;
                console.log(`⏰ Test timed out after ${scenario.timeout}ms, killing process`);
                child.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!child.killed) {
                        console.log(`💀 Force killing process with SIGKILL`);
                        child.kill('SIGKILL');
                    }
                }, 5000);
                
                resolve({
                    success: false,
                    duration: scenario.timeout,
                    error: `Test timeout (${scenario.timeout}ms)`
                });
            }
        }, scenario.timeout);
    });
}

async function main() {
    console.log('🚀 Starting SAPMV45A Large Program Tests');
    console.log('=' .repeat(70));
    console.log(`🎯 Target Program: ${PROGRAM_NAME}`);
    console.log(`📊 Total Tests: ${testScenarios.length}`);
    console.log('');
    
    // Build the project first
    console.log('🔨 Building project...');
    
    const buildResult = await new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const npmCommand = isWindows ? 'npm.cmd' : 'npm';
        
        const buildProcess = spawn(npmCommand, ['run', 'build'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            shell: isWindows
        });
        
        buildProcess.on('close', (code) => {
            resolve(code === 0);
        });
    });
    
    if (!buildResult) {
        console.log('❌ Build failed, aborting tests');
        process.exit(1);
    }
    
    console.log('✅ Build successful\n');
    
    const results = [];
    
    // Run each test scenario
    for (const scenario of testScenarios) {
        const result = await runSingleTest(scenario);
        results.push({ 
            scenario: scenario.name, 
            tool: scenario.tool,
            ...result 
        });
        
        // Wait between tests to let connections close
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Summary
    console.log('\n📊 SAPMV45A Test Results Summary');
    console.log('=' .repeat(70));
    
    let totalDuration = 0;
    results.forEach((result, index) => {
        totalDuration += result.duration;
        
        console.log(`\n${index + 1}. ${result.scenario}`);
        console.log(`   Tool: ${result.tool}`);
        console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Duration: ${result.duration}ms (${(result.duration/1000).toFixed(1)}s)`);
        
        if (result.success) {
            if (result.summary) {
                console.log(`   Result: ${result.summary}`);
            }
            if (result.dataSize) {
                console.log(`   Data Size: ${result.dataSize} characters`);
            }
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Tests Passed: ${successCount}/${results.length}`);
    console.log(`   Total Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(1)}s)`);
    console.log(`   Average per Test: ${Math.round(totalDuration/results.length)}ms`);
    
    // Specific analysis
    console.log(`\n📈 Analysis:`);
    
    const programTest = results.find(r => r.tool === 'get_program');
    if (programTest?.success) {
        console.log(`   ✅ Program source readable (${(programTest.duration/1000).toFixed(1)}s)`);
    } else {
        console.log(`   ❌ Program source failed`);
    }
    
    const includesTests = results.filter(r => r.tool === 'get_includes_list');
    const includesSuccess = includesTests.filter(r => r.success).length;
    console.log(`   📁 Includes list: ${includesSuccess}/${includesTests.length} successful`);
    
    const enhancementTests = results.filter(r => r.tool === 'get_enhancements');
    const enhancementSuccess = enhancementTests.filter(r => r.success).length;
    console.log(`   🔧 Enhancement searches: ${enhancementSuccess}/${enhancementTests.length} successful`);
    
    if (successCount === results.length) {
        console.log(`\n🎉 All tests passed! SAPMV45A handling is working correctly.`);
    } else if (successCount > 0) {
        console.log(`\n⚠️  Partial success. Some operations work, others need optimization.`);
    } else {
        console.log(`\n💥 All tests failed. Need to investigate connection/authentication issues.`);
    }
}

main().catch(console.error).finally(() => {
    console.log('\n🏁 Forcing process exit...');
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});
