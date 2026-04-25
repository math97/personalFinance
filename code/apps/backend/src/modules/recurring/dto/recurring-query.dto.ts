import { IsOptional, IsNumberString } from 'class-validator'

export class RecurringQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string
}
