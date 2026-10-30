import { describe, expect, it } from 'vitest'
import { parseCombination } from './checkerLink'

describe('checker combination deep link', () => {
  it('preserves only a complete valid main combination', () => {
    expect(parseCombination('45,1,20,3,9,6', 1, 45, 6)).toEqual([1, 3, 6, 9, 20, 45])
    for (const value of [
      null,
      '',
      '1,2,3',
      '1,2,3,4,5,5',
      '1,2,3,4,5,46',
      '1,2,3,4,5,6.1',
      '1,2,3,4,5,true',
      '1,2,3,4,5,6,7',
    ])
      expect(parseCombination(value, 1, 45, 6)).toEqual([])
    expect(parseCombination('1,2,3,4,5,55', 1, 55, 6)).toEqual([1, 2, 3, 4, 5, 55])
  })
})
