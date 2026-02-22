import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

export const knexProvider = {
  provide: KNEX_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Knex => {
    return knex({
      client: 'pg',
      connection: config.get<string>('DATABASE_URL'),
      pool: {
        min: Number(config.get<string>('DATABASE_POOL_MIN')) || 2,
        max: Number(config.get<string>('DATABASE_POOL_MAX')) || 10,
      },
    });
  },
};
