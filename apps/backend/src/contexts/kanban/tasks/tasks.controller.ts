import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TasksService } from './tasks.service'
import { CreateTaskDto } from './dto/create-task.dto'
import { MoveTaskDto } from './dto/move-task.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('kanban')
@Controller('units/:unitId')
export class TasksController extends BaseUnitController {
  constructor(private tasksService: TasksService) {
    super()
  }

  @Get('kanban/:boardId')
  findByBoard(@Param('unitId') unitId: string, @Param('boardId') boardId: string) {
    return this.tasksService.findByBoard(unitId, boardId)
  }

  @Get('tasks/search')
  searchTasks(@Param('unitId') unitId: string, @Query('q') q: string) {
    return this.tasksService.search(unitId, q)
  }

  @Post('tasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.create(unitId, dto, user)
  }

  @Patch('tasks/:taskId/move')
  move(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.move(unitId, taskId, dto, user)
  }

  @Patch('tasks/:taskId/accept')
  accept(@Param('unitId') unitId: string, @Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.accept(unitId, taskId, user)
  }

  @Patch('tasks/:taskId/decline')
  decline(@Param('unitId') unitId: string, @Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.decline(unitId, taskId, user)
  }

  @Get('tasks/:taskId')
  findOne(@Param('unitId') unitId: string, @Param('taskId') taskId: string) {
    return this.tasksService.findOne(unitId, taskId)
  }

  @Post('tasks/:taskId/checklists')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  addChecklist(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Body('description') description: string,
  ) {
    return this.tasksService.addChecklistItem(unitId, taskId, description)
  }

  @Patch('tasks/:taskId/checklists/:checklistId/toggle')
  toggleChecklist(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Param('checklistId') checklistId: string,
  ) {
    return this.tasksService.toggleChecklistItem(unitId, taskId, checklistId)
  }

  @Delete('tasks/:taskId/checklists/:checklistId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  deleteChecklist(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Param('checklistId') checklistId: string,
  ) {
    return this.tasksService.deleteChecklistItem(unitId, taskId, checklistId)
  }

  @Post('tasks/:taskId/dependencies')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  addDependency(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Body('dependsOnId') dependsOnId: string,
  ) {
    return this.tasksService.addDependency(unitId, taskId, dependsOnId)
  }

  @Delete('tasks/:taskId/dependencies/:dependsOnId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  removeDependency(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Param('dependsOnId') dependsOnId: string,
  ) {
    return this.tasksService.removeDependency(unitId, taskId, dependsOnId)
  }
}
