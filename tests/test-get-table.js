// Test for handleGetTable

const { handleGetTable } = require('../src/handlers/handleGetTable');

async function main() {
  try {
    const args = {
      table_name: process.argv[2] || 'T000'
    };
    const result = await handleGetTable(args);
    console.log('handleGetTable result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
