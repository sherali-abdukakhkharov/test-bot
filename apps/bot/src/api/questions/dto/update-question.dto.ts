import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateAnswerOptionDto {
  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @Type(() => Boolean)
  isCorrect?: boolean;
}
