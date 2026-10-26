import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, SessionUser } from './auth.service';

export const COOKIE = 'cm_session';

type AuthedRequest = Request & { user?: SessionUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = this.auth.read(req.cookies?.[COOKIE]);
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}

@Injectable()
export class AdminGuard extends AuthGuard {
  canActivate(ctx: ExecutionContext): boolean {
    super.canActivate(ctx);
    if (!ctx.switchToHttp().getRequest<AuthedRequest>().user?.admin) throw new ForbiddenException();
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user as SessionUser,
);
