import { BadRequestException } from '@nestjs/common'
import { CsvParser } from '../lib/csv-parser'

describe('CsvParser', () => {
  let parser: CsvParser

  beforeEach(() => {
    parser = new CsvParser()
  })

  function buf(text: string) {
    return Buffer.from(text, 'utf-8')
  }

  it('parses a valid CSV with ISO dates', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n2024-04-03,Salary,2500.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2024-04-01', description: 'Netflix', amount: -17.99 })
    expect(result[1]).toEqual({ date: '2024-04-03', description: 'Salary', amount: 2500.00 })
  })

  it('parses DD/MM/YYYY dates and normalises to YYYY-MM-DD', () => {
    const csv = `date,description,amount\n01/04/2024,Netflix,-17.99`
    const result = parser.parse(buf(csv))
    expect(result[0].date).toBe('2024-04-01')
  })

  it('is case-insensitive on the header', () => {
    const csv = `Date,Description,Amount\n2024-04-01,Netflix,-17.99`
    expect(() => parser.parse(buf(csv))).not.toThrow()
  })

  it('throws BadRequestException when header is wrong', () => {
    const csv = `datum,beschreibung,betrag\n2024-04-01,Netflix,-17.99`
    expect(() => parser.parse(buf(csv))).toThrow(BadRequestException)
  })

  it('throws BadRequestException when file is empty', () => {
    expect(() => parser.parse(buf(''))).toThrow(BadRequestException)
  })

  it('throws BadRequestException when there are no data rows', () => {
    const csv = `date,description,amount`
    expect(() => parser.parse(buf(csv))).toThrow(BadRequestException)
  })

  it('skips rows with non-numeric amount and returns the rest', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n2024-04-02,Bad,notanumber`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Netflix')
  })

  it('skips rows with unparseable date and returns the rest', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\nnot-a-date,Bad,-5.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Netflix')
  })

  it('preserves negative and positive amounts', () => {
    const csv = `date,description,amount\n2024-04-01,Expense,-50.00\n2024-04-02,Income,1000.00`
    const result = parser.parse(buf(csv))
    expect(result[0].amount).toBe(-50.00)
    expect(result[1].amount).toBe(1000.00)
  })

  it('skips blank lines silently', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n\n2024-04-03,Salary,2500.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(2)
  })
})
