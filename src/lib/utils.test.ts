import {
  MAX_PAGE_LINES,
  SAFE_OUTPUT_BYTES,
  return_response,
  return_text_response
} from './utils';

function responseText(result: any): string {
  return result.content[0].text;
}

function page(result: any): any {
  expect(result.isError).toBe(false);
  return JSON.parse(responseText(result));
}

describe('bounded text responses', () => {
  it('preserves small unpaged text exactly, including escaping and Unicode', () => {
    const value = 'first\r\n"quoted" \\ path\tcontrol é 漢字 😀';

    expect(responseText(return_text_response(value))).toBe(value);
    expect(responseText(return_text_response(value, {}))).toBe(value);
  });

  it('serializes structured and non-string values explicitly', () => {
    expect(responseText(return_text_response({ answer: 42 }))).toBe('{"answer":42}');
    expect(responseText(return_text_response(['a', 2]))).toBe('["a",2]');
    expect(responseText(return_text_response(null))).toBe('null');
    expect(responseText(return_text_response(undefined))).toBe('undefined');
    expect(responseText(return_response({ data: { ok: true } } as any))).toBe('{"ok":true}');
  });

  it('returns stable metadata for explicit paging', () => {
    expect(page(return_text_response(
      'line 1\nline 2\nline 3\nline 4',
      { startLine: 2, maxLines: 2 }
    ))).toEqual({
      content: 'line 2\nline 3',
      totalLines: 4,
      startLine: 2,
      returnedLines: 2,
      hasMore: true
    });
  });

  it('handles pages ending at and starting beyond EOF', () => {
    expect(page(return_text_response('one\ntwo\nthree', {
      startLine: 2,
      maxLines: 2
    }))).toMatchObject({
      content: 'two\nthree',
      returnedLines: 2,
      hasMore: false
    });

    expect(page(return_text_response('one\ntwo\nthree', {
      startLine: 10,
      maxLines: 2
    }))).toEqual({
      content: '',
      totalLines: 3,
      startLine: 10,
      returnedLines: 0,
      hasMore: false
    });
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fraction', 1.5],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['string', '2'],
    ['boolean', true],
    ['above the upper bound', MAX_PAGE_LINES + 1]
  ])('rejects invalid maxLines: %s', (_label, maxLines) => {
    const result = return_text_response('one\ntwo', { maxLines });

    expect(result.isError).toBe(true);
    expect(responseText(result)).toContain('maxLines must be a finite integer');
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fraction', 1.5],
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['string', '2'],
    ['boolean', false]
  ])('rejects invalid startLine: %s', (_label, startLine) => {
    const result = return_text_response('one\ntwo', { startLine });

    expect(result.isError).toBe(true);
    expect(responseText(result)).toContain('startLine must be a finite integer');
  });

  it('auto-pages large multiline Unicode content within the final UTF-8 budget', () => {
    const value = Array.from(
      { length: 5_000 },
      (_, index) => 'line ' + (index + 1) + ': "quoted" \\ é 漢字 😀😀😀'
    ).join('\n');

    const result = return_text_response(value);
    const payload = page(result);

    expect(Buffer.byteLength(responseText(result), 'utf8')).toBeLessThanOrEqual(SAFE_OUTPUT_BYTES);
    expect(payload).toMatchObject({
      totalLines: 5_000,
      startLine: 1,
      hasMore: true,
      autoPaged: true,
      capped: true
    });
    expect(payload.returnedLines).toBeGreaterThan(0);
  });

  it('caps an explicitly oversized requested range', () => {
    const value = Array.from(
      { length: 4_000 },
      (_, index) => 'line ' + (index + 1) + ' ' + 'x'.repeat(30)
    ).join('\n');

    const result = return_text_response(value, { startLine: 1, maxLines: 4_000 });
    const payload = page(result);

    expect(Buffer.byteLength(responseText(result), 'utf8')).toBeLessThanOrEqual(SAFE_OUTPUT_BYTES);
    expect(payload.capped).toBe(true);
    expect(payload.autoPaged).toBeUndefined();
    expect(payload.returnedLines).toBeLessThan(4_000);
    expect(payload.hasMore).toBe(true);
  });

  it('pretty-prints structured values when explicit paging needs line boundaries', () => {
    const payload = page(return_text_response(
      { first: 1, second: ['two', 'three'] },
      { startLine: 1, maxLines: MAX_PAGE_LINES }
    ));

    expect(payload.content).toContain('\n');
    expect(JSON.parse(payload.content)).toEqual({ first: 1, second: ['two', 'three'] });
    expect(payload.hasMore).toBe(false);
  });

  it('safely truncates an oversized final line without splitting an emoji', () => {
    const value = '😀'.repeat(SAFE_OUTPUT_BYTES);
    const result = return_text_response(value, { startLine: 1, maxLines: 1 });
    const payload = page(result);

    expect(Buffer.byteLength(responseText(result), 'utf8')).toBeLessThanOrEqual(SAFE_OUTPUT_BYTES);
    expect(payload).toMatchObject({
      totalLines: 1,
      startLine: 1,
      returnedLines: 1,
      hasMore: false,
      capped: true,
      truncatedMidLine: true
    });
    expect(value.startsWith(payload.content)).toBe(true);
    expect(payload.content.length).toBeLessThan(value.length);
    const lastCodeUnit = payload.content.charCodeAt(payload.content.length - 1);
    expect(lastCodeUnit < 0xD800 || lastCodeUnit > 0xDBFF).toBe(true);
  });

  it('reports later lines after truncating an oversized non-final line', () => {
    const value = 'z'.repeat(SAFE_OUTPUT_BYTES * 2) + '\nsecond line';
    const payload = page(return_text_response(value));

    expect(payload).toMatchObject({
      returnedLines: 1,
      hasMore: true,
      autoPaged: true,
      capped: true,
      truncatedMidLine: true
    });
  });
});
