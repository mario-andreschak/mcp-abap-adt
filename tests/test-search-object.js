const { handleSearchObject } = require('../dist/handlers/handleSearchObject');

async function runTest() {
  // Тест: коректний тип
  let result = await handleSearchObject({ object_name: 'MARA', object_type: 'TABL' });
  console.log('SearchObject MARA TABL:', result);

  // Тест: некоректний тип
  result = await handleSearchObject({ object_name: 'MARA', object_type: 'TABLE' });
  console.log('SearchObject MARA TABLE:', result);

  // Тест: тільки ім'я
  result = await handleSearchObject({ object_name: 'MARA' });
  console.log('SearchObject MARA:', result);

  // Тест: неіснуючий об'єкт
  result = await handleSearchObject({ object_name: 'ZZZZZZZZ', object_type: 'TABL' });
  console.log('SearchObject ZZZZZZZZ TABL:', result);
}

runTest().then(() => process.exit(0));
