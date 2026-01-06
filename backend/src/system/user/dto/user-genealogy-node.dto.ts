import { Exclude, Expose, Type } from 'class-transformer';
import { PositionResponseDto } from 'src/system/position/dto/Position-response.dto';

@Exclude()
export class UserGenealogyNodeDto {
  @Expose()
  key: string; // TreeTable의 key (userId)

  @Expose()
  expanded: boolean;

  @Expose()
  data: {
    userId: number;
    userNm: string;
    loginId: string;
    depth: number;
    position?: PositionResponseDto | null;
    lastMonthPerf?: number | null;
    deletedAt?: Date;
  };

  @Expose()
  @Type(() => UserGenealogyNodeDto)
  children: UserGenealogyNodeDto[];
}
