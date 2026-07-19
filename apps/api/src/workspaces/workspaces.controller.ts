import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { auth } from '../auth.js';
import { CreateInvitationDto, CreateWorkspaceDto } from './workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('api/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Session() session: UserSession<typeof auth>) {
    return this.workspaces.listForUser(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<typeof auth>,
    @Body() input: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(session.user.id, input);
  }

  @Get(':tenantId/members')
  listMembers(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
  ) {
    return this.workspaces.listMembers(tenantId, session.user.id);
  }

  @Post(':tenantId/invitations')
  invite(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() input: CreateInvitationDto,
  ) {
    return this.workspaces.createInvitation(tenantId, session.user.id, input);
  }

  @Post(':tenantId/invitations/:token/accept')
  acceptInvitation(
    @Session() session: UserSession<typeof auth>,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('token') token: string,
  ) {
    return this.workspaces.acceptInvitation(tenantId, token, {
      id: session.user.id,
      email: session.user.email,
    });
  }
}
