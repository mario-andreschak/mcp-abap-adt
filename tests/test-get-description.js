// Test for handleGetDescription

const { handleGetDescription } = require('../src/handlers/handleGetDescription');

async function main() {
  try {
    const args = {
      object_name: process.argv[2] || 'SAPMV45A',
      object_type: process.argv[3] || 'program'
    };
    const result = await handleGetDescription(args);
    console.log('handleGetDescription result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
