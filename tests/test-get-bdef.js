// Test for handleGetBdef

const { handleGetBdef } = require('../src/handlers/handleGetBdef');

async function main() {
  try {
    const args = {
      bdef_name: process.argv[2] || 'Z_I_MYENTITY'
    };
    const result = await handleGetBdef(args);
    console.log('handleGetBdef result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
