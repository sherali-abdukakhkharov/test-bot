import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { AdminJwtGuard } from '@/api/auth/admin-jwt.guard';
import { QuestionRepository } from '@/repositories/question.repository';
import type { QuestionRow, AnswerOptionRow } from '@/repositories/question.repository';
import type { QuestionDto, AnswerOptionDto } from '@arab-tili/shared-types';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto, UpdateAnswerOptionDto } from './dto/update-question.dto';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionRepo: QuestionRepository) {}

  @Get()
  async findAll(
    @Query('topicId', ParseIntPipe) topicId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<{ data: QuestionDto[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const { rows, total } = await this.questionRepo.findByTopicPaginated(topicId, pageNum, limitNum);
    return {
      data: rows.map(this.toDto),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Post()
  async create(@Body() dto: CreateQuestionDto): Promise<QuestionDto> {
    if (!dto.bodyText && !dto.mediaFileId) {
      throw new BadRequestException('bodyText or mediaFileId is required');
    }
    const correctCount = dto.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException('Exactly one correct answer is required');
    }
    const row = await this.questionRepo.create(
      {
        topic_id: dto.topicId,
        body_text: dto.bodyText ?? null,
        media_type: dto.mediaType ?? null,
        media_file_id: dto.mediaFileId ?? null,
        sort_order: dto.sortOrder ?? 0,
        is_deleted: false,
      },
      dto.options.map((o, i) => ({
        body_text: o.bodyText,
        is_correct: o.isCorrect,
        sort_order: o.sortOrder ?? i,
      })),
    );
    const withOpts = await this.questionRepo.findWithOptions(row.id);
    return this.toDto(withOpts!);
  }

  @Post('bulk-import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ];
        cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx'));
      },
    }),
  )
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('topicId', ParseIntPipe) topicId: number,
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    if (!file) throw new BadRequestException('File is required');

    const rows = await this.parseFile(file);
    const items: Array<{
      question: Omit<QuestionRow, 'id' | 'created_at' | 'updated_at'>;
      options: Array<{ body_text: string; is_correct: boolean; sort_order: number }>;
    }> = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row
      if (!row || row.length < 3) {
        errors.push(`Satr ${rowNum}: kamida 3 ustun kerak (savol, to'g'ri javob, variant2)`);
        continue;
      }

      const [questionText, correctAnswer, ...rest] = row.map((c: string) => String(c ?? '').trim());

      if (!correctAnswer) {
        errors.push(`Satr ${rowNum}: to'g'ri javob bo'sh`);
        continue;
      }

      const otherOptions = rest.filter((o) => o && o !== '/skip');
      const allOptions = [correctAnswer, ...otherOptions];

      if (allOptions.length < 2) {
        errors.push(`Satr ${rowNum}: kamida 2 ta variant kerak`);
        continue;
      }

      // Shuffle options so correct answer is not always first
      const optionsData = allOptions.map((text, idx) => ({
        body_text: text,
        is_correct: idx === 0,
        sort_order: idx,
      }));
      // Simple shuffle
      for (let j = optionsData.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [optionsData[j], optionsData[k]] = [optionsData[k], optionsData[j]];
      }
      // Fix sort_order after shuffle
      optionsData.forEach((o, idx) => { o.sort_order = idx; });

      items.push({
        question: {
          topic_id: topicId,
          body_text: questionText || null,
          media_type: null,
          media_file_id: null,
          sort_order: items.length,
          is_deleted: false,
        },
        options: optionsData,
      });
    }

    let imported = 0;
    if (items.length > 0) {
      imported = await this.questionRepo.bulkCreate(items);
    }

    return { imported, failed: errors.length, errors };
  }

  @Patch('answer-options/:optionId')
  async updateOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateAnswerOptionDto,
  ): Promise<{ success: boolean }> {
    const data: Partial<AnswerOptionRow> = {};
    if (dto.bodyText !== undefined) data.body_text = dto.bodyText;
    if (dto.isCorrect !== undefined) data.is_correct = dto.isCorrect;
    await this.questionRepo.updateOption(optionId, data);
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ): Promise<{ success: boolean }> {
    const data: Partial<QuestionRow> = {};
    if (dto.bodyText !== undefined) data.body_text = dto.bodyText;
    if (dto.mediaType !== undefined) data.media_type = dto.mediaType;
    if (dto.mediaFileId !== undefined) data.media_file_id = dto.mediaFileId;
    if (dto.sortOrder !== undefined) data.sort_order = dto.sortOrder;
    await this.questionRepo['db']('questions').where({ id }).update({ ...data, updated_at: this.questionRepo['db'].fn.now() });
    return { success: true };
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.questionRepo.softDelete(id);
    return { success: true };
  }

  private async parseFile(file: Express.Multer.File): Promise<string[][]> {
    if (file.originalname.endsWith('.csv') || file.mimetype === 'text/csv') {
      const text = file.buffer.toString('utf-8');
      const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
      // Skip header row
      return result.data.slice(1);
    }

    // Excel
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    const rows: string[][] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const values = (row.values as (string | null | undefined)[])
        .slice(1)
        .map((v) => String(v ?? '').trim());
      rows.push(values);
    });
    return rows;
  }

  private toDto(row: QuestionRow & { options?: AnswerOptionRow[] }): QuestionDto {
    return {
      id: row.id,
      topicId: row.topic_id,
      bodyText: row.body_text,
      mediaType: row.media_type,
      mediaFileId: row.media_file_id,
      sortOrder: row.sort_order,
      isDeleted: row.is_deleted,
      createdAt: row.created_at?.toISOString() ?? '',
      options: (row.options ?? []).map((o) => ({
        id: o.id,
        questionId: o.question_id,
        bodyText: o.body_text,
        isCorrect: o.is_correct,
        sortOrder: o.sort_order,
      }) as AnswerOptionDto),
    };
  }
}
