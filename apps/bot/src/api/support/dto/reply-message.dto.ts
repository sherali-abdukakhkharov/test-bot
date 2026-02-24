import { IsString, IsOptional } from 'class-validator';

export class ReplyMessageDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;
}
