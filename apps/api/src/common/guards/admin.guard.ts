import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenPayload } from '../../modules/auth/auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authUser: AuthTokenPayload | undefined = request.user;
    if (!authUser) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id: authUser.sub } });
    if (!user?.isAdmin) throw new ForbiddenException('Admin access required');

    return true;
  }
}
