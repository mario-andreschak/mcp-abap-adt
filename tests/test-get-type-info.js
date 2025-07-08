// Test for handleGetTypeInfo

const { handleGetTypeInfo } = require('../dist/handlers/handleGetTypeInfo');

async function main() {
  try {
    const typeName = process.argv[2] || 'ZMY_TYPE';
    const args = { type_name: typeName };
    const result = await handleGetTypeInfo(args);
    console.log('handleGetTypeInfo result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
