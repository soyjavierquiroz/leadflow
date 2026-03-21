import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { LeadsModule } from './modules/leads/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    LeadsModule,
    AssignmentModule,
  ],
})
export class AppModule {}
