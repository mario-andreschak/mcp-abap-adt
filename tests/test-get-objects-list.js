// Test for handleGetObjectsList

const { handleGetObjectsList } = require('../dist/handlers/handleGetObjectsList');
const assert = require('assert');

async function run() {
    // Параметри для тесту: підставити реальні значення для вашої системи
    // Дозволяємо передавати параметри через командний рядок
    const parent_name = process.argv[2] || '/CBY/PURBOOK_EN';
    const parent_type = process.argv[3] || 'PROG/P';
    const args = {
        parent_name,
        parent_tech_name: parent_name,
        parent_type,
        with_short_descriptions: true
    };

    const result = await handleGetObjectsList(args);

    // Перевіряємо, що повертається об'єкт з масивом objects
    assert(result && result.content && Array.isArray(result.content), 'Result must have content array');
    const jsonBlock = result.content.find(x => x.type === 'json');
    assert(jsonBlock, 'Result must contain JSON block');
    assert(jsonBlock.json && Array.isArray(jsonBlock.json.objects), 'JSON must have objects array');
    assert(jsonBlock.json.objects.length > 0, 'Objects array must not be empty');

    // Виводимо результат objects для перевірки
    console.dir(jsonBlock.json.objects, { depth: null, maxArrayLength: 100 });

    // Перевіряємо, що кожен об'єкт містить OBJECT_TYPE, OBJECT_NAME, TECH_NAME, OBJECT_URI
    for (const obj of jsonBlock.json.objects) {
        assert(obj.OBJECT_TYPE, 'Each object must have OBJECT_TYPE');
        assert(obj.OBJECT_NAME, 'Each object must have OBJECT_NAME');
        assert(obj.TECH_NAME, 'Each object must have TECH_NAME');
        assert(obj.OBJECT_URI, 'Each object must have OBJECT_URI');
    }

    console.log('handleGetObjectsList test passed');
}

run().catch(e => {
    console.error('handleGetObjectsList test failed:', e);
    process.exit(1);
});
