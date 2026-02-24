import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnswerOptionDto {
  @IsString()
  bodyText: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;
}

export class CreateQuestionDto {
  @IsNumber()
  @Type(() => Number)
  topicId: number;

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

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => CreateAnswerOptionDto)
  options: CreateAnswerOptionDto[];
}
