export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
}

export abstract class AIPort {
  abstract extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]>
  abstract suggestCategory(description: string, categoryNames: string[]): Promise<string | null>

  protected parseResponse(text: string): ExtractedTransaction[] {
    if (!text.trim()) return []
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is ExtractedTransaction =>
          typeof item.date === 'string' &&
          typeof item.description === 'string' &&
          typeof item.amount === 'number',
      )
    } catch {
      return []
    }
  }

  protected readonly extractionPrompt = `Extract all transactions from this bank statement or receipt.
Return ONLY a valid JSON array. No other text, no markdown, no explanation.
Format: [{"date":"YYYY-MM-DD","description":"merchant name","amount":-12.50}]
Rules:
- amount is negative for expenses/debits, positive for credits/income
- Use full year in date (if year unclear use ${new Date().getFullYear()})
- Return [] if no transactions found`

  protected readonly categorizationSystem = (categoryNames: string[]) =>
    `You categorize financial transactions. Given a description, return the best matching category name from the list, or "none" if none fits. Return ONLY the category name or "none". No other text.
Categories: ${categoryNames.join(', ')}`
}
