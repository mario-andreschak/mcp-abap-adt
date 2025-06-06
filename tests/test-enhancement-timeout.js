#!/usr/bin/env node

/**
 * Test script for enhancement timeout improvements
 * Tests the timeout handling for individual includes
 */

const { handleGetEnhancements } = require('../dist/handlers/handleGetEnhancements');

// Mock logger to capture timeout messages
const mockLogger = {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    warn: (message, ...args) => console.log(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.log(`[ERROR] ${message}`, ...args),
};

// Mock makeAdtRequestWithTimeout to simulate timeout scenarios
const originalUtils = require('../dist/lib/utils');

// Create a mock that simulates timeout for specific includes
function createMockRequest(timeoutIncludes = []) {
    return async function mockMakeAdtRequestWithTimeout(url, method, timeoutType, data, params) {
        // Extract include name from URL
        const includeMatch = url.match(/includes\/([^\/\?]+)/);
        const includeName = includeMatch ? includeMatch[1] : null;
        
        console.log(`[MOCK REQUEST] ${method} ${url} (timeout: ${timeoutType})`);
        
        // Simulate timeout for specific includes
        if (includeName && timeoutIncludes.includes(includeName)) {
            console.log(`[MOCK] Simulating timeout for include: ${includeName}`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
            throw new Error(`Timeout: Request timed out for include ${includeName}`);
        }
        
        // Simulate successful response for other requests
        await new Promise(resolve => setTimeout(resolve, 50)); // Short delay
        
        // Mock different response types based on URL
        if (url.includes('/oo/classes/')) {
            return { status: 404, data: 'Not Found' }; // Not a class
        } else if (url.includes('/programs/programs/')) {
            return { 
                status: 200, 
                data: '<program>Mock program</program>' 
            };
        } else if (url.includes('/programs/includes/')) {
            if (url.includes('?context=')) {
                // Enhancement request for include
                return {
                    status: 200,
                    data: `<enhancements>
                        <enh:source>dGVzdCBlbmhhbmNlbWVudCBjb2Rl</enh:source>
                    </enhancements>`
                };
            } else {
                // Include metadata request
                return {
                    status: 200,
                    data: `<include:include xmlns:include="http://www.sap.com/adt/include">
                        <include:contextRef adtcore:uri="/sap/bc/adt/programs/programs/TEST_PROGRAM"/>
                    </include:include>`
                };
            }
        } else if (url.includes('/enhancements/elements')) {
            return {
                status: 200,
                data: `<enhancements>
                    <enh:source>dGVzdCBlbmhhbmNlbWVudCBjb2Rl</enh:source>
                </enhancements>`
            };
        }
        
        return { status: 200, data: 'Mock response' };
    };
}

// Mock handleGetIncludesList to return some test includes
async function mockGetIncludesList(args) {
    return {
        content: [{
            type: "text",
            text: `Found 3 includes for program ${args.object_name}:
INCLUDE1_OK
INCLUDE2_TIMEOUT
INCLUDE3_OK`
        }]
    };
}

async function testTimeoutHandling() {
    console.log('=== Testing Enhancement Timeout Improvements ===\n');
    
    // Override utils and handlers for testing
    originalUtils.makeAdtRequestWithTimeout = createMockRequest(['INCLUDE2_TIMEOUT']);
    
    // Import after mocking
    const { handleGetIncludesList } = require('../dist/handlers/handleGetIncludesList');
    const originalGetIncludesList = handleGetIncludesList;
    
    // Mock the includes list handler
    require('../dist/handlers/handleGetIncludesList').handleGetIncludesList = mockGetIncludesList;
    
    try {
        console.log('1. Testing sequential processing with individual timeouts...\n');
        
        const result = await handleGetEnhancements({
            object_name: 'TEST_PROGRAM',
            include_nested: true
        });
        
        console.log('\n=== RESULT ===');
        
        if (result.content && result.content[0]) {
            const responseData = JSON.parse(result.content[0].text);
            
            console.log(`Total objects analyzed: ${responseData.total_objects_analyzed}`);
            console.log(`Total enhancements found: ${responseData.total_enhancements_found}`);
            console.log(`Objects processed:`);
            
            responseData.objects.forEach((obj, index) => {
                console.log(`  ${index + 1}. ${obj.object_name} (${obj.object_type}) - ${obj.enhancements.length} enhancements`);
            });
            
            // Check if we handled timeout gracefully
            const processedIncludes = responseData.objects.map(obj => obj.object_name);
            const expectedSuccess = ['TEST_PROGRAM', 'INCLUDE1_OK', 'INCLUDE3_OK'];
            const shouldTimeout = ['INCLUDE2_TIMEOUT'];
            
            console.log('\n=== TIMEOUT HANDLING VERIFICATION ===');
            console.log('✓ Successfully processed objects:', expectedSuccess.filter(name => processedIncludes.includes(name)));
            console.log('✓ Gracefully skipped timeout objects:', shouldTimeout.filter(name => !processedIncludes.includes(name)));
            
            if (processedIncludes.includes('INCLUDE2_TIMEOUT')) {
                console.log('❌ ERROR: Timeout include was processed (should have been skipped)');
            } else {
                console.log('✅ SUCCESS: Timeout include was properly skipped');
            }
            
        } else {
            console.log('Error in response:', result);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
    
    console.log('\n=== Test Environment Variables ===');
    console.log('To enable parallel processing, set:');
    console.log('SET USE_PARALLEL_ENHANCEMENT_PROCESSING=true');
    console.log('SET MAX_CONCURRENT_ENHANCEMENT_REQUESTS=3');
    
    console.log('\n=== Test Complete ===');
}

// Mock getBaseUrl to avoid config issues
originalUtils.getBaseUrl = async () => 'http://mock-sap-server:8000';

// Run the test
testTimeoutHandling().catch(console.error);
