import { Module } from '@nestjs/common';
import { CommercialProfileController } from './commercial-profile.controller';
import { CommercialProfileService } from './commercial-profile.service';

@Module({
  controllers: [CommercialProfileController],
  providers: [CommercialProfileService],
  exports: [CommercialProfileService],
})
export class CommercialProfileModule {}
