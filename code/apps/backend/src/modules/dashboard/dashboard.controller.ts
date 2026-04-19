import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  getSummary(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date()
    return this.service.getSummary(
      Number(year ?? now.getFullYear()),
      Number(month ?? now.getMonth() + 1),
    )
  }
}
