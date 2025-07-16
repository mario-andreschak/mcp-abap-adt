const { handleSearchObject } = require('../dist/handlers/handleSearchObject');

async function runTest() {
  // Тест: коректний тип
  try {
    let result = await handleSearchObject({ object_name: 'MARA', object_type: 'TABL' });
    console.log('SearchObject MARA TABL:', result);
  } catch (err) {
    console.error('SearchObject MARA TABL ERROR:', err.status, err.body?.error?.message || err.message);
  }

  try {
    let result = await handleSearchObject({ object_name: 'MARA', object_type: 'TABLE' });
    console.log('SearchObject MARA TABLE:', result);
  } catch (err) {
    console.error('SearchObject MARA TABLE ERROR:', err.status, err.body?.error?.message || err.message);
  }

  try {
    let result = await handleSearchObject({ object_name: 'SFLIGHT', object_type: 'TABLE' });
    console.log('SearchObject SFLIGHT TABLE:', result);
  } catch (err) {
    console.error('SearchObject SFLIGHT TABLE ERROR:', err.status, err.body?.error?.message || err.message);
  }

  try {
    let result = await handleSearchObject({ object_name: 'SFLIGHT', object_type: 'TABL' });
    console.log('SearchObject SFLIGHT TABL:', result);
  } catch (err) {
    console.error('SearchObject SFLIGHT TABL ERROR:', err.status, err.body?.error?.message || err.message);
  }

  try {
    let result = await handleSearchObject({ object_name: 'MARA' });
    console.log('SearchObject MARA:', result);
  } catch (err) {
    console.error('SearchObject MARA ERROR:', err.status, err.body?.error?.message || err.message);
  }

  try {
    let result = await handleSearchObject({ object_name: 'ZZZZZZZZ', object_type: 'TABL' });
    console.log('SearchObject ZZZZZZZZ TABL:', result);
  } catch (err) {
    console.error('SearchObject ZZZZZZZZ TABL ERROR:', err.status, err.body?.error?.message || err.message);
  }
}

runTest().then(() => process.exit(0));
