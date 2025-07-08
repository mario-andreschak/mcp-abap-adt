// Test for handleGetFunctionGroup

const { handleGetFunctionGroup } = require('../src/handlers/handleGetFunctionGroup');

async function main() {
  try {
    const args = {
      function_group: process.argv[2] || 'ZFG',
      filePath: process.argv[3] || undefined
    };
    const result = await handleGetFunctionGroup(args);
    console.log('handleGetFunctionGroup result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
