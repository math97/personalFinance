import { IsArray, IsString, IsOptional } from 'class-validator'

export class BulkCategorizeDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[]

  @IsOptional()
  @IsString()
  categoryId: string | null
}
