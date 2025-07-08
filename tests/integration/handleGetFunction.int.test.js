/**
 * Integration test for handleGetFunction (real ABAP server, .env required)
 */

const { handleGetFunction } = require('../../dist/handlers/handleGetFunction');

describe('handleGetFunction (integration)', () => {
  it('should return plain text for RFC_READ_TABLE in SDTX', async () => {
    const args = {
      function_name: 'RFC_READ_TABLE',
      function_group: 'SDTX'
    };
    const result = await handleGetFunction(args);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/function rfc_read_table/i);
    expect(result).toMatch(/endfunction/i);
  });

  // Додаткові тести можна додати тут для інших функцій/груп
});
