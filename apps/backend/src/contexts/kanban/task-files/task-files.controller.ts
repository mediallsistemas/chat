import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { TaskFilesService } from './task-files.service'
import { AttachFileDto } from './dto/attach-file.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@Controller('units/:unitId/tasks/:taskId/files')
export class TaskFilesController extends BaseUnitController {
  constructor(private taskFilesService: TaskFilesService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('taskId') taskId: string) {
    return this.taskFilesService.findAll(unitId, taskId)
  }

  @Post()
  attach(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AttachFileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.taskFilesService.attach(unitId, taskId, dto, user.sub)
  }

  @Delete(':fileId')
  remove(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.taskFilesService.remove(unitId, taskId, fileId, user.sub)
  }
}
