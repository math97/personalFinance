export interface AppSettingsRow {
  aiProvider: string
  aiModel:    string | null
  aiApiKey:   string | null
}

export abstract class SettingsRepository {
  abstract findSettings(): Promise<AppSettingsRow | null>
  abstract upsertSettings(data: AppSettingsRow): Promise<void>
}
