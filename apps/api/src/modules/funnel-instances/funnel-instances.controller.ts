import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import {
  type AddFlowNodeInput,
  type ConnectFlowNodesInput,
  type DisconnectFlowExitInput,
  FunnelGraphMutationService,
  type UpdateFlowNodeInput,
} from '../funnel-graph/funnel-graph-mutation.service';
import type { CreateTeamFunnelInstanceDto } from './dto/create-team-funnel-instance.dto';
import type { UpdateTeamFunnelInstanceDto } from './dto/update-team-funnel-instance.dto';
import { FunnelInstancesService } from './funnel-instances.service';

@Controller('funnel-instances')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class FunnelInstancesController {
  constructor(
    private readonly funnelInstancesService: FunnelInstancesService,
    private readonly funnelGraphMutationService: FunnelGraphMutationService,
  ) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.funnelInstancesService.list({
      workspaceId:
        user.role === UserRole.SUPER_ADMIN
          ? (workspaceId ?? user.workspaceId ?? undefined)
          : (user.workspaceId ?? undefined),
      teamId:
        user.role === UserRole.SUPER_ADMIN
          ? teamId
          : (user.teamId ?? undefined),
    });
  }

  @Post()
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamFunnelInstanceDto,
  ) {
    return this.funnelInstancesService.createForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      dto,
    );
  }

  @Patch(':id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Body() dto: UpdateTeamFunnelInstanceDto,
  ) {
    return this.funnelInstancesService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      funnelInstanceId,
      dto,
    );
  }

  @Post(':id/graph/nodes')
  addGraphNode(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Body() dto: AddFlowNodeInput,
  ) {
    return this.funnelGraphMutationService.addNodeForUser(
      user,
      funnelInstanceId,
      dto,
    );
  }

  @Patch(':id/graph/edges')
  connectGraphNodes(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Body() dto: ConnectFlowNodesInput,
  ) {
    return this.funnelGraphMutationService.connectNodesForUser(
      user,
      funnelInstanceId,
      dto,
    );
  }

  @Delete(':id/graph/edges/:fromStepId/:outcome')
  disconnectGraphExit(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Param('fromStepId') fromStepId: string,
    @Param('outcome') outcome: string,
  ) {
    const dto: DisconnectFlowExitInput = {
      fromStepId,
      outcome,
    };

    return this.funnelGraphMutationService.disconnectExitForUser(
      user,
      funnelInstanceId,
      dto,
    );
  }

  @Delete(':id/graph/nodes/:stepId')
  removeGraphNode(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.funnelGraphMutationService.removeNodeForUser(
      user,
      funnelInstanceId,
      stepId,
    );
  }

  @Patch(':id/graph/nodes/:stepId')
  updateGraphNode(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Param('stepId') stepId: string,
    @Body() dto: UpdateFlowNodeInput,
  ) {
    return this.funnelGraphMutationService.updateNodeForUser(
      user,
      funnelInstanceId,
      stepId,
      dto,
    );
  }
}
