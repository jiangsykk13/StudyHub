import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService]
})
export class ResourcesModule {}
