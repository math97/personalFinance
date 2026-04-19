import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto, AddRuleDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Post(':id/rules')
  addRule(@Param('id') id: string, @Body() dto: AddRuleDto) {
    return this.service.addRule(id, dto)
  }

  @Delete('rules/:ruleId')
  removeRule(@Param('ruleId') ruleId: string) {
    return this.service.removeRule(ruleId)
  }
}
