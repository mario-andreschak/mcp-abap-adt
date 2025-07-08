// Test for handleGetTransaction

const { handleGetTransaction } = require('../src/handlers/handleGetTransaction');

async function main() {
  try {
    const args = {
      transaction_name: process.argv[2] || 'ZMY_TRANSACTION'
    };
    const result = await handleGetTransaction(args);
    console.log('handleGetTransaction result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
