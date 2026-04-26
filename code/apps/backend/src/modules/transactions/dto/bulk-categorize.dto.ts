import { IsArray, IsString, IsOptional, ArrayMaxSize, ValidateIf } from 'class-validator'

export class BulkCategorizeDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[]

  @ValidateIf(o => o.categoryId !== null && o.categoryId !== undefined)
  @IsOptional()
  @IsString()
  categoryId: string | null
}
