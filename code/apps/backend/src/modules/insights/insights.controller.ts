import { Controller, Get, Post, Query, Body } from '@nestjs/common'
import { InsightsService } from './insights.service'
import { InsightsQueryDto } from './dto/insights-query.dto'
import { InsightsChatDto } from './dto/insights-chat.dto'

@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('categories')
  getCategoryTrends(@Query() query: InsightsQueryDto) {
    const now = new Date()
    return this.service.getCategoryTrends(
      query.year  ? Number(query.year)  : now.getFullYear(),
      query.month ? Number(query.month) : now.getMonth() + 1,
    )
  }

  @Post('chat')
  chat(@Body() dto: InsightsChatDto) {
    return this.service.chat(dto.message, dto.context)
  }
}
