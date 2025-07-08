/**
 * Integration test for handleGetFunction (real ABAP server, .env required)
 */

const { handleGetFunction } = require('../../dist/handlers/handleGetFunction');
const fs = require('fs');
const path = require('path');

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

  it('should write result to file if filePath is provided', async () => {
    const filePath = path.join(process.cwd(), 'test-func.txt');
    // Cleanup before
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const args = {
      function_name: 'RFC_READ_TABLE',
      function_group: 'SDTX',
      filePath
    };
    const result = await handleGetFunction(args);

    // File should exist
    expect(fs.existsSync(filePath)).toBe(true);
    // Content should match result
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).toContain('function rfc_read_table');
    expect(fileContent).toContain('endfunction');

    // Cleanup after
    fs.unlinkSync(filePath);
  });

  // Додаткові тести можна додати тут для інших функцій/груп
});
