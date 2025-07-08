// Test for handleGetClass

const { handleGetClass } = require('../src/handlers/handleGetClass');

async function main() {
  try {
    const args = {
      class_name: process.argv[2] || 'ZCL_MY_CLASS'
    };
    const result = await handleGetClass(args);
    console.log('handleGetClass result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
