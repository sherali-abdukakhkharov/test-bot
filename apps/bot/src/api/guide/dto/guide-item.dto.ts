import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGuideItemDto {
  @IsString()
  @IsIn(['text', 'video'])
  contentType: 'text' | 'video';

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGuideItemDto {
  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;
}
