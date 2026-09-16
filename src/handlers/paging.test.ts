import { AxiosError } from 'axios';
import * as utils from '../lib/utils';
import { handleGetProgram } from './handleGetProgram';
import { handleGetTable } from './handleGetTable';
import { handleGetTypeInfo } from './handleGetTypeInfo';
import { handleGetPackage } from './handleGetPackage';
import { handleGetTableContents } from './handleGetTableContents';
import { handleSearchObject } from './handleSearchObject';

function page(result: any): any {
  expect(result.isError).toBe(false);
  return JSON.parse(result.content[0].text);
}

function mockBaseUrl() {
  jest.spyOn(utils, 'getBaseUrl').mockResolvedValue('https://sap.example');
}

describe('handler paging coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards paging through an ordinary source handler', async () => {
    mockBaseUrl();
    jest.spyOn(utils, 'makeAdtRequest').mockResolvedValue({
      data: 'first\nsecond\nthird'
    } as any);

    const payload = page(await handleGetProgram({
      program_name: 'Z_TEST',
      startLine: 2,
      maxLines: 1
    }));

    expect(payload).toMatchObject({
      content: 'second',
      startLine: 2,
      returnedLines: 1,
      hasMore: true
    });
  });

  it('forwards paging through both GetTable request paths', async () => {
    mockBaseUrl();
    const request = jest.spyOn(utils, 'makeAdtRequest');

    request.mockResolvedValueOnce({ data: 'primary one\nprimary two' } as any);
    expect(page(await handleGetTable({
      table_name: 'Z_TABLE',
      startLine: 2,
      maxLines: 1
    })).content).toBe('primary two');

    const notFound = new AxiosError('not found');
    (notFound as any).response = { status: 404 };
    request
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ data: 'fallback one\nfallback two' } as any);

    expect(page(await handleGetTable({
      table_name: 'Z_TABLE',
      startLine: 2,
      maxLines: 1
    })).content).toBe('fallback two');
    expect(request.mock.calls.at(-1)?.[0]).toContain('/ddic/structures/');
  });

  it('forwards paging through both GetTypeInfo lookup paths', async () => {
    mockBaseUrl();
    const request = jest.spyOn(utils, 'makeAdtRequest');

    request.mockResolvedValueOnce({ data: 'domain one\ndomain two' } as any);
    expect(page(await handleGetTypeInfo({
      type_name: 'Z_TYPE',
      startLine: 2,
      maxLines: 1
    })).content).toBe('domain two');

    request
      .mockRejectedValueOnce(new Error('domain missing'))
      .mockResolvedValueOnce({ data: 'element one\nelement two' } as any);

    expect(page(await handleGetTypeInfo({
      type_name: 'Z_TYPE',
      startLine: 2,
      maxLines: 1
    })).content).toBe('element two');
    expect(request.mock.calls.at(-1)?.[0]).toContain('/ddic/dataelements/');
  });

  it('routes GetPackage structured data through the shared pager', async () => {
    mockBaseUrl();
    const packageXml = [
      '<asx:abap xmlns:asx="urn:sap-com:document:sap:asxml">',
      '<asx:values><DATA><TREE_CONTENT>',
      '<SEU_ADT_REPOSITORY_OBJ_NODE>',
      '<OBJECT_TYPE>PROG/P</OBJECT_TYPE>',
      '<OBJECT_NAME>Z_ONE</OBJECT_NAME>',
      '<DESCRIPTION>First object</DESCRIPTION>',
      '<OBJECT_URI>/sap/bc/adt/programs/programs/z_one</OBJECT_URI>',
      '</SEU_ADT_REPOSITORY_OBJ_NODE>',
      '</TREE_CONTENT></DATA></asx:values>',
      '</asx:abap>'
    ].join('');
    jest.spyOn(utils, 'makeAdtRequest').mockResolvedValue({ data: packageXml } as any);

    const payload = page(await handleGetPackage({
      package_name: 'Z_PACKAGE',
      startLine: 2,
      maxLines: 2
    }));

    expect(payload).toMatchObject({
      startLine: 2,
      returnedLines: 2,
      hasMore: true
    });
    expect(payload.content).toContain('"OBJECT_TYPE": "PROG/P"');
  });

  it('keeps table row limiting while paging its textual response', async () => {
    mockBaseUrl();
    const request = jest.spyOn(utils, 'makeAdtRequest').mockResolvedValue({
      data: '<row>one</row>\n<row>two</row>'
    } as any);

    const payload = page(await handleGetTableContents({
      table_name: 'z_table',
      max_rows: 5,
      startLine: 2,
      maxLines: 1
    }));

    expect(payload.content).toBe('<row>two</row>');
    expect(request.mock.calls[0][4]).toEqual({ rowNumber: 5 });
  });

  it('keeps search result limiting while paging its textual response', async () => {
    mockBaseUrl();
    const request = jest.spyOn(utils, 'makeAdtRequest').mockResolvedValue({
      data: '<object>one</object>\n<object>two</object>'
    } as any);

    const payload = page(await handleSearchObject({
      query: 'Z*',
      maxResults: 5,
      startLine: 2,
      maxLines: 1
    }));

    expect(payload.content).toBe('<object>two</object>');
    expect(request.mock.calls[0][0]).toContain('maxResults=5');
  });
});
