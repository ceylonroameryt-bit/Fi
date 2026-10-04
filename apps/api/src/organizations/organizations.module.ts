import { Global, Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationAccessGuard } from '../common/guards/organization-access.guard';

@Global()
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationAccessGuard],
  exports: [OrganizationsService, OrganizationAccessGuard],
})
export class OrganizationsModule {}
