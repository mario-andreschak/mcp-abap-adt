import { return_response, McpError, AxiosResponse } from './utils';

// Deterministic unit tests for return_response()'s size-capping/pagination
// logic. Unlike index.test.ts (which requires a live SAP connection), these
// exercise pure functions against hand-built AxiosResponse-shaped fixtures
// and run in any environment with no network/credentials.

function asAxiosResponse(data: any): AxiosResponse {
  return { data } as AxiosResponse;
}

describe('return_response - string (line-based) results', () => {
  it('returns small content unchanged (no wrapper) when no paging is requested', () => {
    const result = return_response(asAxiosResponse('line1\nline2\nline3'));
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('line1\nline2\nline3');
  });

  it('auto-pages a large multi-line result without an explicit request', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => 'x'.repeat(30) + i);
    const data = lines.join('\n');
    const result = return_response(asAxiosResponse(data));
    const payload = JSON.parse(result.content[0].text);

    expect(payload.autoPaged).toBe(true);
    expect(payload.totalLines).toBe(5000);
    expect(payload.hasMore).toBe(true);
    expect(payload.returnedLines).toBeLessThan(5000);
    // The final serialized text itself must respect the byte budget, not
    // just the pre-serialization estimate.
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });

  it('shrinks an explicit maxLines request that would itself be oversized', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => 'x'.repeat(30) + i);
    const data = lines.join('\n');
    const result = return_response(asAxiosResponse(data), { startLine: 1, maxLines: 5000 });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.capped).toBe(true);
    expect(payload.returnedLines).toBeLessThan(5000);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });

  it('honours a small explicit maxLines request exactly, with no capping', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => 'x'.repeat(30) + i);
    const data = lines.join('\n');
    const result = return_response(asAxiosResponse(data), { startLine: 10, maxLines: 5 });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.capped).toBeUndefined();
    expect(payload.startLine).toBe(10);
    expect(payload.returnedLines).toBe(5);
  });

  it('falls back to a mid-line byte-safe cut when even a single line is too large', () => {
    const singleHugeLine = 'y'.repeat(500_000);
    const result = return_response(asAxiosResponse(singleHugeLine));
    const payload = JSON.parse(result.content[0].text);

    expect(payload.truncatedMidLine).toBe(true);
    expect(payload.capped).toBe(true);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });

  it('accounts for UTF-8 byte length, not JS string length, when sizing', () => {
    // Each 'á' is 1 UTF-16 code unit (so .length undercounts) but 2 UTF-8
    // bytes. ~25,000 of them is under 40,000 in .length but over 40,000 in
    // actual UTF-8 bytes once JSON-escaped/wrapped - must still be paged.
    const accentedLine = 'á'.repeat(25_000);
    expect(accentedLine.length).toBeLessThan(40_000);
    expect(Buffer.byteLength(accentedLine, 'utf8')).toBeGreaterThan(40_000);

    const result = return_response(asAxiosResponse(accentedLine));
    const payload = JSON.parse(result.content[0].text);

    expect(payload.autoPaged).toBe(true);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });
});

describe('return_response - array (item-based) results', () => {
  it('returns a small array unchanged (no wrapper) when no paging is requested', () => {
    const items = [{ a: 1 }, { a: 2 }];
    const result = return_response(asAxiosResponse(items));
    expect(JSON.parse(result.content[0].text)).toEqual(items);
  });

  it('auto-pages a large array without an explicit request', () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({
      OBJECT_TYPE: 'CLAS/OC',
      OBJECT_NAME: 'ZCL_' + i,
      OBJECT_DESCRIPTION: 'x'.repeat(30),
      OBJECT_URI: '/sap/bc/adt/oo/classes/zcl_' + i
    }));
    const result = return_response(asAxiosResponse(items));
    const payload = JSON.parse(result.content[0].text);

    expect(payload.autoPaged).toBe(true);
    expect(payload.totalItems).toBe(3000);
    expect(payload.hasMore).toBe(true);
    expect(payload.returnedItems).toBeLessThan(3000);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });

  it('shrinks an explicit maxItems request that would itself be oversized', () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ name: 'ZCL_' + i, desc: 'x'.repeat(30) }));
    const result = return_response(asAxiosResponse(items), { startIndex: 0, maxItems: 3000 });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.capped).toBe(true);
    expect(payload.returnedItems).toBeLessThan(3000);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });

  it('falls back to a mid-item cut when even a single item is too large', () => {
    const items = [{ name: 'ZCL_HUGE', blob: 'z'.repeat(200_000) }];
    const result = return_response(asAxiosResponse(items));
    const payload = JSON.parse(result.content[0].text);

    expect(payload.truncatedMidItem).toBe(true);
    expect(payload.capped).toBe(true);
    expect(Buffer.byteLength(result.content[0].text, 'utf8')).toBeLessThanOrEqual(40_000);
  });
});

describe('return_response - non-string/non-array results', () => {
  it('passes structured (already-parsed) data through unchanged', () => {
    const structured = { rows: [{ a: 1 }], count: 1 };
    const result = return_response(asAxiosResponse(structured));
    expect(result.content[0].text).toBe(structured);
  });
});

describe('return_response - paging argument validation', () => {
  it('rejects a non-numeric startLine instead of silently defaulting it', () => {
    expect(() => return_response(asAxiosResponse('a\nb\nc'), { startLine: 'not-a-number' }))
      .toThrow(McpError);
  });

  it('rejects a negative startIndex for array results', () => {
    expect(() => return_response(asAxiosResponse([{ a: 1 }]), { startIndex: -1 }))
      .toThrow(McpError);
  });

  it('rejects a non-integer maxLines', () => {
    expect(() => return_response(asAxiosResponse('a\nb\nc'), { startLine: 1, maxLines: 1.5 }))
      .toThrow(McpError);
  });

  it('rejects a negative maxItems', () => {
    expect(() => return_response(asAxiosResponse([{ a: 1 }]), { startIndex: 0, maxItems: -5 }))
      .toThrow(McpError);
  });

  it('accepts undefined paging args (treated as "not specified")', () => {
    expect(() => return_response(asAxiosResponse('a\nb\nc'), {})).not.toThrow();
  });
});
