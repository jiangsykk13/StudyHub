import "reflect-metadata";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { loadApiConfig } from "@studyhub/config";
import { AppModule } from "./app.module";
import { SafeErrorFilter } from "./common/safe-error.filter";

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.enableCors({
    origin: [...config.trustedOrigins],
    credentials: true
  });
  app.use(cookieParser());
  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(
    "/api/auth/register",
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "blob:"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"]
            }
          }
        : false
    })
  );
  app.useGlobalFilters(new SafeErrorFilter());

  if (!config.isProduction) {
    const documentConfig = new DocumentBuilder()
      .setTitle("StudyHub API")
      .setDescription("Private student learning-material sharing API")
      .setVersion("0.1.0")
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  await app.listen(config.API_PORT);
}

void bootstrap();
