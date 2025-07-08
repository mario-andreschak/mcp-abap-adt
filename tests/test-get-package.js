// Test for handleGetPackage

const { handleGetPackage } = require('../src/handlers/handleGetPackage');

async function main() {
  try {
    const args = {
      package_name: process.argv[2] || 'ZMY_PACKAGE'
    };
    const result = await handleGetPackage(args);
    console.log('handleGetPackage result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
