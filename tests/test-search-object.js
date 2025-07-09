// Test for handleSearchObject

const { handleSearchObject } = require('../dist/handlers/handleSearchObject');
const assert = require('assert');

async function run() {
    // Дозволяємо передавати query через командний рядок
    const query = process.argv[2] || '/CBY/MMSKLCARD';

    const result = await handleSearchObject({ query });

    assert(result && result.content && Array.isArray(result.content), 'Result must have content array');
    // Виводимо результат для перевірки
    console.dir(result, { depth: null });

    console.log('handleSearchObject test passed');
    process.exit(0);
}

run().catch(e => {
    console.error('handleSearchObject test failed:', e);
    process.exit(1);
});
