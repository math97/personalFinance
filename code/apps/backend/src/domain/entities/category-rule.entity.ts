export class CategoryRuleEntity {
  constructor(
    public readonly id: string,
    public readonly categoryId: string,
    public readonly keyword: string,
  ) {}
}
