import { Module } from '@nestjs/common'
import { TranscriptionController } from './transcription.controller'
import { TranscriptionService } from './transcription.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
})
export class TranscriptionModule {}
