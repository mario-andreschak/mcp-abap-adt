// Test for handleGetTableContents

const { handleGetTableContents } = require('../src/handlers/handleGetTableContents');

async function main() {
  try {
    const args = {
      table_name: process.argv[2] || 'T000',
      max_rows: process.argv[3] ? parseInt(process.argv[3], 10) : 5
    };
    const result = await handleGetTableContents(args);
    console.log('handleGetTableContents result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
