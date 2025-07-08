// Test for handleGetStructure

const { handleGetStructure } = require('../dist/handlers/handleGetStructure');

async function main() {
  try {
    const args = {
      structure_name: process.argv[2] || 'ZMY_STRUCT'
    };
    const result = await handleGetStructure(args);
    console.log('handleGetStructure result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
