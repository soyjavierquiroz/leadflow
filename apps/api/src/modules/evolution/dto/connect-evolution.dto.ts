import { IsString } from 'class-validator';

export class ConnectEvolutionDto {
  @IsString()
  readonly instanceName!: string;
}
