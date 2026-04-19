import { CategorizationDomainService, AICategorizationPort } from '../domain/services/categorization.domain-service'

describe('CategorizationDomainService', () => {
  const categories = [
    { id: 'cat-1', name: 'Groceries' },
    { id: 'cat-2', name: 'Transport' },
  ]

  function makeService(aiPort: AICategorizationPort) {
    return new CategorizationDomainService(aiPort)
  }

  describe('rule matching', () => {
    it('returns matched category when keyword found (case-insensitive)', async () => {
      const ai = { suggestCategory: jest.fn() }
      const service = makeService(ai)
      const rules = [{ categoryId: 'cat-1', keyword: 'tesco' }]

      const result = await service.categorize('TESCO METRO LONDON', rules, categories)

      expect(result.categoryId).toBe('cat-1')
      expect(result.aiCategorized).toBe(true)
      expect(ai.suggestCategory).not.toHaveBeenCalled()
    })

    it('returns first rule match when multiple rules match', async () => {
      const ai = { suggestCategory: jest.fn() }
      const service = makeService(ai)
      const rules = [
        { categoryId: 'cat-1', keyword: 'uber' },
        { categoryId: 'cat-2', keyword: 'uber' },
      ]

      const result = await service.categorize('Uber Trip', rules, categories)
      expect(result.categoryId).toBe('cat-1')
    })
  })

  describe('AI fallback', () => {
    it('calls AI when no rule matches and returns matched category', async () => {
      const ai = { suggestCategory: jest.fn().mockResolvedValue('Groceries') }
      const service = makeService(ai)

      const result = await service.categorize('WAITROSE EXPRESS', [], categories)

      expect(ai.suggestCategory).toHaveBeenCalledWith('WAITROSE EXPRESS', ['Groceries', 'Transport'])
      expect(result.categoryId).toBe('cat-1')
      expect(result.aiCategorized).toBe(true)
    })

    it('returns null categoryId when AI returns "none" or unknown', async () => {
      const ai = { suggestCategory: jest.fn().mockResolvedValue(null) }
      const service = makeService(ai)

      const result = await service.categorize('XYZZY CORP', [], categories)

      expect(result.categoryId).toBeNull()
      expect(result.aiCategorized).toBe(false)
    })
  })
})
