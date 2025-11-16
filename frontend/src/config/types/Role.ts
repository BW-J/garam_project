export interface Role {
  roleId: number;
  roleCd: string | null;
  roleNm: string;
  description?: string;
  isActive: boolean;
}
