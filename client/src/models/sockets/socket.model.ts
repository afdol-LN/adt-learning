import { Message } from "../message.model";
import { Socket, io } from "socket.io-client";



interface ServerToClientEvents{
    message: (data: Message)=>void;
}

interface ClientToServerEvents {
  message: (data: { text: string }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketModel {
  private socket: AppSocket;

  constructor(url: string) {
    this.socket = io(url, { autoConnect: false });
  }

  connect() {
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  sendMessage(text: string) {
    this.socket.emit('message', { text });
  }

  onMessage(callback: (data: Message) => void) {
    this.socket.on('message', callback);
  }

  onConnect(callback: () => void) {
    this.socket.on('connect', callback);
  }

  onDisconnect(callback: () => void) {
    this.socket.on('disconnect', callback);
  }

  offAll() {
    this.socket.off('message');
    this.socket.off('connect');
    this.socket.off('disconnect');
  }
}

export const socketModel = new SocketModel('http://localhost:3001');