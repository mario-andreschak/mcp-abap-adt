// Test for handleGetInclude

const { handleGetInclude } = require('../src/handlers/handleGetInclude');

async function main() {
  try {
    const args = {
      include_name: process.argv[2] || 'RM07DOCS_F01'
    };
    const result = await handleGetInclude(args);
    console.log('handleGetInclude result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
