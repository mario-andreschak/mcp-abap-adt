import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, getBaseUrl } from '../lib/utils';
import convert from 'xml-js';
import { handleSearchObject } from './handleSearchObject';
import { XMLParser } from 'fast-xml-parser';

export const TOOL_DEFINITION = {
  name: "GetObjectInfo",
  description: "Return all objects related to a given ABAP object using nodestructure, traversing at least two levels. Each node includes description and package if available. Enrichment uses only SearchObject.",
  inputSchema: {
    type: "object",
    properties: {
      parent_type: { type: "string", description: "Parent object type (e.g. DEVC/K, CLAS/OC, PROG/P)" },
      parent_name: { type: "string", description: "Parent object name" }
    },
    required: ["parent_type", "parent_name"]
  }
} as const;

async function fetchNodeStructure(parent_type: string, parent_name: string) {
  const url = `${await getBaseUrl()}/sap/bc/adt/repository/nodestructure`;
  const params = {
    parent_type,
    parent_name,
    withShortDescriptions: true
  };
  const response = await makeAdtRequestWithTimeout(url, 'POST', 'default', undefined, params);
  const result = convert.xml2js(response.data, {compact: true});
  const nodes = result["asx:abap"]?.["asx:values"]?.DATA?.TREE_CONTENT?.SEU_ADT_REPOSITORY_OBJ_NODE || [];
  return Array.isArray(nodes) ? nodes : [nodes];
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

async function enrichNode(node: any): Promise<any> {
  try {
    const { packageName, description, type } = await enrichNodeWithSearchObject(
      node.OBJECT_TYPE?._text,
      node.OBJECT_NAME?._text,
      node.DESCRIPTION?._text
    );
    return {
      OBJECT_TYPE: type || node.OBJECT_TYPE._text,
      OBJECT_NAME: node.OBJECT_NAME._text,
      OBJECT_DESCRIPTION: description,
      OBJECT_PACKAGE: packageName,
      OBJECT_URI: node.OBJECT_URI?._text,
      CHILDREN: []
    };
  } catch (e) {
    return {
      OBJECT_TYPE: node.OBJECT_TYPE?._text,
      OBJECT_NAME: node.OBJECT_NAME?._text,
      OBJECT_DESCRIPTION: node.DESCRIPTION?._text,
      OBJECT_PACKAGE: undefined,
      OBJECT_URI: node.OBJECT_URI?._text,
      CHILDREN: []
    };
  }
}

async function traverseTree(parent_type: string, parent_name: string, depth: number): Promise<any[]> {
  if (depth === 0) return [];
  const nodes = await fetchNodeStructure(parent_type, parent_name);
  const children: any[] = [];
  for (const node of nodes) {
    if (node.OBJECT_NAME?._text && node.OBJECT_TYPE?._text) {
      const child = await enrichNode(node);
      // Traverse one more level
      child.CHILDREN = await traverseTree(child.OBJECT_TYPE, child.OBJECT_NAME, depth - 1);
      children.push(child);
    }
  }
  return children;
}

export async function handleGetObjectInfo(args: { parent_type: string; parent_name: string }) {
  try {
    if (!args?.parent_type || !args?.parent_name) {
      throw new McpError(ErrorCode.InvalidParams, 'parent_type and parent_name are required');
    }
    // Enrich root node
    const { packageName: rootPackage, description: rootDescription, type: rootType } = await enrichNodeWithSearchObject(
      args.parent_type,
      args.parent_name
    );
    const tree = await traverseTree(args.parent_type, args.parent_name, 2);
    const result = {
      OBJECT_TYPE: rootType || args.parent_type,
      OBJECT_NAME: args.parent_name,
      OBJECT_DESCRIPTION: rootDescription,
      OBJECT_PACKAGE: rootPackage,
      CHILDREN: tree
    };
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
