import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

// Endpoints under /internal are only ever called by the Bot service over the
// private Docker network, authenticated with a shared secret. They must never
// be exposed through the public reverse proxy — see infrastructure/nginx.
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided: string | undefined = request.headers['x-internal-api-key'];
    const expected = this.config.get<string>('INTERNAL_API_KEY');

    if (!provided || !expected) {
      throw new UnauthorizedException();
    }

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    const valid =
      providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

    if (!valid) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
