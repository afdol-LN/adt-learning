// import {
//   WebSocketGateway,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   WebSocketServer,
//   SubscribeMessage,
//   MessageBody,
//   ConnectedSocket,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Logger } from '@nestjs/common';
// import { chatService } from 'src/service/chat.service';

// @WebSocketGateway({
//   cors: {
//     origin: `http://localhost:4200`,
//     credentials: true,
//   },
// })
// export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   private readonly logger = new Logger(EventGateway.name);

//   constructor(private chatService: chatService) {}

//   @WebSocketServer()
//   server: Server;

//   handleConnection(user: Socket) {
//     this.logger.log(`Client connected: ${user.id}`);
//   }

//   handleDisconnect(user: Socket) {
//     this.logger.log(`Client disconnected: ${user.id}`);
//   }

//   @SubscribeMessage('message')
//   handleMessage(
//     @MessageBody()
//     data: { text: string },
//     @ConnectedSocket()
//     client: Socket,
//   ) {

//     const message = this.chatService.addMessage(data.text, client.id);
//     this.server.emit('message', message);
//   }
// }
