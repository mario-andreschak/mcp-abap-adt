// Test for handleGetFunction

const { handleGetFunction } = require('../src/handlers/handleGetFunction');

async function main() {
  try {
    const args = {
      function_name: process.argv[2] || 'ZMY_FUNCTION',
      function_group: process.argv[3] || 'ZFG'
    };
    const result = await handleGetFunction(args);
    console.log('handleGetFunction result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
