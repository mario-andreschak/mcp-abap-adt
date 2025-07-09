// Test for handleGetTypeInfo

const { handleGetTypeInfo } = require('../dist/handlers/handleGetTypeInfo');
const assert = require('assert');

async function run() {
    // Дозволяємо передавати type_name через командний рядок
    const type_name = process.argv[2] || '/CBY/MMSKLCARD';

    const result = await handleGetTypeInfo({ type_name });

    assert(result && result.content && Array.isArray(result.content), 'Result must have content array');
    console.dir(result, { depth: null });
    const jsonBlock = result.content.find(x => x.type === 'json');
    assert(jsonBlock, 'Result must contain JSON block');
    console.dir(jsonBlock.json, { depth: null });

    console.log('handleGetTypeInfo test passed');
    process.exit(0);
}

run().catch(e => {
    console.error('handleGetTypeInfo test failed:', e);
    process.exit(1);
});
