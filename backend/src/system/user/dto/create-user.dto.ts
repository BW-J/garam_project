import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsInt,
  IsBoolean,
  IsDateString,
  ValidateIf,
  MinLength,
} from 'class-validator';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  loginId: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  userNm: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsInt()
  deptId?: number;

  @IsOptional()
  @IsInt()
  recommenderId: number | null;

  @IsNotEmpty()
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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  joinDate?: Date | null;

  @IsOptional()
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
