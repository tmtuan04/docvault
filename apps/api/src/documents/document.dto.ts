import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from '@document-saas/shared';

export class CreateUploadUrlDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsIn([...ALLOWED_UPLOAD_MIME_TYPES])
  mimeType!: (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsUUID()
  folderId?: string;
}

export class CompleteUploadDto {
  @IsUUID()
  documentId!: string;

  @IsUUID()
  documentVersionId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  checksum!: string;
}

export class SearchDocumentsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ChatDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  topK?: number;
}
