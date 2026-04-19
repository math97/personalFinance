export interface Rule {
  categoryId: string
  keyword: string
}

export function applyRules(description: string, rules: Rule[]): string | null {
  const lower = description.toLowerCase()
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId
    }
  }
  return null
}
