// Test for handleGetInterface

const { handleGetInterface } = require('../src/handlers/handleGetInterface');

async function main() {
  try {
    const args = {
      interface_name: process.argv[2] || 'ZIF_MY_INTERFACE'
    };
    const result = await handleGetInterface(args);
    console.log('handleGetInterface result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
