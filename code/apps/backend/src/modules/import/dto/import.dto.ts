import { IsOptional, IsString, IsNumber } from 'class-validator'

export class UpdateImportedTransactionDto {
  @IsOptional()
  @IsString()
  rawDate?: string

  @IsOptional()
  @IsString()
  rawDescription?: string

  @IsOptional()
  @IsNumber()
  rawAmount?: number

  @IsOptional()
  @IsString()
  aiCategoryId?: string | null
}

export class SaveRuleDto {
  @IsString()
  keyword: string

  @IsString()
  categoryId: string
}
