import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../common/prisma.module";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminResourcesController } from "./admin-resources.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminUsersController, AdminResourcesController, AdminAuditController],
  providers: [AdminService]
})
export class AdminModule {}
