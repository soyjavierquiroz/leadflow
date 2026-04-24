import { Global, Module } from '@nestjs/common';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';
import { SystemAuthController } from './system-auth.controller';

@Global()
@Module({
  imports: [WalletEngineModule],
  controllers: [AuthController, SystemAuthController],
  providers: [AuthService, SessionAuthGuard, RolesGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
