// @ts-check
const { handleGetProgFullCode } = require('../src/handlers/handleGetProgFullCode');

async function main() {
  const parent_name = process.argv[2];
  if (!parent_name) {
    console.error('Usage: node run-get-prog-full-code.js <parent_name>');
    process.exit(1);
  }
  const args = {
    parent_name,
    parent_tech_name: parent_name,
    parent_type: 'PROG/P',
    with_short_descriptions: false,
  };
  const result = await handleGetProgFullCode(args);
  const jsonBlock = result.content.find(
    (x) => x && x.type === 'json' && typeof x === 'object' && 'json' in x && typeof x.json === 'object'
  );
  if (!jsonBlock || typeof jsonBlock !== 'object' || !('json' in jsonBlock) || typeof jsonBlock.json !== 'object') {
    throw new Error('No JSON block with expected structure in result.content');
  }
  const json = jsonBlock.json;
  console.log(`Parent: ${json.parent_name}`);
  console.log(`Total code objects: ${json.total_code_objects}`);
  console.log('Objects:');
  for (const obj of json.code_objects) {
    console.log(`  ${obj.OBJECT_TYPE}  ${obj.OBJECT_NAME}`);
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
