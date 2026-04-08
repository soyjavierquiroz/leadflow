import type { JsonValue } from '../../shared/domain.types';

export class CreateTemplateDto {
  readonly name!: string;
  readonly description?: string | null;
  readonly blocks!: JsonValue;
  readonly mediaMap?: JsonValue;
}
