import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { EntitlementService } from './entitlement.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, EntitlementService],
  exports: [EntitlementService],
})
export class BillingModule {}
