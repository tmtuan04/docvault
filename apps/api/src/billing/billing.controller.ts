import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';

import { auth } from '../auth.js';
import { CreateCheckoutDto, type SepayWebhookPayload } from './billing.dto.js';
import { BillingService } from './billing.service.js';

@Controller('api')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('workspaces/:tenantId/billing')
  overview(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
  ) {
    return this.billing.overview(tenantId, session.user.id);
  }

  @Post('workspaces/:tenantId/billing/checkout')
  createCheckout(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() input: CreateCheckoutDto,
  ) {
    return this.billing.createCheckout(tenantId, session.user.id, input.plan);
  }

  @AllowAnonymous()
  @Post('billing/sepay/webhook')
  sepayWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SepayWebhookPayload,
  ) {
    return this.billing.handleSepayWebhook(authorization ?? '', payload);
  }
}
