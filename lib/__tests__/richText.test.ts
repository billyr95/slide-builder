import { describe, it, expect } from 'vitest'
import { sanitizeItalicHtml, plainTextToEditableHtml, processEditedHtml } from '@/lib/richText'

describe('sanitizeItalicHtml: allowlists only bare <i>/</i>', () => {
  it('keeps plain <i>/</i> tags as-is', () => {
    expect(sanitizeItalicHtml('Hello <i>World</i>!')).toBe('Hello <i>World</i>!')
  })

  it('normalizes case to lowercase', () => {
    expect(sanitizeItalicHtml('<I>Hello</I>')).toBe('<i>Hello</i>')
  })

  it('strips any other tag, escaping it to plain text', () => {
    expect(sanitizeItalicHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('strips attributes smuggled onto an i tag (e.g. onmouseover)', () => {
    // <i onmouseover=...> isn't a bare `<i>` token, so it's treated as an
    // ordinary disallowed tag and escaped, not passed through.
    expect(sanitizeItalicHtml('<i onmouseover="evil()">x</i>')).toBe('&lt;i onmouseover="evil()"&gt;x</i>')
  })

  it('escapes stray &, <, > in plain text', () => {
    expect(sanitizeItalicHtml('Smith & Jones < 5 > 3')).toBe('Smith &amp; Jones &lt; 5 &gt; 3')
  })

  it('leaves embedded newlines untouched', () => {
    expect(sanitizeItalicHtml('line one\n<i>line two</i>')).toBe('line one\n<i>line two</i>')
  })
})

describe('plainTextToEditableHtml', () => {
  it('escapes HTML-significant characters so plain text never looks like markup', () => {
    expect(plainTextToEditableHtml('Tom & Jerry <3')).toBe('Tom &amp; Jerry &lt;3')
  })
})

describe('processEditedHtml: round-trips a contentEditable div\'s innerHTML', () => {
  it('returns the plain text and no rich override when there are no italics', () => {
    const result = processEditedHtml('Hello World')
    expect(result.plainText).toBe('Hello World')
    expect(result.richHtml).toBeUndefined()
  })

  it('returns a rich override when italics are present, plain text with tags stripped', () => {
    const result = processEditedHtml('Hello <i>World</i>')
    expect(result.plainText).toBe('Hello World')
    expect(result.richHtml).toBe('Hello <i>World</i>')
  })

  it('converts <div>-wrapped lines (Chrome\'s contentEditable Enter behavior) into plain newlines', () => {
    const result = processEditedHtml('<div>line one</div><div>line <i>two</i></div>')
    expect(result.plainText).toBe('line one\nline two')
    expect(result.richHtml).toBe('line one\nline <i>two</i>')
  })

  it('converts <br> line breaks into plain newlines', () => {
    const result = processEditedHtml('line one<br>line <i>two</i>')
    expect(result.plainText).toBe('line one\nline two')
    expect(result.richHtml).toBe('line one\nline <i>two</i>')
  })

  it('strips any injected tag/attribute down to plain escaped text, even amid real italics', () => {
    const result = processEditedHtml('<i>safe</i><img src=x onerror=alert(1)>')
    expect(result.richHtml).toBe('<i>safe</i>&lt;img src=x onerror=alert(1)&gt;')
    expect(result.plainText).toBe('safe<img src=x onerror=alert(1)>')
  })

  it('round-trips an ampersand correctly through sanitize + unescape', () => {
    const result = processEditedHtml('Smith & Jones')
    expect(result.plainText).toBe('Smith & Jones')
    expect(result.richHtml).toBeUndefined()
  })
})
