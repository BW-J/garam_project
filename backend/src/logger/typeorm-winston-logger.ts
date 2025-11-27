import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Logger as WinstonLogger } from 'winston';

export class TypeOrmWinstonLogger implements TypeOrmLogger {
  constructor(private readonly logger: WinstonLogger) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.logger.debug(
      `Query: ${query} -- Parameters: ${JSON.stringify(parameters)}`,
    );
  }

  logQueryError(
    error: string,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    this.logger.error(
      `Query Error: ${error} -- Query: ${query} -- Parameters: ${JSON.stringify(parameters)}`,
    );
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    this.logger.warn(
      `Slow Query (${time} ms): ${query} -- Parameters: ${JSON.stringify(parameters)}`,
    );
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    this.logger.debug(message);
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    this.logger.debug(message);
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    switch (level) {
      case 'log':
        this.logger.debug(message);
        break;
      case 'info':
        this.logger.info(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
    }
  }
}
