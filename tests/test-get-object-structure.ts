// Test script for handleGetObjectStructure (TypeScript)

import { handleGetObjectStructure } from '../src/handlers/handleGetObjectStructure';

async function main() {
  // Replace with valid test values for your system
  const args = {
    objecttype: 'PROG/P',
    objectname: '/CBY/MMSKLCARD'
  };

  const result = await handleGetObjectStructure(args);

  console.log('Returned result:');
  console.dir(result, { depth: 10, colors: true });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
