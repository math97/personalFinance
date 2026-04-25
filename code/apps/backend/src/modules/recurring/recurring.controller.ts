import { Controller, Get, Delete, Query, Param } from '@nestjs/common'
import { RecurringService } from './recurring.service'
import { RecurringQueryDto } from './dto/recurring-query.dto'

@Controller('recurring')
export class RecurringController {
  constructor(private readonly service: RecurringService) {}

  @Get('upcoming')
  getUpcoming(@Query() query: RecurringQueryDto) {
    const now = new Date()
    return this.service.getUpcoming(
      query.year  ? Number(query.year)  : now.getFullYear(),
      query.month ? Number(query.month) : now.getMonth() + 1,
    )
  }

  @Delete('patterns/:id')
  dismissPattern(@Param('id') id: string) {
    return this.service.dismissPattern(id)
  }
}
