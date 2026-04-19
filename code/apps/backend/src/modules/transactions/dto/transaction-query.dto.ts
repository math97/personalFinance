import { IsOptional, IsNumberString, IsString } from 'class-validator'

export class TransactionQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string

  @IsOptional()
  @IsString()
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
}
