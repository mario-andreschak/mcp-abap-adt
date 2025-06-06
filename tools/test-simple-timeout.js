/**
 * Simple test for enhanced timeout functionality
 * Tests the new timeout parameters directly
 */

const { handleGetEnhancements } = require('../dist/handlers/handleGetEnhancements');
const { cleanup } = require('../dist/lib/utils');

async function testEnhancedTimeouts() {
    console.log('🧪 Testing Enhanced Enhancement Timeout Features');
    console.log('=' .repeat(60));
    
    // Test scenarios
    const testCases = [
        {
            name: "Quick test with limits",
            args: {
                object_name: "/SAPAPO/RMSNPSRC",
                include_nested: true,
                timeout_per_include: 10000,  // 10 seconds
                max_includes: 3,             // Only 3 includes
                total_timeout: 60000         // 1 minute total
            }
        },
        {
            name: "Single object only (no nested)",
            args: {
                object_name: "/SAPAPO/RMSNPSRC",
                include_nested: false
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Running: ${testCase.name}`);
        console.log(`📋 Args:`, JSON.stringify(testCase.args, null, 2));
        
        const startTime = Date.now();
        
        try {
            const result = await handleGetEnhancements(testCase.args);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`⏱️  Completed in ${duration}ms`);
            
            if (result.content && result.content[0] && result.content[0].text) {
                const parsedResult = JSON.parse(result.content[0].text);
                
                if (parsedResult.total_objects_analyzed !== undefined) {
                    console.log(`✅ Success! Found ${parsedResult.total_enhancements_found || 0} enhancements in ${parsedResult.total_objects_analyzed} objects`);
                    
                    if (parsedResult.partial_result) {
                        console.log(`⚠️  Partial result: ${parsedResult.error}`);
                    }
                } else {
                    console.log(`✅ Success! Single object result with ${parsedResult.enhancements?.length || 0} enhancements`);
                }
            } else {
                console.log(`❌ Unexpected result format`);
            }
            
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`❌ Failed after ${duration}ms: ${error.message}`);
        }
    }
    
    console.log(`\n🎯 Test completed`);
    
    // Clean up axios instances
    console.log('🧹 Cleaning up...');
    cleanup();
}

// Check if this is being run directly
if (require.main === module) {
    testEnhancedTimeouts()
        .catch(console.error)
        .finally(() => {
            // Force exit after test completion
            console.log('\n🏁 Forcing process exit...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        });
}

module.exports = { testEnhancedTimeouts };
