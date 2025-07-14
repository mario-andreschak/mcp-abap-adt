import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, getBaseUrl } from '../lib/utils';
import convert from 'xml-js';
import { handleSearchObject } from './handleSearchObject';
import { XMLParser } from 'fast-xml-parser';

export const TOOL_DEFINITION = {
  name: "GetObjectInfo",
  description: "Return ABAP object tree: root, group nodes, and terminal leaves up to maxDepth. Enrich each node via SearchObject if enrich=true. Group nodes are included for hierarchy. Each node has node_type: root, point, end.",
  inputSchema: {
    type: "object",
    properties: {
      parent_type: { type: "string", description: "Parent object type (e.g. DEVC/K, CLAS/OC, PROG/P)" },
      parent_name: { type: "string", description: "Parent object name" },
      maxDepth: { type: "integer", description: "Максимальна глибина дерева (default 2)", default: 2 },
      enrich: { type: "boolean", description: "Чи додавати опис та пакет через SearchObject (default true)", default: true }
    },
    required: ["parent_type", "parent_name"]
  }
} as const;

async function fetchNodeStructureRaw(parent_type: string, parent_name: string, node_id?: string) {
  const url = `${await getBaseUrl()}/sap/bc/adt/repository/nodestructure`;
  const params: any = {
    parent_type,
    parent_name,
    withShortDescriptions: true
  };
  if (node_id) params.node_id = node_id;
  const response = await makeAdtRequestWithTimeout(url, 'POST', 'default', undefined, params);
  const result = convert.xml2js(response.data, {compact: true});
  let nodes = result["asx:abap"]?.["asx:values"]?.DATA?.TREE_CONTENT?.SEU_ADT_REPOSITORY_OBJ_NODE || [];
  if (!Array.isArray(nodes)) nodes = [nodes];
  return nodes;
}

async function enrichNodeWithSearchObject(objectType: string, objectName: string, fallbackDescription?: string) {
  let packageName = undefined;
  let description = fallbackDescription;
  let type = objectType;
  try {
    const searchResult = await handleSearchObject({
      query: objectName,
      object_type: objectType,
      maxResults: 1
    });
    if (!searchResult.isError && Array.isArray(searchResult.content)) {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      for (const entry of searchResult.content) {
        if (typeof entry.text === "string" && !entry.text.trim().startsWith("Error: <?xml")) {
          const parsed = parser.parse(entry.text);
          const refs = parsed?.['adtcore:objectReferences']?.['adtcore:objectReference'];
          const objects = refs
            ? Array.isArray(refs)
              ? refs
              : [refs]
            : [];
          for (const obj of objects) {
            if (
              obj['adtcore:type'] &&
              obj['adtcore:name'] &&
              obj['adtcore:name'].toUpperCase() === objectName.toUpperCase()
            ) {
              packageName = obj['adtcore:packageName'];
              description = obj['adtcore:description'] || description;
              type = obj['adtcore:type'];
              return { packageName, description, type };
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return { packageName, description, type };
}

function getText(node: any, key: string) {
  if (!node) return undefined;
  if (node[key] && typeof node[key] === 'object' && '_text' in node[key]) return node[key]._text;
  if (typeof node[key] === 'string') return node[key];
  return undefined;
}

// Terminal leaf: has OBJECT_NAME and OBJECT_URI
function isTerminalLeaf(node: any): boolean {
  return !!getText(node, 'OBJECT_NAME') && !!getText(node, 'OBJECT_URI');
}

// Group node: has NODE_ID, OBJECT_TYPE, but no OBJECT_URI
function isGroupNode(node: any): boolean {
  return !!getText(node, 'NODE_ID') && !!getText(node, 'OBJECT_TYPE') && !getText(node, 'OBJECT_URI');
}

function getNodeType(node: any, depth: number): 'root' | 'point' | 'end' {
  if (depth === 0) return 'root';
  if (isTerminalLeaf(node)) return 'end';
  if (isGroupNode(node)) return 'point';
  return 'point';
}

async function buildTree(
  objectType: string,
  objectName: string,
  depth: number,
  maxDepth: number,
  enrich: boolean,
  node_id?: string
): Promise<any> {
  // 1. Enrich root node
  let enrichment: any = { packageName: undefined, description: undefined, type: objectType };
  if (enrich) {
    enrichment = await enrichNodeWithSearchObject(objectType, objectName);
  }
  // 2. Get children if depth < maxDepth
  let children: any[] = [];
  if (depth < maxDepth) {
    // Для root node_id = "0000", для інших - реальний NODE_ID
    const nodes = await fetchNodeStructureRaw(objectType, objectName, depth === 0 ? "0000" : node_id);
    for (const node of nodes) {
      if (isGroupNode(node)) {
        // Group node: recurse, attach its children
        const groupChildren = await buildTree(
          getText(node, 'OBJECT_TYPE'),
          getText(node, 'OBJECT_NAME'),
          depth + 1,
          maxDepth,
          enrich,
          getText(node, 'NODE_ID')
        );
        children.push({
          OBJECT_TYPE: getText(node, 'OBJECT_TYPE'),
          OBJECT_NAME: getText(node, 'OBJECT_NAME'),
          NODE_ID: getText(node, 'NODE_ID'),
          PARENT_NODE_ID: getText(node, 'PARENT_NODE_ID'),
          node_type: getNodeType(node, depth + 1),
          CHILDREN: groupChildren.CHILDREN
        });
      } else if (isTerminalLeaf(node)) {
        // Terminal leaf: add as is
        children.push({
          OBJECT_TYPE: getText(node, 'OBJECT_TYPE'),
          OBJECT_NAME: getText(node, 'OBJECT_NAME'),
          OBJECT_URI: getText(node, 'OBJECT_URI'),
          NODE_ID: getText(node, 'NODE_ID'),
          PARENT_NODE_ID: getText(node, 'PARENT_NODE_ID'),
          node_type: getNodeType(node, depth + 1),
          CHILDREN: []
        });
      }
      // else: skip nodes that are neither group nor terminal leaf
    }
  }
  return {
    OBJECT_TYPE: enrichment.type || objectType,
    OBJECT_NAME: objectName,
    OBJECT_DESCRIPTION: enrichment.description,
    OBJECT_PACKAGE: enrichment.packageName,
    NODE_ID: depth === 0 ? "ROOT" : node_id,
    node_type: getNodeType({ OBJECT_TYPE: objectType, OBJECT_NAME: objectName }, depth),
    CHILDREN: children
  };
}

export async function handleGetObjectInfo(args: { parent_type: string; parent_name: string; maxDepth?: number; enrich?: boolean }) {
  try {
    if (!args?.parent_type || !args?.parent_name) {
      throw new McpError(ErrorCode.InvalidParams, 'parent_type and parent_name are required');
    }
    const maxDepth = Number.isInteger(args.maxDepth) ? args.maxDepth as number : 2;
    const enrich = typeof args.enrich === 'boolean' ? args.enrich : true;
    const result = await buildTree(args.parent_type, args.parent_name, 0, maxDepth, enrich);
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}
