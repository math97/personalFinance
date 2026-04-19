import { Injectable } from '@nestjs/common'
import { applyRules } from '../../lib/rules'
import { AIPort } from '../ports/ai.port'

export interface CategorizationResult {
  categoryId: string | null
  aiCategorized: boolean
}

@Injectable()
export class CategorizationDomainService {
  constructor(private readonly aiPort: AIPort) {}

  async categorize(
    description: string,
    rules: Array<{ categoryId: string; keyword: string }>,
    categories: Array<{ id: string; name: string }>,
  ): Promise<CategorizationResult> {
    const ruleMatch = applyRules(description, rules)
    if (ruleMatch) {
      return { categoryId: ruleMatch, aiCategorized: true }
    }

    const names = categories.map(c => c.name)
    const suggested = await this.aiPort.suggestCategory(description, names)
    const matched = suggested ? categories.find(c => c.name === suggested) ?? null : null

    return { categoryId: matched?.id ?? null, aiCategorized: matched !== null }
  }
}
