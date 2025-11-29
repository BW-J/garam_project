import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  IsInt,
  IsBoolean,
  IsDate,
  IsDateString,
  ValidateIf,
  MinLength,
} from 'class-validator';
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  loginId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  userNm?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsInt()
  deptId?: number;

  @IsOptional()
  @IsInt()
  positionId?: number;

  @IsOptional()
  @ValidateIf((o) => o.email !== '')
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cellPhone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsInt()
  recommenderId: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDate()
  passwordChangedAt?: Date;

  @IsDateString()
  joinDate?: Date | null;

  @IsDateString()
  appointmentDate?: Date | null;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  addressDetail?: string;

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountHolder?: string;

  @IsOptional()
  @IsString()
  accountRelation?: string;
}
