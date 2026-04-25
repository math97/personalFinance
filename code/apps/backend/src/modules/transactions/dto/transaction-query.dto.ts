import { IsOptional, IsNumberString, IsString, MaxLength } from 'class-validator'

export class TransactionQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsNumberString()
  page?: string

  @IsOptional()
  @IsNumberString()
  perPage?: string

  @IsOptional()
  @IsString()
  scope?: string
}
