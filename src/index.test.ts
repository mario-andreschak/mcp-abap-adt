import { after } from 'node:test';
import { mcp_abap_adt_server } from './index';
import { handleGetProgram } from './handlers/handleGetProgram';
import { handleGetClass } from './handlers/handleGetClass';
import { handleGetFunctionGroup } from './handlers/handleGetFunctionGroup';
import { handleGetFunction } from './handlers/handleGetFunction';
import { handleGetTable } from './handlers/handleGetTable';
import { handleGetStructure } from './handlers/handleGetStructure';
import { handleGetTableContents } from './handlers/handleGetTableContents';
import { handleGetPackage } from './handlers/handleGetPackage';
import { handleGetInclude } from './handlers/handleGetInclude';
import { handleGetTypeInfo } from './handlers/handleGetTypeInfo';
import { handleGetInterface } from './handlers/handleGetInterface';
import { handleGetTransaction } from './handlers/handleGetTransaction';
import { handleSearchObject } from './handlers/handleSearchObject';
import { cleanup } from './lib/utils';

describe('mcp_abap_adt_server - Integration Tests', () => {
  let server: mcp_abap_adt_server;

  beforeAll(() => {
    // Initialize the server instance once before all tests
    server = new mcp_abap_adt_server();
  });

  afterAll(async () => {
    // Clean up server instance and utils
    cleanup();
    // Add a small delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('handleGetProgram', () => {
    it('should successfully retrieve program details', async () => {
      const result = await handleGetProgram({ program_name: 'RSABAPPROGRAM' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetClass', () => {
    it('should successfully retrieve class details', async () => {
      const result = await handleGetClass({ class_name: 'CL_WB_PGEDITOR_INITIAL_SCREEN' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetFunctionGroup', () => {
    it('should successfully retrieve function group details', async () => {
      const result = await handleGetFunctionGroup({ function_group: 'WBABAP' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetFunction', () => {
    it('should successfully retrieve function module details', async () => {
      const result = await handleGetFunction({ function_name: 'WB_PGEDITOR_INITIAL_SCREEN', function_group: 'WBABAP' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetTable', () => {
    it('should successfully retrieve table details', async () => {
      const result = await handleGetTable({ table_name: 'DD02L' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetStructure', () => {
    it('should successfully retrieve structure details', async () => {
      const result = await handleGetStructure({ structure_name: 'SYST' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetPackage', () => {
    it('should successfully retrieve package details', async () => {
      const result = await handleGetPackage({ package_name: 'SABP_TYPES' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetInclude', () => {
    it('should successfully retrieve include details', async () => {
      const result = await handleGetInclude({ include_name: 'LWBABAPF00' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetTypeInfo', () => {
    it('should successfully retrieve type info', async () => {
      const result = await handleGetTypeInfo({ type_name: 'SYST_SUBRC' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetInterface', () => {
    it('should successfully retrieve interface details', async () => {
      const result = await handleGetInterface({ interface_name: 'IF_T100_MESSAGE' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleSearchObject', () => {
    it('should successfully search for an object', async () => {
      const result = await handleSearchObject({ query: 'SYST' });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('handleGetTransaction', () => {
    it('should successfully retrieve transaction details', async () => {
      const result = await handleGetTransaction({ transaction_name: 'SE93' });
      console.log(result)
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });
});
