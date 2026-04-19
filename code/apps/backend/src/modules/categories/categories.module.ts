import { Module } from '@nestjs/common'
import { CategoriesController } from './categories.controller'
import { CategoriesService } from './categories.service'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'

@Module({
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    { provide: CategoryRepository, useClass: PrismaCategoryRepository },
  ],
  exports: [CategoriesService, CategoryRepository],
})
export class CategoriesModule {}
