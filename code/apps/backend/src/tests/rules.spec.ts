import { applyRules } from '../lib/rules'

describe('applyRules', () => {
  const rules = [
    { categoryId: 'cat-groceries', keyword: 'tesco' },
    { categoryId: 'cat-transport', keyword: 'uber' },
    { categoryId: 'cat-subs',      keyword: 'netflix' },
  ]

  it('returns null when rules list is empty', () => {
    expect(applyRules('TESCO METRO', [])).toBeNull()
  })

  it('returns null when no rule matches', () => {
    expect(applyRules('AMAZON PRIME', rules)).toBeNull()
  })

  it('matches keyword at the start of description', () => {
    expect(applyRules('TESCO METRO LONDON', rules)).toBe('cat-groceries')
  })

  it('matches keyword in the middle of description', () => {
    expect(applyRules('PAYMENT TO TESCO STORES', rules)).toBe('cat-groceries')
  })

  it('is case-insensitive (upper description, lower keyword)', () => {
    expect(applyRules('NETFLIX MONTHLY', rules)).toBe('cat-subs')
  })

  it('is case-insensitive (mixed description, upper keyword)', () => {
    const upperRules = [{ categoryId: 'cat-transport', keyword: 'UBER' }]
    expect(applyRules('Uber trip London', upperRules)).toBe('cat-transport')
  })

  it('returns first matching rule when multiple rules match', () => {
    const overlapping = [
      { categoryId: 'first',  keyword: 'uber' },
      { categoryId: 'second', keyword: 'uber' },
    ]
    expect(applyRules('UBER EATS', overlapping)).toBe('first')
  })

  it('matches correctly with single-character keyword', () => {
    const singleChar = [{ categoryId: 'cat-x', keyword: 'x' }]
    expect(applyRules('XYZ Corp', singleChar)).toBe('cat-x')
  })
})
