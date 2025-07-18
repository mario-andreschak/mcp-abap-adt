// Test script for handleGetAdtTypes (TypeScript)

import { handleGetAdtTypes } from '../src/handlers/handleGetAllTypes';

async function main() {
  const args = {};
  const result = await handleGetAdtTypes(args);

  console.log('Returned result:');
  console.dir(result, { depth: 10, colors: true });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
