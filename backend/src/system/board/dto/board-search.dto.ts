import { IsOptional, IsString } from 'class-validator';
import { PaginationQuery } from 'src/common/utils/pagination.util';

// 공통 PaginationQuery 인터페이스를 구현하거나 상속받아 사용
export class BoardSearchDto implements PaginationQuery {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  keyword?: string; // 제목 + 내용 검색

  @IsOptional()
  @IsString()
  searchType?: 'title' | 'content' | 'author'; // 검색 조건 세분화 (선택 사항)
}
