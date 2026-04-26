import { IsNumber, IsString, IsOptional, IsDateString, MaxLength } from 'class-validator'

export class UpdateTransactionDto {
  @IsOptional()
  @IsNumber()
  amount?: number

  @IsOptional()
  @IsDateString()
  date?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null
}
