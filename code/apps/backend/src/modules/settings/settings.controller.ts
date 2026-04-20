import { Controller, Get, Patch, Post, Body } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto'

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get() {
    return this.service.getSettings()
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto)
  }

  @Post('test')
  test(@Body() dto: TestConnectionDto) {
    return this.service.testConnection(dto)
  }
}
