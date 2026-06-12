import { makeAdtRequest } from './utils';

/**
 * Edit-flow helpers for ABAP objects over ADT REST.
 *
 * Every ABAP object type uses the same lock/PUT/unlock sequence; only the URI changes.
 * Centralising it here keeps each Set* handler ~10 lines.
 *
 * Sequence per write:
 *   1. POST  {objectBase}?_action=LOCK&accessMode=MODIFY   (stateful)
 *      -> XML body with <LOCK_HANDLE>...</LOCK_HANDLE>
 *   2. PUT   {objectBase}/source/main?lockHandle=<h>       (stateful, body=new source)
 *      (or another sub-URI like /includes/definitions for class parts)
 *   3. POST  {objectBase}?_action=UNLOCK&lockHandle=<h>    (stateful)
 *
 * Notes:
 *  - Activation is intentionally NOT done here: the user already has
 *    mcp__sap-adt-official__abap_activate_objects, which is the authoritative
 *    activator. Keeping the responsibilities separate also lets a caller batch
 *    multiple Set* edits and activate once.
 *  - Cookies (sap-contextid / JSESSIONID) are tracked globally in utils.ts so
 *    the stateful session survives across the three calls.
 *  - We always pass `Accept` for the lock so the server returns the lock
 *    handle XML body even when other variants exist.
 */

const STATEFUL = 'X-sap-adt-sessiontype';
const LOCK_ACCEPT = 'application/vnd.sap.as+xml;dataname=com.sap.adt.lock.Result2,application/vnd.sap.as+xml;dataname=com.sap.adt.lock.Result';

/** Extract `<LOCK_HANDLE>...</LOCK_HANDLE>` from the ADT lock-response XML. */
export function parseLockHandle(xml: string): string {
    if (!xml || typeof xml !== 'string') {
        throw new Error(`Cannot parse lock handle from non-string body: ${typeof xml}`);
    }
    const match = xml.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/i);
    if (!match) {
        throw new Error(`No LOCK_HANDLE in ADT lock response. First 500 chars: ${xml.substring(0, 500)}`);
    }
    return match[1];
}

/**
 * POST {objectBase}?_action=LOCK&accessMode=MODIFY
 *
 * Returns the lock handle. The lock response BODY also contains a CORRNR field
 * with the object's existing TR (if any). We do NOT pass corrNr here — ADT only
 * accepts it for objects that need a fresh TR assignment, and for objects
 * already in a TR it errors with "Parameter corrNr could not be found". If a
 * transport_request_number was supplied, it's used on the PUT instead.
 */
export async function lockObject(objectBase: string): Promise<string> {
    const url = `${objectBase}?_action=LOCK&accessMode=MODIFY`;
    const response = await makeAdtRequest(url, 'POST', 30000, undefined, undefined, {
        [STATEFUL]: 'stateful',
        'Accept': LOCK_ACCEPT,
    });
    return parseLockHandle(typeof response.data === 'string' ? response.data : String(response.data));
}

/** POST {objectBase}?_action=UNLOCK&lockHandle=<h>. Errors are warned, not thrown. */
export async function unlockObject(objectBase: string, lockHandle: string): Promise<void> {
    const url = `${objectBase}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    try {
        await makeAdtRequest(url, 'POST', 30000, undefined, undefined, {
            [STATEFUL]: 'stateful',
        });
    } catch (e) {
        // Don't mask a successful write because the unlock fizzled — lock will time out
        // server-side anyway, and re-locking the same user on the same object is harmless.
        // eslint-disable-next-line no-console
        console.error(`[adtEdit] unlock failed for ${objectBase}: ${e instanceof Error ? e.message : e}`);
    }
}

/**
 * lock -> fn(lockHandle) -> unlock (always, even on error).
 * Use this in every Set* handler so the cleanup path is identical.
 *
 * NOTE: opts.transportRequestNumber is accepted here but is forwarded to the
 * caller's `fn` via a closure, not to LOCK (see lockObject for why). The standard
 * pattern is for the caller to pass it through to putSource() below.
 */
export async function withWriteAccess<T>(
    objectBase: string,
    fn: (lockHandle: string) => Promise<T>,
    _opts: { transportRequestNumber?: string } = {}
): Promise<T> {
    const lockHandle = await lockObject(objectBase);
    try {
        return await fn(lockHandle);
    } finally {
        await unlockObject(objectBase, lockHandle);
    }
}

/**
 * PUT {sourceUri}?lockHandle=<h>[&corrNr=<TR>] with raw ABAP source text.
 * Caller has already acquired the lock via withWriteAccess.
 *
 * For objects already recorded in an open TR (the common case for non-$TMP
 * objects you're editing routinely), corrNr is unnecessary and the server
 * auto-uses the existing TR. For first-time edits of an object you need to
 * supply corrNr — the server returns 400 if the object would need to be
 * recorded but corrNr is missing.
 */
export async function putSource(
    sourceUri: string,
    lockHandle: string,
    source: string,
    opts: { transportRequestNumber?: string } = {}
): Promise<void> {
    let url = `${sourceUri}?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (opts.transportRequestNumber) {
        url += `&corrNr=${encodeURIComponent(opts.transportRequestNumber)}`;
    }
    await makeAdtRequest(url, 'PUT', 60000, source, undefined, {
        [STATEFUL]: 'stateful',
        'Content-Type': 'text/plain; charset=utf-8',
    });
}
