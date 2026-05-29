import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UsersReadService } from './users-read.service'
import { USERS_READ_PORT } from '../shared/ports'

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersReadService,
    { provide: USERS_READ_PORT, useExisting: UsersReadService },
  ],
  exports: [UsersService, USERS_READ_PORT],
})
export class UsersModule {}
