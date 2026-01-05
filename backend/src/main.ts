import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

async function bootstrap() {
  const allowedOrigins = [
    'http://localhost:5173', // 로컬 개발용
    'http://localhost', // 로컬 개발용
    'http://garamga.kr',
    'http://13.124.216.40',
    'http://www.garamga.kr',
    'http://192.168.0.25:5173',
  ];

  const logPath = process.env.LOG_PATH || './logs';

  const winstonLogger = WinstonModule.createLogger({
    transports: [
      // 1. 콘솔 로그 설정 (기존 NestJS 로그와 유사하게)
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize({ all: true }),
          winston.format.printf(
            (info) =>
              `[Nest] ${info.timestamp}  ${info.level}: [${info.context || 'App'}] ${info.message}`,
          ),
        ),
      }),

      // 2. 일별 파일 로그 (모든 로그 - info 레벨 이상)
      new winston.transports.DailyRotateFile({
        level: 'debug',
        filename: `${logPath}/%DATE%/combined.log`, // 년/월 단위 폴더 자동 생성을 위해 %DATE% 사용
        datePattern: 'YYYY-MM', // 년/월 단위로 폴더 생성
        zippedArchive: true,
        maxSize: '20m', // 20MB 초과 시 파일 분리
        maxFiles: '12m', // 1년 (12개월) 보관
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(), // 파일 로그는 JSON 형식으로 저장
        ),
      }),

      // 3. 일별 파일 로그 (에러만)
      new winston.transports.DailyRotateFile({
        level: 'error',
        filename: `${logPath}/%DATE%/error.log`, // 년/월 폴더
        datePattern: 'YYYY-MM',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '12m', // 1년 보관
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: function (origin, callback) {
        // origin이 undefined인 경우 (예: 서버 간 요청) 허용
        if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // 쿠키 전송 허용
    },
    logger: winstonLogger,
  });

  // 보안/성능
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성은 자동 제거
      forbidNonWhitelisted: false, // DTO에 없는 속성 들어오면 예외 발생
      skipNullProperties: true,
      transform: true, // 요청 JSON을 DTO 클래스 인스턴스로 변환
      transformOptions: {
        enableImplicitConversion: true, // 문자열->숫자 등 자동 형변환 허용
      },
    }),
  );

  // 전역 예외 필터
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('SYSTEM API')
    .setDescription('Admin/User/System APIs')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  // 전역 로깅 인터셉터
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
