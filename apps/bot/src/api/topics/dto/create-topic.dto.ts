import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_TIMES = [5, 10, 15, 20, 25, 30, 45, 60];

export class CreateTopicDto {
  @IsNumber()
  @Type(() => Number)
  sectionId: number;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @IsIn(VALID_TIMES)
  @Type(() => Number)
  timePerQuestionSec?: number;

  @IsOptional()
  @IsNumber()
  @IsIn([3, 4])
  @Type(() => Number)
  optionsCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  dailyAttemptLimit?: number;

  @IsOptional()
  @IsBoolean()
  isLockedByDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  unlockRequiredTopic?: number;
}
