import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, getBaseUrl, return_error } from '../lib/utils';

/**
 * Map type/name to the ADT activation URI (the same one used in <adtcore:objectReference uri="...">).
 * This is the OBJECT URI (without /source/main) — activation works at the object level.
 */
function activationUriFor(objectType: string, name: string): string {
    const enc = encodeURIComponent(name);
    const t = objectType.toUpperCase();
    switch (t) {
        case 'CLAS':
        case 'CLAS/OC':
        case 'CLASS':
            return `/sap/bc/adt/oo/classes/${enc}`;
        case 'INTF':
        case 'INTF/OI':
        case 'INTERFACE':
            return `/sap/bc/adt/oo/interfaces/${enc}`;
        case 'PROG':
        case 'PROG/P':
        case 'PROGRAM':
        case 'REPORT':
            return `/sap/bc/adt/programs/programs/${enc}`;
        case 'PROG/I':
        case 'INCLUDE':
            return `/sap/bc/adt/programs/includes/${enc}`;
        case 'FUGR':
        case 'FUGR/F':
        case 'FUNCTION_GROUP':
            return `/sap/bc/adt/functions/groups/${enc}`;
        case 'FUGR/FF':
        case 'FUNCTION_MODULE': {
            throw new McpError(ErrorCode.InvalidParams,
                `For function modules, provide object_type='FUGR/FF', object_name='<FM>', and function_group='<FG>'. ` +
                `Or pass object_uri directly.`);
        }
        case 'DDLS':
        case 'DDLS/DF':
            return `/sap/bc/adt/ddic/ddl/sources/${enc}`;
        default:
            throw new McpError(ErrorCode.InvalidParams,
                `Unsupported objectType: ${objectType}. Supported: CLAS, INTF, PROG, PROG/I, FUGR, DDLS. ` +
                `Or pass object_uri directly.`);
    }
}

/**
 * POST /sap/bc/adt/activation with an <adtcore:objectReferences> body.
 *
 * Args (either pattern works):
 *   { object_type, object_name }   — convenient form for common types
 *   { object_type:'FUGR/FF', object_name:<FM>, function_group:<FG> } — for FMs
 *   { object_uri }                 — raw ADT URI (escape hatch for any type)
 *
 * Returns: activation messages. Empty messages = clean activation.
 */
export async function handleActivateObject(args: any) {
    try {
        let objectUri: string;
        let objectName: string;

        if (typeof args?.object_uri === 'string' && args.object_uri.length > 0) {
            objectUri = args.object_uri;
            objectName = args.object_name || objectUri.split('/').filter(Boolean).pop() || objectUri;
        } else {
            if (!args?.object_type || typeof args.object_type !== 'string') {
                throw new McpError(ErrorCode.InvalidParams,
                    'Either object_uri OR (object_type + object_name) is required.');
            }
            if (!args?.object_name || typeof args.object_name !== 'string') {
                throw new McpError(ErrorCode.InvalidParams, 'object_name is required (string)');
            }
            const t = args.object_type.toUpperCase();
            if (t === 'FUGR/FF' || t === 'FUNCTION_MODULE') {
                if (!args?.function_group || typeof args.function_group !== 'string') {
                    throw new McpError(ErrorCode.InvalidParams,
                        'function_group is required when activating a function module.');
                }
                const encFm = encodeURIComponent(args.object_name);
                const encFg = encodeURIComponent(args.function_group);
                objectUri = `/sap/bc/adt/functions/groups/${encFg}/fmodules/${encFm}`;
            } else {
                objectUri = activationUriFor(args.object_type, args.object_name);
            }
            objectName = args.object_name;
        }

        const xmlBody =
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">\n` +
            `  <adtcore:objectReference adtcore:uri="${objectUri.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" ` +
            `adtcore:name="${String(objectName).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"/>\n` +
            `</adtcore:objectReferences>`;

        const url = `${await getBaseUrl()}/sap/bc/adt/activation?method=activate&preauditRequested=true`;

        const response = await makeAdtRequest(url, 'POST', 60000, xmlBody, undefined, {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
        });

        const body = typeof response.data === 'string' ? response.data : String(response.data);

        // ADT returns 200 with either: empty body (clean), <chkl:messages> list with
        // <msg type="E|W|I" line="N" .../> children, or <inactive>... refs. Parse them
        // into structured messages so callers can iterate without regex.
        type AdtMsg = { severity: string; line: string; offset: string; message: string };
        const messages: AdtMsg[] = [];
        const msgRe = /<msg\b([^>]*)>([\s\S]*?)<\/msg>/g;
        const attr = (s: string, name: string) => {
            const m = s.match(new RegExp(`${name}="([^"]*)"`, 'i'));
            return m ? m[1] : '';
        };
        let m: RegExpExecArray | null;
        while ((m = msgRe.exec(body)) !== null) {
            const attrs = m[1];
            const inner = m[2];
            // shortText/txt or longText etc.
            const txtMatch = inner.match(/<txt>([\s\S]*?)<\/txt>/);
            const text = (txtMatch ? txtMatch[1] : inner).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const sevRaw = attr(attrs, 'type') || attr(attrs, 'severity');
            // SAP "type" uses E/W/I/A; map to a verbose severity for callers.
            const severityMap: Record<string, string> = { E: 'ERROR', W: 'WARNING', I: 'INFO', A: 'ABORT' };
            // The msg `line` attribute is the Nth message index (1-based), NOT the source line.
            // The real source line + column live in the href fragment as `#start=L,C`.
            const href = attr(attrs, 'href');
            const startMatch = href.match(/#start=(\d+),(\d+)/);
            const sourceLine = startMatch ? startMatch[1] : (attr(attrs, 'line') || '?');
            const sourceCol = startMatch ? startMatch[2] : (attr(attrs, 'offset') || '?');
            messages.push({
                severity: severityMap[sevRaw.toUpperCase()] || sevRaw.toUpperCase() || 'UNKNOWN',
                line: sourceLine,
                offset: sourceCol,
                message: text,
            });
        }

        const hasError = messages.some(m => m.severity === 'ERROR' || m.severity === 'ABORT');
        const hasInactive = /<inactive\b/i.test(body);
        const clean = !hasError && !hasInactive;

        // Build a compact, agent-friendly text body. Include parsed messages.
        let text: string;
        if (clean && messages.length === 0) {
            text = `Activation succeeded for ${objectUri}. No errors or inactive objects reported.`;
        } else if (clean) {
            // Warnings/info only — activation succeeded but with notes
            text = `Activation succeeded for ${objectUri} with ${messages.length} non-error message(s):\n` +
                   messages.map(m => `  [${m.severity}] line=${m.line} offset=${m.offset}: ${m.message}`).join('\n');
        } else if (messages.length > 0) {
            text = `Activation FAILED for ${objectUri}. ${messages.length} message(s):\n` +
                   messages.map(m => `  [${m.severity}] line=${m.line} offset=${m.offset}: ${m.message}`).join('\n');
        } else {
            // Has inactive list but no parsed messages
            text = `Activation could not complete for ${objectUri}. Server response:\n\n${body.slice(0, 2000)}`;
        }

        return {
            isError: !clean,
            content: [{ type: 'text', text }],
        };
    } catch (error) {
        return return_error(error);
    }
}
