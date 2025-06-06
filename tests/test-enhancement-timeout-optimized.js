#!/usr/bin/env node

/**
 * Test script for optimized enhancement timeout handling
 * Tests the enhanced timeout features with configurable parameters
 */

const { spawn } = require('child_process');
const path = require('path');

// Test scenarios with different timeout configurations
const testScenarios = [
    {
        name: "Quick test - 5 includes, 10s timeout each",
        args: {
            object_name: "/SAPAPO/RMSNPSRC",
            include_nested: true,
            timeout_per_include: 10000,  // 10 seconds per include
            max_includes: 5,             // Only first 5 includes
            total_timeout: 120000        // 2 minutes total
        }
    },
    {
        name: "Medium test - 20 includes, 15s timeout each",
        args: {
            object_name: "/SAPAPO/RMSNPSRC",
            include_nested: true,
            timeout_per_include: 15000,  // 15 seconds per include
            max_includes: 20,            // First 20 includes
            total_timeout: 180000        // 3 minutes total
        }
    },
    {
        name: "Conservative test - default timeouts",
        args: {
            object_name: "/SAPAPO/RMSNPSRC",
            include_nested: true
            // Uses defaults: 30s per include, 50 max includes, 5min total
        }
    }
];

async function runTest(scenario) {
    console.log(`\n🧪 Running scenario: ${scenario.name}`);
    console.log(`📝 Parameters:`, JSON.stringify(scenario.args, null, 2));
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // Prepare the MCP request
        const mcpRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "GetEnhancements",
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
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`⏱️  Test completed in ${duration}ms`);
            
            if (code === 0) {
                try {
                    // Parse the JSON response
                    const lines = stdout.trim().split('\n');
                    const responseLine = lines.find(line => {
                        try {
                            const parsed = JSON.parse(line);
                            return parsed.result && parsed.result.content;
                        } catch {
                            return false;
                        }
                    });
                    
                    if (responseLine) {
                        const response = JSON.parse(responseLine);
                        const result = JSON.parse(response.result.content[0].text);
                        
                        console.log(`✅ Success! Found ${result.total_enhancements_found} enhancements in ${result.total_objects_analyzed} objects`);
                        
                        if (result.partial_result) {
                            console.log(`⚠️  Partial result due to timeout: ${result.error}`);
                        }
                        
                        resolve({
                            success: true,
                            duration: duration,
                            enhancements: result.total_enhancements_found,
                            objects: result.total_objects_analyzed,
                            partial: result.partial_result || false
                        });
                    } else {
                        console.log(`❌ No valid response found in output`);
                        console.log(`📤 STDOUT:`, stdout.slice(0, 500));
                        resolve({
                            success: false,
                            duration: duration,
                            error: 'No valid response'
                        });
                    }
                } catch (error) {
                    console.log(`❌ Failed to parse response:`, error.message);
                    console.log(`📤 STDOUT:`, stdout.slice(0, 500));
                    resolve({
                        success: false,
                        duration: duration,
                        error: error.message
                    });
                }
            } else {
                console.log(`❌ Process exited with code ${code}`);
                console.log(`📤 STDERR:`, stderr.slice(0, 500));
                resolve({
                    success: false,
                    duration: duration,
                    error: `Process exited with code ${code}`
                });
            }
        });
        
        child.on('error', (error) => {
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
        
        // Set a maximum test timeout (10 minutes)
        setTimeout(() => {
            if (!child.killed) {
                console.log(`⏰ Test timed out after 10 minutes, killing process`);
                child.kill('SIGTERM');
                resolve({
                    success: false,
                    duration: 600000,
                    error: 'Test timeout (10 minutes)'
                });
            }
        }, 10 * 60 * 1000);
    });
}

async function main() {
    console.log('🚀 Starting Enhanced Enhancement Timeout Tests');
    console.log('=' .repeat(60));
    
    // Build the project first
    console.log('🔨 Building project...');
    
    const buildResult = await new Promise((resolve) => {
        // Use PowerShell on Windows to run npm
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
    
    console.log('✅ Build successful');
    
    const results = [];
    
    // Run each test scenario
    for (const scenario of testScenarios) {
        const result = await runTest(scenario);
        results.push({ scenario: scenario.name, ...result });
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(60));
    
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.scenario}`);
        console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Duration: ${result.duration}ms`);
        if (result.success) {
            console.log(`   Enhancements: ${result.enhancements}`);
            console.log(`   Objects: ${result.objects}`);
            if (result.partial) {
                console.log(`   ⚠️  Partial result`);
            }
        } else {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 Overall: ${successCount}/${results.length} tests passed`);
}

main().catch(console.error).finally(() => {
    // Force exit after test completion
    console.log('\n🏁 Forcing process exit...');
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});
