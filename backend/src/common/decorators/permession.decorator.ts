import { SetMetadata } from '@nestjs/common';

export interface PermissionMeta {
  menu: string;
  action: string;
}

export const PERMISSION_KEY = 'permissions';
export const Permission = (menu: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { menu, action });
