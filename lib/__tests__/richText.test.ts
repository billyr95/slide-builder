import { describe, it, expect } from 'vitest'
import { sanitizeFormattingHtml, fieldHtmlForEditing, processFieldHtml } from '@/lib/richText'

describe('sanitizeFormattingHtml: allowlists only em/i/strong/b/br', () => {
  it('keeps allowed tags as-is', () => {
    expect(sanitizeFormattingHtml('Hello <i>World</i> and <strong>Bold</strong>!', true))
      .toEqual({ html: 'Hello <i>World</i> and <strong>Bold</strong>!', stripped: false })
    expect(sanitizeFormattingHtml('<em>a</em><b>c</b><br>', true))
      .toEqual({ html: '<em>a</em><b>c</b><br>', stripped: false })
  })

  it('normalizes case to lowercase', () => {
    expect(sanitizeFormattingHtml('<I>Hello</I><STRONG>x</STRONG>', true))
      .toEqual({ html: '<i>Hello</i><strong>x</strong>', stripped: false })
  })

  it('drops disallowed tags entirely (keeping their inner content as plain text), and reports stripped', () => {
    expect(sanitizeFormattingHtml('<script>alert(1)</script>', true))
      .toEqual({ html: 'alert(1)', stripped: true })
  })

  it('strips attributes smuggled onto an allowed tag (e.g. onmouseover)', () => {
    const result = sanitizeFormattingHtml('<i onmouseover="evil()">x</i>', true)
    expect(result.html).toBe('&lt;i onmouseover="evil()"&gt;x</i>')
    expect(result.stripped).toBe(true)
  })

  it('strips strong/b (but keeps em/i) when allowBold is false, and reports stripped', () => {
    const result = sanitizeFormattingHtml('<em>keep</em> <strong>drop</strong>', false)
    expect(result.html).toBe('<em>keep</em> drop')
    expect(result.stripped).toBe(true)
  })

  it('escapes stray &, <, > in plain text', () => {
    expect(sanitizeFormattingHtml('Smith & Jones < 5 > 3', true))
      .toEqual({ html: 'Smith &amp; Jones &lt; 5 &gt; 3', stripped: false })
  })

  it('leaves embedded newlines untouched', () => {
    expect(sanitizeFormattingHtml('line one\n<i>line two</i>', true))
      .toEqual({ html: 'line one\n<i>line two</i>', stripped: false })
  })
})

describe('fieldHtmlForEditing', () => {
  it('escapes plain text when there is no existing rich override', () => {
    expect(fieldHtmlForEditing('Tom & Jerry <3', undefined)).toBe('Tom &amp; Jerry &lt;3')
  })

  it('uses the existing rich override verbatim when present', () => {
    expect(fieldHtmlForEditing('Tom and Jerry', 'Tom and <i>Jerry</i>')).toBe('Tom and <i>Jerry</i>')
  })
})

describe('processFieldHtml: the Edit HTML modal\'s Save path', () => {
  it('returns the plain text and no rich override when there is no formatting', () => {
    const result = processFieldHtml('Hello World', true)
    expect(result.plainText).toBe('Hello World')
    expect(result.richHtml).toBeUndefined()
    expect(result.stripped).toBe(false)
  })

  it('returns a rich override when formatting is present, plain text with tags stripped', () => {
    const result = processFieldHtml('Hello <i>World</i> and <strong>Jane</strong>', true)
    expect(result.plainText).toBe('Hello World and Jane')
    expect(result.richHtml).toBe('Hello <i>World</i> and <strong>Jane</strong>')
    expect(result.stripped).toBe(false)
  })

  it('converts <br> tags into plain newlines', () => {
    const result = processFieldHtml('line one<br>line <i>two</i>', true)
    expect(result.plainText).toBe('line one\nline two')
    expect(result.richHtml).toBe('line one<br>line <i>two</i>')
  })

  it('keeps literal newlines as newlines (Presenters\' one-per-line behavior)', () => {
    const result = processFieldHtml('Name One\nName Two', true)
    expect(result.plainText).toBe('Name One\nName Two')
    expect(result.richHtml).toBeUndefined()
  })

  it('strips bold when allowBold is false and reports it', () => {
    const result = processFieldHtml('<strong>Bold</strong> text', false)
    expect(result.plainText).toBe('Bold text')
    expect(result.richHtml).toBeUndefined()
    expect(result.stripped).toBe(true)
  })

  it('strips any injected tag/attribute down to plain escaped text, even amid real formatting', () => {
    const result = processFieldHtml('<i>safe</i><img src=x onerror=alert(1)>', true)
    expect(result.richHtml).toBe('<i>safe</i>&lt;img src=x onerror=alert(1)&gt;')
    expect(result.plainText).toBe('safe<img src=x onerror=alert(1)>')
    expect(result.stripped).toBe(true)
  })

  it('round-trips an ampersand correctly through sanitize + unescape', () => {
    const result = processFieldHtml('Smith & Jones', true)
    expect(result.plainText).toBe('Smith & Jones')
    expect(result.richHtml).toBeUndefined()
  })
})
