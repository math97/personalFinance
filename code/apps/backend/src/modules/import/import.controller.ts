import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImportService } from './import.service'
import { UpdateImportedTransactionDto, SaveRuleDto } from './dto/import.dto'

@Controller('import')
export class ImportController {
  constructor(private readonly service: ImportService) {}

  @Get('batches')
  findAllBatches() {
    return this.service.findAllBatches()
  }

  @Get('batches/:id')
  findBatch(@Param('id') id: string) {
    return this.service.findBatch(id)
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadAndExtract(file)
  }

  @Patch('transactions/:id')
  updateTransaction(@Param('id') id: string, @Body() dto: UpdateImportedTransactionDto) {
    return this.service.updateImportedTransaction(id, dto)
  }

  @Post('batches/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirmBatch(id)
  }

  @Delete('batches/:id')
  discard(@Param('id') id: string) {
    return this.service.discardBatch(id)
  }

  @Delete('transactions/:id')
  deleteImportedTransaction(@Param('id') id: string) {
    return this.service.deleteImportedTransaction(id)
  }

  @Post('transactions/:id/save-rule')
  saveRule(@Param('id') id: string, @Body() dto: SaveRuleDto) {
    return this.service.saveRule(id, dto)
  }
}
