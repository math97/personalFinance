import { Injectable, NotFoundException } from '@nestjs/common'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { CategoryEntity } from '../../domain/entities/category.entity'
import { CreateCategoryDto, AddRuleDto } from './dto/create-category.dto'

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoryRepository) {}

  findAll() {
    return this.repo.findAll()
  }

  async findOne(id: string) {
    const cat = await this.repo.findById(id)
    if (!cat) throw new NotFoundException(`Category ${id} not found`)
    return cat
  }

  create(dto: CreateCategoryDto) {
    const entity = new CategoryEntity('', dto.name, dto.color, [], 0)
    return this.repo.save(entity)
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    await this.findOne(id)
    return this.repo.update(id, dto)
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.repo.delete(id)
  }

  async addRule(categoryId: string, dto: AddRuleDto) {
    await this.findOne(categoryId)
    return this.repo.addRule(categoryId, dto.keyword)
  }

  async removeRule(ruleId: string) {
    return this.repo.deleteRule(ruleId)
  }
}
