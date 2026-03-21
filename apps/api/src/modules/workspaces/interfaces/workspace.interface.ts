import type { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import type {
  BaseDomainEntity,
  RepositoryPort,
} from '../../shared/domain.types';

export type WorkspaceStatus = 'draft' | 'active' | 'archived';

export interface Workspace extends BaseDomainEntity {
  name: string;
  slug: string;
  status: WorkspaceStatus;
  timezone: string;
  defaultCurrency: string;
  primaryLocale: string;
  primaryDomain: string | null;
}

export interface WorkspaceRepository extends RepositoryPort<
  Workspace,
  CreateWorkspaceDto
> {
  findAll(): Promise<Workspace[]>;
  findBySlug(slug: string): Promise<Workspace | null>;
}
