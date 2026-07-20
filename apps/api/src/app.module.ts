import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { auth } from './auth.js';
import { BillingModule } from './billing/billing.module.js';
import { DatabaseLifecycle } from './database.js';
import { DocumentsModule } from './documents/documents.module.js';
import { RetrievalModule } from './retrieval/retrieval.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      isGlobal: true,
      bodyParser: {
        json: { limit: '1mb' },
        urlencoded: { limit: '1mb', extended: true },
      },
    }),
    WorkspacesModule,
    DocumentsModule,
    RetrievalModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseLifecycle],
})
export class AppModule {}
