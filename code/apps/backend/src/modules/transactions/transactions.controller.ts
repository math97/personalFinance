import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { TransactionsService } from './transactions.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'
import { TransactionQueryDto } from './dto/transaction-query.dto'

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.service.create(dto)
  }

  @Get('export')
  async export(@Query() query: TransactionQueryDto, @Res() res: Response) {
    const scope = (query.scope === 'month' ? 'month' : 'filtered') as 'filtered' | 'month'
    const csv   = await this.service.exportCsv(query, scope)

    const label = query.year && query.month
      ? `${query.year}-${String(query.month).padStart(2, '0')}`
      : 'all'

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${label}.csv`)
    res.send(csv)
  }

  @Get()
  findAll(@Query() query: TransactionQueryDto) {
    return this.service.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
