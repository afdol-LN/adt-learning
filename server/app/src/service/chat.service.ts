import { Injectable } from '@nestjs/common';
import { Message } from 'src/model/chat.model';

@Injectable()
export class chatService {
  private messages: Message[] = [];

  addMessage(text: string, from: string) {
    const msg: Message = { text, from };
    this.messages.push(msg);
    return this.messages;
  }
}
