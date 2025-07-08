// Test for handleGetIncludesInProgram

const { handleGetIncludesInProgram } = require('../src/handlers/handleGetIncludesInProgram');

async function main() {
  try {
    const args = {
      program_name: process.argv[2] || 'SAPMV45A'
    };
    const result = await handleGetIncludesInProgram(args);
    console.log('handleGetIncludesInProgram result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
