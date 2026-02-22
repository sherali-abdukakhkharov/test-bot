import { Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '@/database/knex.provider';

export abstract class BaseRepository {
  constructor(@Inject(KNEX_CONNECTION) protected readonly db: Knex) {}
}
