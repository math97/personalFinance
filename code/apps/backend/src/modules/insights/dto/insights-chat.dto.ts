import { IsString, IsNotEmpty, IsObject } from 'class-validator'

export class InsightsChatDto {
  @IsString()
  @IsNotEmpty()
  message: string

  @IsObject()
  context: {
    year: number
    month: number
    categories: Array<{
      name: string
      months: { label: string; total: number }[]
      monthlyBudget: number | null
      delta: number | null
    }>
  }
}
