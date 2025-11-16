import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  PermissionMeta,
} from 'src/common/decorators/permession.decorator';
import { RolePermissionsService } from 'src/system/role/role-permission.service';

@Injectable()
export class RolePermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required: PermissionMeta = this.reflector.get(
      PERMISSION_KEY,
      context.getHandler(),
    );
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    if (!required) return true; // 권한 미지정 → 통과

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    if (user.isSuperAdmin) return true;

    if (!user?.roleIds) {
      throw new ForbiddenException('권한 정보가 없습니다.');
    }

    const roleIds = user.roleIds || [];
    const hasPermission = await this.rolePermissionsService.hasPermission(
      roleIds,
      required.menu,
      required.action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `해당 메뉴(${required.menu})의 ${required.action} 권한이 없습니다.`,
      );
    }

    return true;
  }
}
