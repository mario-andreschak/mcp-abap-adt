// Test for handleGetDescription

const { handleGetDescription } = require('../src/handlers/handleGetDescription');

async function main() {
  try {
    const args = {
      object_name: process.argv[2] || 'SAPMV45A',
      object_type: process.argv[3] || 'program'
    };
    // Support --filePath=... as optional CLI argument
    const filePathArg = process.argv.find(arg => arg.startsWith('--filePath='));
    if (filePathArg) {
      args.filePath = filePathArg.split('=')[1];
    }
    const result = await handleGetDescription(args);
    console.log('handleGetDescription result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
