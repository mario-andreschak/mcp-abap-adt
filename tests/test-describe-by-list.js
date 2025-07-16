// Test script for handleDescribeByList

const { handleDescribeByList } = require('../dist/handlers/handleDescribeByList');

async function runTest() {
  const testInput = {
    objects: [
      { name: 'MARA', type: 'TABLE' },
      { name: 'SFLIGHT', type: 'TABLE' },
      { name: 'ZCL_MY_CLASS', type: 'CLAS/OC' }
    ]
  };

  try {
    const result = await handleDescribeByList(testInput);
    console.log('DescribeByList  result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runTest();
