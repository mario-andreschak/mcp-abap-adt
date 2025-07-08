// Test for handleGetEnhancementSpot

const { handleGetEnhancementSpot } = require('../src/handlers/handleGetEnhancementSpot');

async function main() {
  try {
    const args = {
      enhancement_spot: process.argv[2] || 'ENHOXHH'
    };
    // Support --filePath=... as optional CLI argument
    const filePathArg = process.argv.find(arg => arg.startsWith('--filePath='));
    if (filePathArg) {
      args.filePath = filePathArg.split('=')[1];
    }
    const result = await handleGetEnhancementSpot(args);
    console.log('handleGetEnhancementSpot result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
