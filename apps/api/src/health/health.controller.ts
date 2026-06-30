import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../common/public.decorator";
import { PrismaService } from "../common/prisma.service";
import { StorageService } from "../storage/storage.service";

type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};

type ReadinessResponse = {
  status: "ok";
  checks: {
    database: "ok";
    storage: "ok";
  };
  timestamp: string;
};

@Controller("health")
@Public()
export class HealthController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StorageService)
    private readonly storage: StorageService
  ) {}

  @Get()
  health(): HealthResponse {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    };
  }

  @Get("database")
  async database(): Promise<{ status: "ok"; database: "postgresql"; timestamp: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "postgresql",
      timestamp: new Date().toISOString()
    };
  }

  @Get("storage")
  async storageHealth(): Promise<{ status: "ok"; bucket: string; timestamp: string }> {
    const result = await this.storage.assertBucketReady();
    return {
      ...result,
      timestamp: new Date().toISOString()
    };
  }

  @Get("ready")
  async ready(): Promise<ReadinessResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.storage.assertBucketReady();
    return {
      status: "ok",
      checks: {
        database: "ok",
        storage: "ok"
      },
      timestamp: new Date().toISOString()
    };
  }
}
