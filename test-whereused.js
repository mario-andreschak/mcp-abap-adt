// Test script for handleGetWhereUsed function
import { handleGetWhereUsed } from './src/handlers/handleGetWhereUsed.js';

async function testWhereUsed() {
    console.log('Testing handleGetWhereUsed with SBOOK table...\n');
    
    try {
        // Test with SBOOK table
        const result = await handleGetWhereUsed({
            object_name: 'SBOOK',
            object_type: 'TABLE',
            max_results: 50
        });
        
        console.log('Test Result:');
        console.log('Status:', result.status);
        console.log('Content:', result.content);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Error details:', error);
    }
}

// Run the test
testWhereUsed();
