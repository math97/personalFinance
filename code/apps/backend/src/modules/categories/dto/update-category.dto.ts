import { IsString, IsHexColor, IsOptional, MaxLength, IsNumber, Min, ValidateIf } from 'class-validator'

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsHexColor()
  color?: string

  @IsOptional()
  @ValidateIf(o => o.monthlyBudget !== null)
  @IsNumber()
  @Min(0)
  monthlyBudget?: number | null
}
