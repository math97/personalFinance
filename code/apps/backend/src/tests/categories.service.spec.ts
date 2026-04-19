import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CategoriesService } from '../modules/categories/categories.service'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'

describe('CategoriesService', () => {
  let service: CategoriesService
  let repo: InMemoryCategoryRepository

  beforeEach(async () => {
    repo = new InMemoryCategoryRepository()
    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoryRepository, useValue: repo },
      ],
    }).compile()
    service = module.get(CategoriesService)
  })

  describe('create', () => {
    it('saves and returns a new category', async () => {
      const result = await service.create({ name: 'Groceries', color: '#34d399' })
      expect(result.name).toBe('Groceries')
      expect(result.color).toBe('#34d399')
      expect(repo.store.size).toBe(1)
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException when category not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('returns category when found', async () => {
      const created = await service.create({ name: 'Rent', color: '#818cf8' })
      const found = await service.findOne(created.id)
      expect(found.name).toBe('Rent')
    })
  })

  describe('addRule', () => {
    it('adds a keyword rule to an existing category', async () => {
      const cat = await service.create({ name: 'Groceries', color: '#34d399' })
      const rule = await service.addRule(cat.id, { keyword: 'tesco' })
      expect(rule.keyword).toBe('tesco')
      expect(rule.categoryId).toBe(cat.id)
    })

    it('throws NotFoundException when category not found', async () => {
      await expect(service.addRule('nonexistent', { keyword: 'tesco' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('deletes a category', async () => {
      const cat = await service.create({ name: 'Temp', color: '#000000' })
      await service.remove(cat.id)
      expect(repo.store.size).toBe(0)
    })
  })
})
