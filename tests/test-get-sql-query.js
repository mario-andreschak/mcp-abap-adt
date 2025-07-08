// Test for handleGetSqlQuery

const { handleGetSqlQuery } = require('../src/handlers/handleGetSqlQuery');

async function main() {
  try {
    const args = {
      sql_query: process.argv[2] || "SELECT * FROM T000",
      row_number: process.argv[3] ? parseInt(process.argv[3], 10) : 5
    };
    const result = await handleGetSqlQuery(args);
    console.log('handleGetSqlQuery result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
