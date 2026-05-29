import { Global, Module } from '@nestjs/common'
import { RedisStreamsPublisher } from './redis-streams.service'
import { RedisStreamsConsumer } from './redis-streams-consumer.service'

@Global()
@Module({
  providers: [RedisStreamsPublisher, RedisStreamsConsumer],
  exports: [RedisStreamsPublisher, RedisStreamsConsumer],
})
export class StreamsModule {}
