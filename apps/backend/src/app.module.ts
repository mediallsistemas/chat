import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { BullModule } from '@nestjs/bull'
import { JwtModule } from '@nestjs/jwt'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { UnitsModule } from './units/units.module'
import { StrategicModule } from './strategic/strategic.module'
import { KanbanModule } from './kanban/kanban.module'
import { ImpedimentsModule } from './impediments/impediments.module'
import { NotificationsModule } from './notifications/notifications.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ChatModule } from './chat/chat.module'
import { FilesModule } from './files/files.module'
import { PushModule } from './push/push.module'
import { MeetingsModule } from './meetings/meetings.module'
import { ReportsModule } from './reports/reports.module'
import { AuditModule } from './audit/audit.module'
import { TranscriptionModule } from './transcription/transcription.module'
import { DocumentsModule } from './documents/documents.module'
import { TicketsModule } from './tickets/tickets.module'
import { HealthModule } from './health/health.module'
import { ConsentsModule } from './consents/consents.module'
import { PrismaModule } from './prisma/prisma.module'
import { GatewayModule } from './gateway/gateway.module'
import { MailModule } from './mail/mail.module'
import { ImpedimentEscalationJob } from './jobs/impediment-escalation.job'
import { GroupArchiveJob } from './jobs/group-archive.job'
import { MeetingReminderJob } from './jobs/meeting-reminder.job'
import { ExecutiveReportJob } from './jobs/executive-report.job'
import { TaskCheckinJob } from './jobs/task-checkin.job'
import { DataRetentionJob } from './jobs/data-retention.job'
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard'
import { RolesGuard } from './shared/guards/roles.guard'
import { UnitScopeGuard } from './shared/guards/unit-scope.guard'
import { TransformInterceptor } from './shared/interceptors/transform.interceptor'
import { AuditLogInterceptor } from './shared/interceptors/audit-log.interceptor'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    PrismaModule,
    GatewayModule,
    MailModule,
    AuthModule,
    UsersModule,
    UnitsModule,
    StrategicModule,
    KanbanModule,
    ImpedimentsModule,
    NotificationsModule,
    DashboardModule,
    ChatModule,
    FilesModule,
    PushModule,
    MeetingsModule,
    ReportsModule,
    AuditModule,
    TranscriptionModule,
    DocumentsModule,
    TicketsModule,
    HealthModule,
    ConsentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UnitScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    ImpedimentEscalationJob,
    GroupArchiveJob,
    MeetingReminderJob,
    ExecutiveReportJob,
    TaskCheckinJob,
    DataRetentionJob,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
