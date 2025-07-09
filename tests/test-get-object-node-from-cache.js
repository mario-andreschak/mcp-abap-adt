// Test for handleGetObjectNodeFromCache

const { handleGetObjectsList } = require('../dist/handlers/handleGetObjectsList');
const { handleGetObjectNodeFromCache } = require('../dist/handlers/handleGetObjectNodeFromCache');
const { loadObjectsListCache } = require('../dist/lib/getObjectsListCache');
const assert = require('assert');

async function run() {
    // Генеруємо кеш, якщо його ще немає
    // Дозволяємо передавати параметри через командний рядок
    const parent_name = process.argv[2] || '/CBY/PURBOOK_EN';
    const parent_type = process.argv[3] || 'PROG/P';
    const object_type = process.argv[4];
    const object_name = process.argv[5];
    const tech_name = process.argv[6];

    let cache = loadObjectsListCache();
    if (!cache || !Array.isArray(cache.objects) || cache.objects.length === 0) {
        await handleGetObjectsList({
            parent_name,
            parent_tech_name: parent_name,
            parent_type,
            with_short_descriptions: true
        });
        cache = loadObjectsListCache();
    }

    assert(cache && Array.isArray(cache.objects) && cache.objects.length > 0, 'Cache must contain objects');

    // Якщо не передано вузол для пошуку — беремо перший з кешу
    let node;
    if (object_type && object_name && tech_name) {
        node = cache.objects.find(
            n => n.OBJECT_TYPE === object_type && n.OBJECT_NAME === object_name && n.TECH_NAME === tech_name
        );
        assert(node, 'Node with specified keys not found in cache');
    } else {
        node = cache.objects[0];
    }
    assert(node.OBJECT_TYPE && node.OBJECT_NAME && node.TECH_NAME, 'Node must have OBJECT_TYPE, OBJECT_NAME, TECH_NAME');

    // Викликаємо хендлер для пошуку вузла і розгортання OBJECT_URI
    const result = await handleGetObjectNodeFromCache({
        object_type: node.OBJECT_TYPE,
        object_name: node.OBJECT_NAME,
        tech_name: node.TECH_NAME
    });

    assert(result && result.content && Array.isArray(result.content), 'Result must have content array');
    const jsonBlock = result.content.find(x => x.type === 'json');
    assert(jsonBlock, 'Result must contain JSON block');
    assert(jsonBlock.json && jsonBlock.json.OBJECT_TYPE === node.OBJECT_TYPE, 'Returned node OBJECT_TYPE must match');
    assert(jsonBlock.json.object_uri_response && typeof jsonBlock.json.object_uri_response === 'string', 'Returned node must have object_uri_response');

    // Виводимо лише перші 200 символів object_uri_response для перевірки
    const preview = typeof jsonBlock.json.object_uri_response === 'string'
        ? jsonBlock.json.object_uri_response.slice(0, 200)
        : '';
    console.log('object_uri_response preview:', preview);

    console.log('handleGetObjectNodeFromCache test passed');
    process.exit(0);
}

run().catch(e => {
    console.error('handleGetObjectNodeFromCache test failed:', e);
    process.exit(1);
});
