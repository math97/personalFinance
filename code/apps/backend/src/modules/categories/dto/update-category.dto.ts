import { IsString, IsHexColor, IsOptional, MaxLength } from 'class-validator'

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsHexColor()
  color?: string
}
