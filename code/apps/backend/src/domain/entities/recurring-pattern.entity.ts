export class RecurringPatternEntity {
  constructor(
    public readonly id: string,
    public readonly description: string,
    public readonly typicalDay: number,
    public readonly typicalAmount: number,
    public readonly categoryId: string | null,
    public readonly categoryName: string | null,
    public readonly categoryColor: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
