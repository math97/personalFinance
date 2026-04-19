import { IsOptional, IsNumberString } from 'class-validator'

export class DashboardQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string
}
