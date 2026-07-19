import { Module } from '@nestjs/common';

import { RetrievalController } from './retrieval.controller.js';
import { RetrievalService } from './retrieval.service.js';

@Module({
  controllers: [RetrievalController],
  providers: [RetrievalService],
})
export class RetrievalModule {}
