import { DeepPartial, Repository } from 'typeorm';
import { BaseAuditEntity } from '../entities/base-audit.entity';
import { Logger, NotFoundException } from '@nestjs/common';
import { AuthorizedRequest } from 'src/types/http';

export class BaseService<T extends BaseAuditEntity> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly repository: Repository<T>) {}

  async findAll(options?: any): Promise<T[]> {
    return this.repository.find(options);
  }

  async findOne(id: number): Promise<T> {
    const entity = await this.repository.findOne({ where: { id } as any });
    if (!entity) throw new NotFoundException('Data not found');
    return entity;
  }

  async findOneForKey(
    id: number,
    idField: keyof T = 'id' as keyof T,
  ): Promise<T> {
    const entity = await this.repository.findOne({
      where: { [idField]: id } as any,
    });
    if (!entity) throw new NotFoundException('Data not found');
    return entity;
  }

  async create(
    data: DeepPartial<T> | DeepPartial<T>[],
    currentUserId: number,
  ): Promise<T | T[]> {
    const dataArray = Array.isArray(data) ? data : [data];
    const entities = dataArray.map((item) => {
      return this.repository.create({
        ...item,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      } as DeepPartial<T>);
    });
    const result = await this.repository.save(entities as T[]);

    this.logger.debug(
      `${this.repository.metadata.name} ID is created. ${result}`,
    );
    return Array.isArray(data) ? result : result[0];
  }

  async update(
    id: number,
    data: DeepPartial<T>,
    req?: AuthorizedRequest,
  ): Promise<T> {
    const before = await this.findOne(id);
    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    Object.assign(before, data, { updatedBy: req?.user?.sub });
    const result = await this.repository.save(before);
    this.logger.debug(`${this.repository.metadata.name} ID $${id} is updated.`);
    return result;
  }

  async updateForKey(
    idField: keyof T = 'id' as keyof T,
    id: number,
    data: DeepPartial<T>,
    req?: AuthorizedRequest,
  ): Promise<T> {
    const before = await this.findOneForKey(id, idField);
    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    Object.assign(before, data, { updatedBy: req?.user?.sub });
    const result = await this.repository.save(before);
    this.logger.debug(`${this.repository.metadata.name} ID $${id} is updated.`);
    return result;
  }

  async toggleActive(id: number, req?: AuthorizedRequest) {
    const before = await this.findOne(id);
    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = !before.isActive;
    before.updatedBy = req?.user?.sub as number;
    const result = await this.repository.save(before);
    this.logger.debug(
      `The activation status of ${this.repository.metadata.name} ID $${id} has been changed. ==> ${before.isActive}`,
    );
    return result;
  }

  async softDelete(id: number, req?: AuthorizedRequest): Promise<void> {
    const before = await this.findOne(id);
    if (!before)
      throw new NotFoundException(
        `${this.repository.metadata.name} ID ${id} is not found.`,
      );

    Object.assign(before, {
      isActive: false,
      updatedAt: new Date(),
      updatedBy: req?.user?.sub,
    });

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));

    await this.repository.softDelete(id);
    this.logger.debug(`${this.repository.metadata.name} ID $${id} is deleted.`);
  }

  async hardDelete(id: number, req?: AuthorizedRequest): Promise<void> {
    const before = await this.findOne(id);
    if (!before)
      throw new NotFoundException(
        `${this.repository.metadata.name} ID ${id} is not found.`,
      );

    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));

    await this.repository.delete(id);
    this.logger.debug(`${this.repository.metadata.name} ID $${id} is deleted.`);
  }

  async restore(id: number, req?: AuthorizedRequest) {
    const before = await this.findOne(id);
    if (req) req['_auditBefore'] = JSON.parse(JSON.stringify(before));
    before.isActive = true;
    before.updatedBy = req?.user?.sub as number;
    await this.repository.restore(id);
    this.logger.debug(
      `${this.repository.metadata.name} ID $${id} is restored.`,
    );
    return this.repository.save(before);
  }

  /**
   * flat 데이터를 트리 구조로 변환하는 공통 메서드
   * @param items flat한 entity 배열
   * @param idKey 기본값 'id' — PK 컬럼 이름
   * @param parentKey 기본값 'parentId' — 상위 FK 컬럼 이름
   */
  protected buildTree<K extends keyof T>(
    items: T[],
    idKey: K,
    parentKey: K,
    nameKey: K,
  ): (T & { children: T[] })[] {
    type TreeNode = T & { children: T[]; path: string[] };
    const map = new Map<any, TreeNode>();
    const roots: TreeNode[] = [];

    // 1. map 구성
    for (const item of items) {
      map.set(item[idKey], { ...item, children: [], path: [] });
    }

    // 2. 부모-자식 연결
    for (const item of items) {
      const node = map.get(item[idKey])!;
      const parentId = item[parentKey];

      // if (parentId != null && map.has(parentId)) {
      //   const parent = map.get(parentId);
      //   if (parent) {
      //     parent.children.push(node);
      //   } else {
      //     roots.push(node);
      //   }
      // } else {
      //   roots.push(node);
      // }
      if (parentId != null && map.has(parentId)) {
        const parent = map.get(parentId)!;
        node.path = [...parent.path, String(item[nameKey])];
        parent.children.push(node);
      } else {
        node.path = [String(item[nameKey])];
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * 특정 ID를 루트로 하는 서브트리 생성
   * @param items
   * @param idKey
   * @param parentKey
   * @param rootId
   * @returns
   */
  protected buildSubTree<K extends keyof T>(
    items: T[],
    idKey: K,
    parentKey: K,
    rootId: any,
    nameKey: K,
  ): T | null {
    const fullTree = this.buildTree(items, idKey, parentKey, nameKey);
    const findNode = (nodes: T[]): T | null => {
      for (const node of nodes as any[]) {
        if (node[idKey] === rootId) return node;
        const child = node.children && findNode(node.children);
        if (child) return child;
      }
      return null;
    };
    return findNode(fullTree);
  }
}
