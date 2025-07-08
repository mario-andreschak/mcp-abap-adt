// Test for handleGetClass

const { handleGetClass } = require('../dist/handlers/handleGetClass');

async function main() {
  try {
    const args = {
      class_name: process.argv[2] || 'ZCL_MY_CLASS'
    };
    // Support --filePath=... as optional CLI argument
    const filePathArg = process.argv.find(arg => arg.startsWith('--filePath='));
    if (filePathArg) {
      args.filePath = filePathArg.split('=')[1];
    }
    const result = await handleGetClass(args);
    console.log('handleGetClass result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
