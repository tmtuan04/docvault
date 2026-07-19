import { Module } from '@nestjs/common';

import { QueueModule } from '../queue/queue.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [StorageModule, QueueModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
