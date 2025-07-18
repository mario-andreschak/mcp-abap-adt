// Test script for handleGetObjectStructure

const { handleGetObjectStructure } = require('../src/handlers/handleGetObjectStructure');

async function main() {
  // Replace with valid test values for your system
  const args = {
    objecttype: 'DDLS/DF',
    objectname: '/CBY/ACQ_DDL'
  };

  const result = await handleGetObjectStructure(args);

  console.log('Returned result:');
  console.dir(result, { depth: 10, colors: true });
}

main().catch(err => {
  console.error('Test failed:', err);
});
