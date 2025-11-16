import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolePermissions } from 'src/core/entities/tb_role_permissions.entity';
import { BaseService } from 'src/core/services/base.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UserService } from '../user/user.service';
import { Menu } from 'src/core/entities/tb_menu.entity';
import { Action } from 'src/core/entities/tb_action.entity';
import { AuthorizedRequest } from 'src/types/http';

type PermissionStateMap = Record<string, string[]>;

@Injectable()
export class RolePermissionsService extends BaseService<RolePermissions> {
  private actionCdToIdMap: Map<string, number> | null = null;
  private actionIdToCdMap: Map<number, string> | null = null;
  private menuCdToIdMap: Map<string, number> | null = null;

  constructor(
    @InjectRepository(RolePermissions)
    private readonly rolePermissionsRepository: Repository<RolePermissions>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {
    super(rolePermissionsRepository);
    this.loadMaps();
  }

  /**
   * [신규] 액션 ID <-> CD 변환 맵을 메모리에 로드 (캐시)
   */
  private async loadMaps() {
    try {
      const actions = await this.actionRepository.find({
        where: { isActive: true },
      });
      this.actionCdToIdMap = new Map(
        actions.map((a) => [a.actionCd, a.actionId]),
      );
      this.actionIdToCdMap = new Map(
        actions.map((a) => [a.actionId, a.actionCd]),
      );

      const menus = await this.menuRepository.find({
        where: { isActive: true },
      });
      this.menuCdToIdMap = new Map(menus.map((m) => [m.menuCd, m.menuId]));
      this.logger.log('Action and Menu maps loaded successfully.');
    } catch (error) {
      this.logger.error('Failed to load action or menu maps', error);
    }
  }

  /**
   * [신규] 역할 권한을 프론트 UI용 맵으로 조회
   */
  async getRolePermissionMap(roleId: number): Promise<PermissionStateMap> {
    if (!this.actionIdToCdMap) await this.loadMaps(); // 맵 로드 보장

    const permissions = await this.getRolePermissions(roleId);
    const permissionMap: PermissionStateMap = {};

    for (const perm of permissions) {
      // perm.menu.menuId, perm.action.actionId
      if (perm.menu && perm.action) {
        const menuKey = String(perm.menu.menuCd); // "5"
        const actionCd = this.actionIdToCdMap!.get(perm.actionId); // "VIEW"

        if (menuKey && actionCd) {
          if (!permissionMap[menuKey]) {
            permissionMap[menuKey] = [];
          }
          permissionMap[menuKey].push(actionCd);
        }
      }
    }
    return permissionMap;
  }

  /**
   * [신규] 프론트 UI용 맵을 받아 권한 설정
   */
  async setRolePermissionMap(
    roleId: number,
    permissionsMap: PermissionStateMap,
    req: AuthorizedRequest,
  ) {
    if (!this.actionCdToIdMap || !this.menuCdToIdMap) await this.loadMaps(); // 맵 로드 보장
    const before = await this.getRolePermissionMap(roleId);
    if (req) {
      req['_auditBefore'] = before;
    }

    // 1. 맵(Map) -> 배열(Array)로 변환
    const payload: { menuId: number; actionId: number; isActive: boolean }[] =
      [];
    for (const menuCd in permissionsMap) {
      const menuId = this.menuCdToIdMap!.get(menuCd);
      if (menuId == null) continue;

      const actionCds = permissionsMap[menuCd];

      for (const actionCd of actionCds) {
        const actionId = this.actionCdToIdMap!.get(actionCd);
        if (actionId) {
          payload.push({
            menuId: menuId,
            actionId: actionId,
            isActive: true, // 항상 활성
          });
        }
      }
    }

    await this.setRolePermissions(roleId, payload, req?.user?.sub);

    // 2. 기존 배열 기반 저장 로직 재사용
    return permissionsMap;
  }

  /**
   * 역할 권한 조회
   * @param roleId
   * @returns
   */
  async getRolePermissions(roleId: number) {
    return super.findAll({
      where: { role: { roleId } },
      relations: ['menu', 'action'],
    });
  }

  /**
   * 역할 권한 설정
   * @param roleId
   * @param permissions
   * @param currentUserId
   * @returns
   */
  async setRolePermissions(
    roleId: number,
    permissions: { menuId: number; actionId: number; isActive: boolean }[],
    currentUserId,
  ) {
    const result = await this.rolePermissionsRepository.manager.transaction(
      async (manager) => {
        // 1. 삭제 (트랜잭션 매니저 사용)
        await manager.delete(RolePermissions, { role: { roleId } });

        // 2. 생성 (super.create 대신 직접 manager.save 사용 또는 super.create 수정)
        // super.create가 트랜잭션 매니저를 받지 않는다면 여기서 직접 save를 사용해야 안전합니다.
        const newAuths = permissions.map((p) =>
          this.rolePermissionsRepository.create({
            role: { roleId },
            menu: { menuId: p.menuId },
            action: { actionId: p.actionId },
            isActive: p.isActive,
            createdBy: currentUserId,
            updatedBy: currentUserId,
          }),
        );
        return await manager.save(RolePermissions, newAuths);
      },
    );

    try {
      // await (this.cacheManager as any).store.reset();
      await this.cacheManager.del(`role_perm:${roleId}`);
      this.logger.log('cached role permissions deleted.');
    } catch (cacheError) {
      this.logger.error('Cache reset failed', cacheError);
    }
    return result;
  }

  /**
   * 메뉴/권한 정보 조회
   * @param roleIds
   * @returns
   */
  async getPermissionsForRoles(roleIds: number[]) {
    const auths = await this.rolePermissionsRepository.find({
      where: { role: { roleId: In(roleIds), isActive: true } },
      relations: ['menu', 'action'],
    });

    // 중복 제거 (role 다중일 경우)
    const seen = new Set();
    return auths.filter((a) => {
      const key = `${a.menu.menuId}-${a.action.actionId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * superAdmin용 모든권한 가져오기
   * @returns
   */
  async getAllMenusWithAllActions() {
    const allActiveMenus = await this.menuRepository.find({
      where: { isActive: true },
      order: { parentMenuId: 'ASC', sortOrder: 'ASC', menuId: 'ASC' }, // 트리 구조 위해 정렬
    });

    // 3-2. 모든 활성 액션 조회
    const allActiveActions = await this.actionRepository.find({
      where: { isActive: true },
    });

    if (allActiveMenus.length === 0 || allActiveActions.length === 0) {
      return []; // 메뉴나 액션이 없으면 빈 배열 반환
    }

    const virtualRolePermessions = allActiveMenus.flatMap((menu) =>
      allActiveActions.map((action) => ({
        // buildAuthorizedMenuTree가 필요한 최소 데이터 구조
        menu: menu, // Menu 엔티티 전체 전달
        action: action, // Action 엔티티 전체 전달
        isActive: true, // 항상 활성으로 간주
      })),
    );

    // buildAuthorizedMenuTree 호출
    return this.buildAuthorizedMenuTree(virtualRolePermessions, allActiveMenus);
  }

  /**
   * 권한이 있는지 체크
   * @param roleIds
   * @param menuCd
   * @param actionCd
   * @returns
   */
  async hasPermission(
    roleIds: number[],
    menuCd: string,
    actionCd: string,
  ): Promise<boolean> {
    const requiredKey = `${menuCd}:${actionCd}`;

    // 각 roleId 별로 개별 캐시를 조회하는 방식
    for (const roleId of roleIds) {
      const cacheKey = `role_perm:${roleId}`;

      // 캐시에서 읽기 (Object 형태)
      let permObj =
        await this.cacheManager.get<Record<string, boolean>>(cacheKey);

      if (!permObj) {
        // 캐시 MISS → 이 roleId에 대한 권한을 DB에서 조회
        const allowedActions = await this.getPermissionsForRoles([roleId]);

        permObj = {};
        allowedActions.forEach((p) => {
          const key = `${p.menu.menuCd}:${p.action.actionCd}`;
          permObj![key] = true;
        });

        // 캐시에 저장 (Object 형태로 저장)
        await this.cacheManager.set(cacheKey, permObj);
        this.logger.log('cached role permissions changed.');
      }

      // 현재 roleId에 필요한 권한이 있으면 바로 true
      if (permObj[requiredKey]) {
        return true;
      }
    }

    // 어떤 역할에도 권한이 없으면 false
    return false;
  }

  /**
   * 특정 사용자의 모든 권한 메뉴/액션을 빌드 (AuthService에서 이동)
   */
  async getAuthorizedMenuForUser(userId: number): Promise<any[]> {
    // 사용자의 모든 역할 ID(개인+직급) 조회
    const roles = await this.userService.getAllRoleInfo(userId);
    const roleIds = roles.map((r) => r.roleId);

    if (roleIds.length === 0) {
      return []; // 권한이 없으면 빈 배열 반환
    }

    //  역할 ID에 매핑된 메뉴/액션 조회
    const reolePermissions = await this.getPermissionsForRoles(roleIds);

    // [수정] DB에서 모든 활성 메뉴를 조회하여 함께 전달
    const allActiveMenus = await this.menuRepository.find({
      where: { isActive: true },
      order: { parentMenuId: 'ASC', sortOrder: 'ASC', menuId: 'ASC' },
    });

    // 트리 구조로 빌드
    return this.buildAuthorizedMenuTree(reolePermissions, allActiveMenus);
  }

  /**
   * 메뉴 트리 빌더 (AuthService에서 가져와 공통화)
   */
  private buildAuthorizedMenuTree(
    reolePermissions: any[],
    allActiveMenus: Menu[], // 💡 [수정] 모든 활성 메뉴를 인자로 받음
  ): any[] {
    // 권한 맵핑 (menuId -> Set<actionCd>)
    // (기존 menuMap 생성 로직 대체)
    const permissionsMap = new Map<number, Set<string>>();
    for (const auth of reolePermissions) {
      const menu = auth.menu;
      const action = auth.action;
      if (auth.isActive && menu.isActive && action.isActive) {
        if (!permissionsMap.has(menu.menuId)) {
          permissionsMap.set(menu.menuId, new Set<string>());
        }
        permissionsMap.get(menu.menuId)!.add(action.actionCd.toLowerCase());
      }
    }

    //  *모든* 활성 메뉴를 기준으로 전체 트리 노드 맵 생성
    const menuNodeMap = new Map<number, any>();
    for (const menu of allActiveMenus) {
      const perms = permissionsMap.get(menu.menuId) || new Set<string>();
      menuNodeMap.set(menu.menuId, {
        id: menu.menuId,
        name: menu.menuNm,
        icon: menu.icon,
        path: menu.menuPath,
        menuCd: menu.menuCd,
        parentId: menu.parentMenuId,
        permissions: Array.from(perms), //권한 주입
        children: [],
      });
    }

    // 전체 트리를 구성 (기존 로직 재사용, 이제 정상 동작)
    const roots: any[] = [];
    for (const node of menuNodeMap.values()) {
      if (node.parentId && menuNodeMap.has(node.parentId)) {
        // 부모가 권한이 없어도 menuNodeMap에 존재하므로 정상 연결됨
        menuNodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 권한 없는 노드 가지치기 (Pruning)
    /**
     * 재귀적으로 하위 노드를 검사하며,
     * 자신(node)과 자신의 모든 하위(children) 노드 중에
     * 권한(permissions)이 하나라도 있는 노드가 없으면 자신을 제거(null)합니다.
     */
    function pruneTree(nodes: any[]): any[] {
      return nodes
        .map((node) => {
          // 자식 노드를 먼저 가지치기
          if (node.children && node.children.length > 0) {
            node.children = pruneTree(node.children);
          }

          // 자신을 유지할지 결정
          const hasPermission = node.permissions.length > 0;
          const hasVisibleChildren = node.children.length > 0;

          if (hasPermission || hasVisibleChildren) {
            return node; // 자신에게 권한이 있거나, 권한 있는 자식이 하나라도 있으면 유지
          }

          return null; // 권한도 없고 자식도 없으면 제거
        })
        .filter((node) => node !== null); // 제거된(null) 노드 필터링
    }

    return pruneTree(roots);
  }
}
