import { PaginationMeta } from '../utils/pagination.util';

/**
 * 제너릭 기반의 공통 페이징 응답 DTO
 * 예: PaginatedResponseDto<UserResponseDto>
 */
export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;
}
