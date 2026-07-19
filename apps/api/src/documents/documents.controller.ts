import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { auth } from '../auth.js';
import { CompleteUploadDto, CreateUploadUrlDto } from './document.dto.js';
import { DocumentsService } from './documents.service.js';

@Controller('api/workspaces/:tenantId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
  ) {
    return this.documents.list(tenantId, session.user.id);
  }

  @Post('upload-url')
  createUploadUrl(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() input: CreateUploadUrlDto,
  ) {
    return this.documents.createUploadUrl(tenantId, session.user.id, input);
  }

  @Post('complete')
  completeUpload(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() input: CompleteUploadDto,
  ) {
    return this.documents.completeUpload(tenantId, session.user.id, input);
  }

  @Get(':documentId/download-url')
  getDownloadUrl(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.getDownloadUrl(tenantId, session.user.id, documentId);
  }

  @Delete(':documentId')
  softDelete(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.softDelete(tenantId, session.user.id, documentId);
  }
}
