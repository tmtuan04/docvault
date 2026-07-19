import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { auth } from '../auth.js';
import { ChatDto, SearchDocumentsDto } from '../documents/document.dto.js';
import { RetrievalService } from './retrieval.service.js';

@Controller('api/workspaces/:tenantId')
export class RetrievalController {
  constructor(private readonly retrieval: RetrievalService) {}

  @Get('search')
  search(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Query() query: SearchDocumentsDto,
  ) {
    return this.retrieval.search(tenantId, session.user.id, query);
  }

  @Post('chat')
  chat(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() input: ChatDto,
  ) {
    return this.retrieval.chat(tenantId, session.user.id, input);
  }
}
