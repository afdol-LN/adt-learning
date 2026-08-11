import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'adaptive-engine.log');

fs.mkdirSync(LOG_DIR, { recursive: true });

export class AdaptiveEngineLogger {
  static log(message: string): void {
    Logger.log(message, 'AdaptiveEngine');
    fs.appendFile(
      LOG_FILE,
      `${new Date().toISOString()} ${message}\n`,
      () => {},
    );
  }
}
