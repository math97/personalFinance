import { IsString, IsHexColor } from 'class-validator'

export class CreateCategoryDto {
  @IsString()
  name: string

  @IsHexColor()
  color: string
}

export class AddRuleDto {
  @IsString()
  keyword: string
}
