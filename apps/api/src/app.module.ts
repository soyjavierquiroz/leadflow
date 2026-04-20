import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateApiEnvironment } from './config/runtime';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DomainModule } from './modules/domain/domain.module';
import { LeadsSchemaInitializerService } from './modules/leads/leads-schema-initializer.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateApiEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    DomainModule,
  ],
  providers: [LeadsSchemaInitializerService],
})
export class AppModule {}
