import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  transports: ['websocket', 'polling'],
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(AppGateway.name)

  @WebSocketServer()
  server: Server

  private userSockets = new Map<string, string>() // userId → socketId

  constructor(private jwtService: JwtService) {}

  async afterInit(server: Server) {
    const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    try {
      const pubClient = createClient({ url: redisUrl })
      const subClient = pubClient.duplicate()
      await Promise.all([pubClient.connect(), subClient.connect()])
      server.adapter(createAdapter(pubClient, subClient))
      this.logger.log('Socket.IO Redis adapter configured — horizontal scaling enabled')
    } catch (err) {
      this.logger.error('Failed to connect Redis adapter — using in-memory adapter (single instance only)', (err as Error).message)
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.cookie?.match(/auth_token=([^;]+)/)?.[1]

      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwtService.verify(token)
      client.data.userId = payload.sub
      client.data.units = payload.units

      this.userSockets.set(payload.sub, client.id)

      // Auto-join unit rooms
      for (const unitId of payload.units) {
        client.join(`unit:${unitId}`)
        // Broadcast presence to unit
        client.to(`unit:${unitId}`).emit('user:online', { userId: payload.sub })
      }
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      const userId = client.data.userId
      this.userSockets.delete(userId)
      const units: string[] = client.data.units ?? []
      for (const unitId of units) {
        this.server.to(`unit:${unitId}`).emit('user:offline', { userId })
      }
    }
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys())
  }

  @SubscribeMessage('join:group')
  handleJoinGroup(@ConnectedSocket() client: Socket, @MessageBody() groupId: string) {
    client.join(`group:${groupId}`)
  }

  @SubscribeMessage('leave:group')
  handleLeaveGroup(@ConnectedSocket() client: Socket, @MessageBody() groupId: string) {
    client.leave(`group:${groupId}`)
  }

  @SubscribeMessage('message:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; isTyping: boolean },
  ) {
    // Broadcast to everyone in the group except the sender
    client.to(`group:${data.groupId}`).emit('user:typing', {
      userId: client.data.userId,
      groupId: data.groupId,
      isTyping: data.isTyping,
    })
  }

  @SubscribeMessage('message:read')
  handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; messageId: string },
  ) {
    client.to(`group:${data.groupId}`).emit('message:read', {
      userId: client.data.userId,
      ...data,
    })
  }

  @SubscribeMessage('join:meeting')
  handleJoinMeeting(@ConnectedSocket() client: Socket, @MessageBody() meetingId: string) {
    client.join(`meeting:${meetingId}`)
    client.to(`meeting:${meetingId}`).emit('meeting:participant:joined', {
      userId: client.data.userId,
    })
  }

  @SubscribeMessage('leave:meeting')
  handleLeaveMeeting(@ConnectedSocket() client: Socket, @MessageBody() meetingId: string) {
    client.leave(`meeting:${meetingId}`)
    client.to(`meeting:${meetingId}`).emit('meeting:participant:left', {
      userId: client.data.userId,
    })
  }

  // Emit helpers used by services
  emitToUnit(unitId: string, event: string, data: unknown) {
    this.server.to(`unit:${unitId}`).emit(event, data)
  }

  emitToGroup(groupId: string, event: string, data: unknown) {
    this.server.to(`group:${groupId}`).emit(event, data)
  }

  emitToUser(userId: string, event: string, data: unknown) {
    const socketId = this.userSockets.get(userId)
    if (socketId) this.server.to(socketId).emit(event, data)
  }
}
