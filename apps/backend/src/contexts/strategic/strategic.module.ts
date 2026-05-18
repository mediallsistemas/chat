import { Module } from '@nestjs/common'
import { PlansController } from './plans/plans.controller'
import { PlansService } from './plans/plans.service'
import { ObjectivesController } from './objectives/objectives.controller'
import { ObjectivesService } from './objectives/objectives.service'
import { GoalsController } from './goals/goals.controller'
import { GoalsService } from './goals/goals.service'
import { PhasesController } from './phases/phases.controller'
import { PhasesService } from './phases/phases.service'
import { PhaseNotificationHandler } from './phases/handlers/phase-notification.handler'
import { MacroTasksController } from './macro-tasks/macro-tasks.controller'
import { MacroTasksService } from './macro-tasks/macro-tasks.service'
import { NotificationsModule } from '../../infrastructure/notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [PlansController, ObjectivesController, GoalsController, PhasesController, MacroTasksController],
  providers: [PlansService, ObjectivesService, GoalsService, PhasesService, MacroTasksService, PhaseNotificationHandler],
  exports: [GoalsService],
})
export class StrategicModule {}
