import { IsNumber, IsString, IsOptional, IsDateString, IsIn } from 'class-validator'
import { TransactionSource } from '../../../domain/entities/transaction.entity'

const SOURCES: TransactionSource[] = ['manual', 'pdf', 'photo']

export class CreateTransactionDto {
  @IsNumber()
  amount: number

  @IsDateString()
  date: string

  @IsString()
  description: string

  @IsOptional()
  @IsString()
  merchant?: string

  @IsOptional()
  @IsString()
  account?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsIn(SOURCES)
  source?: TransactionSource
}
