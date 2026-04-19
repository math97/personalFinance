import { ImportBatchEntity } from '../domain/entities/import-batch.entity'

describe('ImportBatchEntity', () => {
  function makeBatch(status: 'processing' | 'reviewing' | 'confirmed' | 'discarded', filename = 'statement.pdf') {
    return new ImportBatchEntity('batch-1', filename, new Date(), status, [], 0)
  }

  describe('isReviewing()', () => {
    it('returns true when status is reviewing', () => {
      expect(makeBatch('reviewing').isReviewing()).toBe(true)
    })

    it('returns false when status is processing', () => {
      expect(makeBatch('processing').isReviewing()).toBe(false)
    })

    it('returns false when status is confirmed', () => {
      expect(makeBatch('confirmed').isReviewing()).toBe(false)
    })

    it('returns false when status is discarded', () => {
      expect(makeBatch('discarded').isReviewing()).toBe(false)
    })
  })

  describe('isPdf()', () => {
    it('returns true for .pdf extension', () => {
      expect(makeBatch('reviewing', 'barclays-april.pdf').isPdf()).toBe(true)
    })

    it('returns true for uppercase .PDF extension', () => {
      expect(makeBatch('reviewing', 'STATEMENT.PDF').isPdf()).toBe(true)
    })

    it('returns false for .jpg extension', () => {
      expect(makeBatch('reviewing', 'receipt.jpg').isPdf()).toBe(false)
    })

    it('returns false for .png extension', () => {
      expect(makeBatch('reviewing', 'photo.png').isPdf()).toBe(false)
    })
  })
})
