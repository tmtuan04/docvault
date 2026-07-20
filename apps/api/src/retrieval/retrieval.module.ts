import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module.js';
import { RetrievalController } from './retrieval.controller.js';
import { RetrievalService } from './retrieval.service.js';

@Module({
  imports: [BillingModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
})
export class RetrievalModule {}
