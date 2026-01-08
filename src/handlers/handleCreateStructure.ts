/**
 * CreateStructure Handler for mcp-abap-adt
 * 
 * This is a simplified version designed to work with the mario-andreschak/mcp-abap-adt
 * project structure. It uses axios for HTTP calls to the SAP ADT REST API.
 * 
 * Add this file to: src/handlers/handle_CreateStructure.ts
 */

import axios from 'axios';

// Re-use the SAP config from your existing setup
// This interface should match what's already in your project
interface SapConfig {
  sapUrl: string;
  sapUsername: string;
  sapPassword: string;
  sapClient: string;
}

interface StructureComponent {
  name: string;
  type: string;
  description?: string;
}

interface CreateStructureArgs {
  structure_name: string;
  description: string;
  package_name: string;
  transport_request?: string;
  components: StructureComponent[];
}

/**
 * Escapes XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fetches CSRF token required for POST/PUT requests
 */
async function fetchCsrfToken(config: SapConfig): Promise<{ token: string; cookies: string[] }> {
  const response = await axios.get(`${config.sapUrl}/sap/bc/adt/discovery`, {
    auth: {
      username: config.sapUsername,
      password: config.sapPassword,
    },
    headers: {
      'X-CSRF-Token': 'Fetch',
      'sap-client': config.sapClient,
    },
  });

  const token = response.headers['x-csrf-token'];
  const cookies = response.headers['set-cookie'] || [];
  
  if (!token) {
    throw new Error('Failed to fetch CSRF token');
  }

  return { token, cookies: Array.isArray(cookies) ? cookies : [cookies] };
}

/**
 * Builds the XML body for structure creation
 */
function buildStructureXml(args: CreateStructureArgs): string {
  const componentsXml = args.components
    .map(c => {
      const desc = c.description ? ` adtcore:description="${escapeXml(c.description)}"` : '';
      return `      <structure:component structure:name="${escapeXml(c.name.toUpperCase())}" structure:type="${escapeXml(c.type.toUpperCase())}"${desc}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<structure:abapStructure 
    xmlns:structure="http://www.sap.com/adt/ddic/structures" 
    xmlns:adtcore="http://www.sap.com/adt/core"
    adtcore:name="${escapeXml(args.structure_name.toUpperCase())}"
    adtcore:description="${escapeXml(args.description)}"
    adtcore:type="TABL/DS">
  <adtcore:packageRef adtcore:name="${escapeXml(args.package_name.toUpperCase())}"/>
  <structure:components>
${componentsXml}
  </structure:components>
</structure:abapStructure>`;
}

/**
 * Main handler function - matches the pattern used in other handlers
 */
export async function handleCreateStructure(args: CreateStructureArgs, config: SapConfig): Promise<string> {
  // Validate required fields
  if (!args.structure_name?.trim()) {
    throw new Error('structure_name is required');
  }
  if (!args.description?.trim()) {
    throw new Error('description is required');
  }
  if (!args.package_name?.trim()) {
    throw new Error('package_name is required');
  }
  if (!args.components || args.components.length === 0) {
    throw new Error('At least one component is required');
  }

  // Validate components
  for (const comp of args.components) {
    if (!comp.name?.trim()) {
      throw new Error('Each component must have a name');
    }
    if (!comp.type?.trim()) {
      throw new Error(`Component ${comp.name} must have a type`);
    }
  }

  try {
    // Get CSRF token
    const { token, cookies } = await fetchCsrfToken(config);

    // Build request
    const xml = buildStructureXml(args);
    const url = `${config.sapUrl}/sap/bc/adt/ddic/structures`;
    
    const params: Record<string, string> = {};
    if (args.transport_request) {
      params['corrNr'] = args.transport_request;
    }

    // Create the structure
    const response = await axios.post(url, xml, {
      auth: {
        username: config.sapUsername,
        password: config.sapPassword,
      },
      headers: {
        'X-CSRF-Token': token,
        'sap-client': config.sapClient,
        'Content-Type': 'application/vnd.sap.adt.structures.v2+xml',
        'Accept': 'application/vnd.sap.adt.structures.v2+xml',
        'Cookie': cookies.join('; '),
      },
      params,
    });

    // Try to activate
    try {
      const activationXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/structures/${args.structure_name.toLowerCase()}" adtcore:name="${args.structure_name.toUpperCase()}"/>
</adtcore:objectReferences>`;

      await axios.post(`${config.sapUrl}/sap/bc/adt/activation`, activationXml, {
        auth: {
          username: config.sapUsername,
          password: config.sapPassword,
        },
        headers: {
          'X-CSRF-Token': token,
          'sap-client': config.sapClient,
          'Content-Type': 'application/xml',
          'Accept': 'application/xml',
          'Cookie': cookies.join('; '),
        },
        params: {
          method: 'activate',
          preauditRequested: 'true',
        },
      });

      return `Structure ${args.structure_name.toUpperCase()} created and activated successfully in package ${args.package_name.toUpperCase()}`;
    } catch (activationError) {
      return `Structure ${args.structure_name.toUpperCase()} created but activation failed. Please activate manually in ADT.`;
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data || error.message;
      throw new Error(`Failed to create structure: ${message}`);
    }
    throw error;
  }
}

// Tool definition to add to your toolDefinitions
export const CreateStructureTool = {
  name: 'CreateStructure',
  description: 'Create a new ABAP DDIC Structure in the SAP system. Use this to create reusable data structures with defined fields.',
  inputSchema: {
    type: 'object',
    properties: {
      structure_name: {
        type: 'string',
        description: 'Name of the structure (e.g., ZMY_STRUCTURE)',
      },
      description: {
        type: 'string',
        description: 'Short description of the structure',
      },
      package_name: {
        type: 'string',
        description: 'Package name (e.g., $TMP for local, ZPACKAGE for transportable)',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request (required if not $TMP)',
      },
      components: {
        type: 'array',
        description: 'Structure fields/components',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Field name' },
            type: { type: 'string', description: 'Data element or type (e.g., MATNR, CHAR10)' },
            description: { type: 'string', description: 'Optional field description' },
          },
          required: ['name', 'type'],
        },
      },
    },
    required: ['structure_name', 'description', 'package_name', 'components'],
  },
};
