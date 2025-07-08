// Test for handleGetFunction

const { handleGetFunction } = require('../dist/handlers/handleGetFunction');

async function main() {
  try {
    const args = {
      function_name: process.argv[2] || 'ZMY_FUNCTION',
      function_group: process.argv[3] || 'ZFG'
    };
    // Support --filePath=... as optional CLI argument
    const filePathArg = process.argv.find(arg => arg.startsWith('--filePath='));
    if (filePathArg) {
      args.filePath = filePathArg.split('=')[1];
    }
    const result = await handleGetFunction(args);
    console.log('handleGetFunction result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
