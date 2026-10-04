import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../errors/domain.exception';
import type { AppRequest } from '../types/request-context.types';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const userId = request.auth?.userId;

    if (!userId) {
      throw new DomainException('AUTH_REQUIRED', 'Authentication required for Super Admin portal');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true, status: true },
    });

    if (!user || !user.isSuperAdmin) {
      throw new DomainException(
        'SUPER_ADMIN_REQUIRED',
        'Access denied: Platform Super Administrator privileges required',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new DomainException('AUTH_ACCOUNT_DISABLED', 'Super administrator account is suspended or disabled');
    }

    return true;
  }
}
