import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { FilesModule } from '../files/files.module'
import { TasksController } from './tasks/tasks.controller'
import { TasksService } from './tasks/tasks.service'
import { TaskFilesController } from './task-files/task-files.controller'
import { TaskFilesService } from './task-files/task-files.service'

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [TasksController, TaskFilesController],
  providers: [TasksService, TaskFilesService],
  exports: [TasksService],
})
export class KanbanModule {}
