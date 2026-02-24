import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parentId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isLockedByDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  unlockRequiredSection?: number | null;
}
