import { Global, Module } from '@nestjs/common';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { ShortLinkProvider } from '../public-funnel-runtime/short-link.provider';
import { SponsorVanityShortLinksService } from '../sponsors/sponsor-vanity-short-links.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';
import { SystemAuthController } from './system-auth.controller';

@Global()
@Module({
  imports: [WalletEngineModule],
  controllers: [AuthController, SystemAuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    RolesGuard,
    SponsorVanityShortLinksService,
    ShortLinkProvider,
  ],
  exports: [AuthService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
