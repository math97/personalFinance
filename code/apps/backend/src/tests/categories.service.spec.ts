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

  // ── helpers ──────────────────────────────────────────────────────
  const mkCat = (name = 'Groceries', color = '#34d399') => service.create({ name, color })

  // ── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('saves and returns a new category with a generated id', async () => {
      const result = await mkCat()
      expect(result.name).toBe('Groceries')
      expect(result.color).toBe('#34d399')
      expect(result.id).toBeTruthy()
      expect(repo.store.size).toBe(1)
    })

    it('multiple categories each get unique ids', async () => {
      const a = await mkCat('A', '#111111')
      const b = await mkCat('B', '#222222')
      expect(a.id).not.toBe(b.id)
    })
  })

  // ── findAll ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns all categories sorted alphabetically', async () => {
      await mkCat('Rent', '#aaaaaa')
      await mkCat('Groceries', '#bbbbbb')
      await mkCat('Transport', '#cccccc')
      const all = await service.findAll()
      const names = all.map(c => c.name)
      expect(names).toEqual([...names].sort())
    })

    it('returns empty array when no categories exist', async () => {
      const all = await service.findAll()
      expect(all).toHaveLength(0)
    })
  })

  // ── findOne ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('throws NotFoundException when category not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('returns category when found', async () => {
      const created = await mkCat('Rent', '#818cf8')
      const found = await service.findOne(created.id)
      expect(found.name).toBe('Rent')
    })
  })

  // ── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('updates the name of an existing category', async () => {
      const cat = await mkCat('Old Name')
      const updated = await service.update(cat.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
    })

    it('updates the color of an existing category', async () => {
      const cat = await mkCat()
      const updated = await service.update(cat.id, { color: '#ff0000' })
      expect(updated.color).toBe('#ff0000')
    })

    it('throws NotFoundException when updating nonexistent category', async () => {
      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundException)
    })

    it('sets monthlyBudget on a category', async () => {
      const cat = await mkCat()
      const updated = await service.update(cat.id, { monthlyBudget: 500 })
      expect(updated.monthlyBudget).toBe(500)
    })

    it('clears monthlyBudget when set to null', async () => {
      const cat = await mkCat()
      await service.update(cat.id, { monthlyBudget: 500 })
      const cleared = await service.update(cat.id, { monthlyBudget: null })
      expect(cleared.monthlyBudget).toBeNull()
    })
  })

  // ── remove ───────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes a category', async () => {
      const cat = await mkCat()
      await service.remove(cat.id)
      expect(repo.store.size).toBe(0)
    })

    it('throws NotFoundException when removing nonexistent category', async () => {
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  // ── addRule ──────────────────────────────────────────────────────
  describe('addRule', () => {
    it('adds a keyword rule to an existing category', async () => {
      const cat = await mkCat()
      const rule = await service.addRule(cat.id, { keyword: 'tesco' })
      expect(rule.keyword).toBe('tesco')
      expect(rule.categoryId).toBe(cat.id)
    })

    it('adds multiple rules to the same category', async () => {
      const cat = await mkCat()
      await service.addRule(cat.id, { keyword: 'tesco' })
      await service.addRule(cat.id, { keyword: 'sainsburys' })
      const found = await service.findOne(cat.id)
      expect(found.rules).toHaveLength(2)
    })

    it('throws NotFoundException when category not found', async () => {
      await expect(service.addRule('nonexistent', { keyword: 'tesco' })).rejects.toThrow(NotFoundException)
    })
  })

  // ── removeRule ───────────────────────────────────────────────────
  describe('removeRule', () => {
    it('removes a keyword rule', async () => {
      const cat = await mkCat()
      const rule = await service.addRule(cat.id, { keyword: 'tesco' })
      await service.removeRule(rule.id)
      const found = await service.findOne(cat.id)
      expect(found.rules).toHaveLength(0)
    })

    it('removing a nonexistent rule does not throw', async () => {
      await expect(service.removeRule('nonexistent-rule')).resolves.not.toThrow()
    })
  })

  // ── budget ───────────────────────────────────────────────────────
  describe('update — monthlyBudget', () => {
    it('sets a monthly budget on a category', async () => {
      const cat = await mkCat()
      const updated = await service.update(cat.id, { monthlyBudget: 300 })
      expect(updated.monthlyBudget).toBe(300)
    })

    it('clears the monthly budget when set to null', async () => {
      const cat = await mkCat()
      await service.update(cat.id, { monthlyBudget: 300 })
      const cleared = await service.update(cat.id, { monthlyBudget: null })
      expect(cleared.monthlyBudget).toBeNull()
    })

    it('does not affect other fields when only updating budget', async () => {
      const cat = await mkCat('Rent', '#818cf8')
      await service.update(cat.id, { monthlyBudget: 1000 })
      const found = await service.findOne(cat.id)
      expect(found.name).toBe('Rent')
      expect(found.color).toBe('#818cf8')
      expect(found.monthlyBudget).toBe(1000)
    })

    it('throws NotFoundException when setting budget on nonexistent category', async () => {
      await expect(service.update('nonexistent', { monthlyBudget: 100 })).rejects.toThrow(NotFoundException)
    })
  })
})
