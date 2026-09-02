import { IsOptional, IsNumberString } from 'class-validator'

export class InsightsQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string
}
