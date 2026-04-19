import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { DashboardQueryDto } from './dto/dashboard-query.dto'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  getSummary(@Query() query: DashboardQueryDto) {
    const now = new Date()
    return this.service.getSummary(
      query.year  ? Number(query.year)  : now.getFullYear(),
      query.month ? Number(query.month) : now.getMonth() + 1,
    )
  }
}
