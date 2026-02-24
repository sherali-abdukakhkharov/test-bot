import { IsString, IsOptional } from 'class-validator';

export class CreateAnnouncementDto {
  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;
}
