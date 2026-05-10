import {
  IsString, IsNotEmpty, IsNumber, IsArray,
  ValidateNested, IsInt, ValidateIf,
} from 'class-validator'
import { Type } from 'class-transformer'

class InsightsMonthDto {
  @IsString()
  label: string

  @IsNumber()
  total: number
}

class InsightsCategoryContextDto {
  @IsString()
  name: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InsightsMonthDto)
  months: InsightsMonthDto[]

  @IsNumber()
  @ValidateIf((_, v) => v !== null)
  monthlyBudget: number | null

  @IsNumber()
  @ValidateIf((_, v) => v !== null)
  delta: number | null
}

class InsightsContextDto {
  @IsInt()
  year: number

  @IsInt()
  month: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InsightsCategoryContextDto)
  categories: InsightsCategoryContextDto[]
}

export class InsightsChatDto {
  @IsString()
  @IsNotEmpty()
  message: string

  @ValidateNested()
  @Type(() => InsightsContextDto)
  context: InsightsContextDto
}
