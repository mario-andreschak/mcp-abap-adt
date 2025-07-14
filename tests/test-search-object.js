const { handleSearchObject } = require('../src/handlers/handleSearchObject');

(async () => {
  try {
    const query = process.argv[2] || '*';
    const objectType = process.argv[3] || 'PROG/P';
    const maxResults = process.argv[4] ? Number(process.argv[4]) : 5;
    const result = await handleSearchObject({
      query,
      objectType,
      maxResults
    });
    console.log('SearchObject result:', result);
    process.exit(0);
  } catch (err) {
    console.error('SearchObject error:', err);
    process.exit(1);
  }
})();
