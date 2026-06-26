import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import {
  type AddFlowNodeInput,
  type ConnectFlowNodesInput,
  type DisconnectFlowExitInput,
  FunnelGraphMutationService,
  type UpdateFlowNodeInput,
} from '../funnel-graph/funnel-graph-mutation.service';

@Controller('system/tenants/:teamId/funnels/:funnelId/instances')
@RequireRoles(UserRole.SUPER_ADMIN)
export class SystemFunnelInstancesController {
  constructor(
    private readonly funnelGraphMutationService: FunnelGraphMutationService,
  ) {}

  @Post(':id/graph/nodes')
  addGraphNode(
    @Param('teamId') teamId: string,
    @Param('funnelId') funnelId: string,
    @Param('id') funnelInstanceId: string,
    @Body() dto: AddFlowNodeInput,
  ) {
    return this.funnelGraphMutationService.addNode(
      { workspaceId: '', teamId },
      funnelInstanceId,
      dto,
      { funnelId },
    );
  }

  @Patch(':id/graph/edges')
  connectGraphNodes(
    @Param('teamId') teamId: string,
    @Param('funnelId') funnelId: string,
    @Param('id') funnelInstanceId: string,
    @Body() dto: ConnectFlowNodesInput,
  ) {
    return this.funnelGraphMutationService.connectNodes(
      { workspaceId: '', teamId },
      funnelInstanceId,
      dto,
      { funnelId },
    );
  }

  @Delete(':id/graph/edges/:fromStepId/:outcome')
  disconnectGraphExit(
    @Param('teamId') teamId: string,
    @Param('funnelId') funnelId: string,
    @Param('id') funnelInstanceId: string,
    @Param('fromStepId') fromStepId: string,
    @Param('outcome') outcome: string,
  ) {
    const dto: DisconnectFlowExitInput = { fromStepId, outcome };

    return this.funnelGraphMutationService.disconnectExit(
      { workspaceId: '', teamId },
      funnelInstanceId,
      dto,
      { funnelId },
    );
  }

  @Delete(':id/graph/nodes/:stepId')
  removeGraphNode(
    @Param('teamId') teamId: string,
    @Param('funnelId') funnelId: string,
    @Param('id') funnelInstanceId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.funnelGraphMutationService.removeNode(
      { workspaceId: '', teamId },
      funnelInstanceId,
      stepId,
      { funnelId },
    );
  }

  @Patch(':id/graph/nodes/:stepId')
  updateGraphNode(
    @Param('teamId') teamId: string,
    @Param('funnelId') funnelId: string,
    @Param('id') funnelInstanceId: string,
    @Param('stepId') stepId: string,
    @Body() dto: UpdateFlowNodeInput,
  ) {
    return this.funnelGraphMutationService.updateNode(
      { workspaceId: '', teamId },
      funnelInstanceId,
      stepId,
      dto,
      { funnelId },
    );
  }
}
