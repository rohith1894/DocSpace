import { describe, expect, it } from 'vitest'
import { fromBase64, toBase64 } from '../base64'

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array(256).map((_, i) => i)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('handles buffers larger than the argument limit of String.fromCharCode', () => {
    const bytes = new Uint8Array(300_000).map((_, i) => (i * 31) % 256)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('handles empty input', () => {
    expect(fromBase64(toBase64(new Uint8Array()))).toEqual(new Uint8Array())
  })
})
