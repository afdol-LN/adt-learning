import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS_ORIGINS: comma-separated list, e.g. "https://my-app.vercel.app,http://localhost:5173"
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174'
  )
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  // app.useGlobalPipes(
  //   new ValidationPipe({ whitelist: true, transform: true }),
  // );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ADT Learning API')
    .setDescription('API documentation for the ADT Learning backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
