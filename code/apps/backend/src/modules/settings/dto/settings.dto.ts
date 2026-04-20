import { IsString, IsIn, IsOptional } from 'class-validator'

const PROVIDERS = ['anthropic', 'openrouter'] as const

export class UpdateSettingsDto {
  @IsIn(PROVIDERS)
  aiProvider: string

  @IsOptional()
  @IsString()
  aiApiKey?: string

  @IsString()
  aiModel: string
}

export class TestConnectionDto {
  @IsIn(PROVIDERS)
  aiProvider: string

  @IsString()
  aiApiKey: string

  @IsString()
  aiModel: string
}
