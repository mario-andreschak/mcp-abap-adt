import {
  PAGED_TEXT_TOOL_NAMES,
  PAGING_MAX_LINES,
  PAGING_START_LINE,
  addPagingSchemas
} from './index';
import { MAX_PAGE_LINES } from './lib/utils';

describe('paging tool schemas', () => {
  const expectedPagedTools = [
    'GetProgram',
    'GetClass',
    'GetFunctionGroup',
    'GetFunction',
    'GetStructure',
    'GetTable',
    'GetTableContents',
    'GetPackage',
    'GetTypeInfo',
    'GetInclude',
    'SearchObject',
    'GetTransaction',
    'GetCDSView',
    'GetInterface',
    'GetBehaviorDefinition',
    'GetServiceDefinition'
  ];

  it('declares the exact textual tool set protected by paging', () => {
    expect(PAGED_TEXT_TOOL_NAMES).toEqual(expectedPagedTools);
  });

  it('keeps advertised paging bounds aligned with runtime validation', () => {
    expect(PAGING_START_LINE).toMatchObject({ type: 'integer', minimum: 1 });
    expect(PAGING_MAX_LINES).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: MAX_PAGE_LINES
    });
  });

  it('injects both paging fields only into the intended schemas', () => {
    const definitions = addPagingSchemas([
      ...expectedPagedTools.map((name) => ({
        name,
        inputSchema: {
          type: 'object',
          properties: { original: { type: 'string' } }
        }
      })),
      {
        name: 'NotPaged',
        inputSchema: {
          type: 'object',
          properties: { original: { type: 'string' } }
        }
      }
    ]);

    for (const tool of definitions.filter((definition: any) =>
      expectedPagedTools.includes(definition.name)
    )) {
      expect(tool.inputSchema.properties).toMatchObject({
        original: { type: 'string' },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES
      });
    }

    const notPaged = definitions.find((definition: any) => definition.name === 'NotPaged');
    expect(notPaged.inputSchema.properties.startLine).toBeUndefined();
    expect(notPaged.inputSchema.properties.maxLines).toBeUndefined();
  });
});
