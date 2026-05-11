import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AppGateway } from './app.gateway'
import { RealtimeEventHandler } from './realtime-event.handler'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AppGateway, RealtimeEventHandler],
  exports: [AppGateway],
})
export class GatewayModule {}
