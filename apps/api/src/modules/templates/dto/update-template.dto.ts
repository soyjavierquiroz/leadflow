import type { JsonValue } from '../../shared/domain.types';

export class UpdateTemplateDto {
  readonly name?: string;
  readonly description?: string | null;
  readonly blocks?: JsonValue;
  readonly mediaMap?: JsonValue;
}
