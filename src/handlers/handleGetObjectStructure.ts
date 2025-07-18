// Handler for retrieving ADT object structure and returning compact JSON tree

import { makeAdtRequestWithTimeout, getBaseUrl } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

export const TOOL_DEFINITION = {
  name: "GetObjectStructure",
  description: "Retrieve ADT object structure as a compact JSON tree.",
  inputSchema: {
    type: "object",
    properties: {
      objecttype: {
        type: "string",
        description: "ADT object type (e.g. DDLS/DF)"
      },
      objectname: {
        type: "string",
        description: "ADT object name (e.g. /CBY/ACQ_DDL)"
      }
    },
    required: ["objecttype", "objectname"]
  }
} as const;

// Build nested tree from flat node list (nodeid/parentid)
function buildNestedTree(flatNodes: any[]) {
  const nodeMap: Record<string, any> = {};
  flatNodes.forEach(node => {
    nodeMap[node.nodeid] = {
      objecttype: node.objecttype,
      objectname: node.objectname,
      children: []
    };
  });
  const roots: any[] = [];
  flatNodes.forEach(node => {
    if (node.parentid && nodeMap[node.parentid]) {
      nodeMap[node.parentid].children.push(nodeMap[node.nodeid]);
    } else {
      roots.push(nodeMap[node.nodeid]);
    }
  });
  return roots;
}

// Serialize tree to MCP-compatible text format ("tree:")
function serializeTree(tree: any[], indent: string = ''): string {
  let result = '';
  for (const node of tree) {
    result += `${indent}- ${node.objecttype}: ${node.objectname}\n`;
    if (node.children && node.children.length > 0) {
      result += serializeTree(node.children, indent + '  ');
    }
  }
  return result;
}

export async function handleGetObjectStructure(args: any) {
  try {
    const url = `${await getBaseUrl()}/sap/bc/adt/repository/objectstructure?objecttype=${encodeURIComponent(args.objecttype)}&objectname=${encodeURIComponent(args.objectname)}`;
    const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');

    // Parse XML response
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const parsed = parser.parse(response.data);

    // Get flat node list
    let nodes = parsed['projectexplorer:objectstructure']?.['projectexplorer:node'];
    if (!nodes) {
      return {
        isError: true,
        content: [
          { type: "text", text: "No nodes found in object structure response." }
        ]
      };
    }
    // Ensure nodes is always an array
    if (!Array.isArray(nodes)) nodes = [nodes];

    // Build nested tree
    const tree = buildNestedTree(nodes);

    // Serialize to MCP-compatible text format
    const treeText = 'tree:\n' + serializeTree(tree);

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: treeText
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `ADT error: ${String(error)}`
        }
      ]
    };
  }
}
