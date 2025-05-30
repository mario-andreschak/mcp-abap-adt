import { after } from "node:test";
import { mcp_abap_adt_server } from "./index";
import { handleGetProgram } from "./handlers/handleGetProgram";
import { handleGetClass } from "./handlers/handleGetClass";
import { handleGetFunctionGroup } from "./handlers/handleGetFunctionGroup";
import { handleGetFunction } from "./handlers/handleGetFunction";
import { handleGetTable } from "./handlers/handleGetTable";
import { handleGetStructure } from "./handlers/handleGetStructure";
import { handleGetTableContents } from "./handlers/handleGetTableContents";
import { handleGetPackage } from "./handlers/handleGetPackage";
import { handleGetInclude } from "./handlers/handleGetInclude";
import { handleGetTypeInfo } from "./handlers/handleGetTypeInfo";
import { handleGetInterface } from "./handlers/handleGetInterface";
import { handleGetTransaction } from "./handlers/handleGetTransaction";
import { handleSearchObject } from "./handlers/handleSearchObject";
import { handleGetEnhancements, parseEnhancementsFromXml } from "./handlers/handleGetEnhancements";
import { cleanup } from "./lib/utils";
import { logger } from "./lib/logger";

describe("mcp_abap_adt_server - Integration Tests", () => {
  let server: mcp_abap_adt_server;

  beforeAll(() => {
    // Initialize the server instance once before all tests
    server = new mcp_abap_adt_server();
    // Enable debug mode for tests to see log output
    process.env.DEBUG = "true";
    logger.info("Starting integration tests", { type: "TEST_START" });
  });

  afterAll(async () => {
    // Clean up server instance and utils
    logger.info("Cleaning up after tests", { type: "TEST_CLEANUP" });
    cleanup();
    // Add a longer delay to ensure all async operations complete
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe("handleGetProgram", () => {
    it("should successfully retrieve program details", async () => {
      const result = await handleGetProgram({ program_name: "RSABAPPROGRAM" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetClass", () => {
    it("should successfully retrieve class details", async () => {
      const result = await handleGetClass({
        class_name: "CL_WB_PGEDITOR_INITIAL_SCREEN",
      });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetFunctionGroup", () => {
    it("should successfully retrieve function group details", async () => {
      const result = await handleGetFunctionGroup({ function_group: "WBABAP" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetFunction", () => {
    it("should successfully retrieve function module details", async () => {
      const result = await handleGetFunction({
        function_name: "WB_PGEDITOR_INITIAL_SCREEN",
        function_group: "WBABAP",
      });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetTable", () => {
    it("should successfully retrieve table details", async () => {
      const result = await handleGetTable({ table_name: "DD02L" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetTableContents", () => {
    it("should successfully retrieve table contents", async () => {
      const result = await handleGetTableContents({ 
        table_name: "T000",
        max_rows: 10 
      });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });

    it("should use default max_rows when not specified", async () => {
      const result = await handleGetTableContents({ 
        table_name: "T000"
      });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    }, 15000); // Increase timeout to 15 seconds for this specific test

    it("should return error when table_name is missing", async () => {
      const result = await handleGetTableContents({});
      expect(result.isError).toBe(true);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].text).toContain("Table name is required");
    });

    // Add test to verify SQL generation format
    it('should generate correct SQL SELECT statement format', async () => {
        // Mock the makeAdtRequest to capture the SQL statement
        let capturedSql = '';
        const originalMakeAdtRequest = require('./lib/utils').makeAdtRequest;
        
        // Mock only the table structure call
        require('./lib/utils').makeAdtRequest = jest.fn()
            .mockImplementationOnce(() => {
                // First call - table structure
                return Promise.resolve({
                    data: `@EndUserText.label : 'Clients'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #C
@AbapCatalog.dataMaintenance : #ALLOWED
define table t000 {
  key mandt  : mandt not null;
  mtext      : mtext_d not null;
  ort01      : ort01 not null;
  mwaer      : mwaer not null;
  adrnr      : char10 not null;
  cccategory : cccategory not null;
}`
                });
            })
            .mockImplementationOnce((url, method, timeout, payload) => {
                // Second call - table contents with SQL payload
                capturedSql = payload;
                return Promise.resolve({
                    status: 200,
                    data: '<?xml version="1.0" encoding="utf-8"?><dataPreview:tableData>...</dataPreview:tableData>'
                });
            });

        const result = await handleGetTableContents({ table_name: 'T000', max_rows: 5 });
        
        expect(result.isError).toBe(false);
        expect(capturedSql).toContain('SELECT T000~MANDT, T000~MTEXT, T000~ORT01, T000~MWAER, T000~ADRNR, T000~CCCATEGORY FROM T000');
        expect(capturedSql).not.toContain('SELECT *');
        
        // Restore original function
        require('./lib/utils').makeAdtRequest = originalMakeAdtRequest;
    });
  });

  describe("handleGetStructure", () => {
    it("should successfully retrieve structure details", async () => {
      const result = await handleGetStructure({ structure_name: "SYST" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetPackage", () => {
    it("should successfully retrieve package details", async () => {
      const result = await handleGetPackage({ package_name: "SABP_TYPES" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetInclude", () => {
    it("should successfully retrieve include details", async () => {
      const result = await handleGetInclude({ include_name: "LWBABAPF00" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetTypeInfo", () => {
    it("should successfully retrieve type info", async () => {
      const result = await handleGetTypeInfo({ type_name: "SYST_SUBRC" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetInterface", () => {
    it("should successfully retrieve interface details", async () => {
      const result = await handleGetInterface({
        interface_name: "IF_T100_MESSAGE",
      });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleSearchObject", () => {
    it("should successfully search for an object", async () => {
      const result = await handleSearchObject({ query: "SYST" });
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetTransaction", () => {
    it("should successfully retrieve transaction details", async () => {
      const result = await handleGetTransaction({ transaction_name: "SE93" });
      // Використовуємо наш логер замість console.log
      expect(result.isError).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
    });
  });

  describe("handleGetEnhancements", () => {
    it("should successfully retrieve enhancement details for a program", async () => {
      const result = await handleGetEnhancements({ 
        object_name: "SD_SALES_DOCUMENT_VIEW" 
      });
      // Check if it's not an error response
      expect('isError' in result ? result.isError : false).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
      
      // Parse the JSON response to verify enhancement data structure
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('object_name');
      expect(responseData).toHaveProperty('object_type');
      expect(responseData).toHaveProperty('enhancements');
      expect(Array.isArray(responseData.enhancements)).toBe(true);
    });

    it("should successfully retrieve enhancement details for an include with manual program context", async () => {
      const result = await handleGetEnhancements({ 
        object_name: "mv45afzz",
        program: "SAPMV45A"
      });
      // Check if it's not an error response
      expect('isError' in result ? result.isError : false).toBe(false);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
      
      // Parse the JSON response to verify enhancement data structure
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('object_name');
      expect(responseData.object_name).toBe('mv45afzz');
      expect(responseData).toHaveProperty('object_type');
      expect(responseData.object_type).toBe('include');
    });

    it("should parse enhancement XML and decode base64 source code correctly", () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<enh:enhancements xmlns:enh="http://www.sap.com/adt/enhancements">
    <enh:element enh:name="ENH_001" enh:type="implementation">
        <enh:source>SEVMTE8gV09STEQh</enh:source>
        <enh:description>Test Enhancement 1</enh:description>
    </enh:element>
    <enh:element enh:name="ENH_002" enh:type="implementation">
        <enh:source>REFQTE9SVCBaUCBmcm9tIGVuaGFuY2VtZW50</enh:source>
        <enh:description>Test Enhancement 2</enh:description>
    </enh:element>
</enh:enhancements>`;

      const result = parseEnhancementsFromXml(sampleXml);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      
      // Check first enhancement
      expect(result[0].name).toBe("enhancement_1");
      expect(result[0].type).toBe("enhancement");
      expect(result[0].sourceCode).toBe("HELLO WORLD!");
      
      // Check second enhancement
      expect(result[1].name).toBe("enhancement_2");
      expect(result[1].type).toBe("enhancement");
      expect(result[1].sourceCode).toBe("DAPLORT ZP from enhancement");
    });
  });
});
