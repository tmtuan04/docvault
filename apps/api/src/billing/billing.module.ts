import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { EntitlementService } from './entitlement.service.js';
import { QuotaService } from './quota.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, EntitlementService, QuotaService],
  exports: [EntitlementService, QuotaService],
})
export class BillingModule {}
