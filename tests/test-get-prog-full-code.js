// @ts-check
const { handleGetProgFullCode } = require('../src/handlers/handleGetProgFullCode');

describe('handleGetProgFullCode', () => {
  it('should return full code for a known ABAP program', async () => {
    const args = {
      parent_name: 'RM07DOCS',
      parent_tech_name: 'RM07DOCS',
      parent_type: 'PROG/P',
      with_short_descriptions: false,
    };
    const result = await handleGetProgFullCode(args);
    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    const jsonBlock = result.content.find(
      (x) => x && x.type === 'json' && typeof x === 'object' && 'json' in x && typeof x.json === 'object'
    );
    if (!jsonBlock || typeof jsonBlock !== 'object' || !('json' in jsonBlock) || typeof jsonBlock.json !== 'object') {
      throw new Error('No JSON block with expected structure in result.content');
    }
    const json = jsonBlock.json;
    expect(json).toHaveProperty('parent_name', 'RM07DOCS');
    expect(json).toHaveProperty('code_objects');
    expect(Array.isArray(json.code_objects)).toBe(true);
    expect(json.code_objects.length).toBeGreaterThan(0);
    expect(json.code_objects[0]).toHaveProperty('OBJECT_TYPE', 'PROG/P');
    expect(json.code_objects[0]).toHaveProperty('OBJECT_NAME', 'RM07DOCS');
    expect(json.code_objects[0]).toHaveProperty('code');
  }, 30000);
});
