import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { CsrfGuard } from "./auth/csrf.guard";
import { PrismaModule } from "./common/prisma.module";
import { CoursesModule } from "./courses/courses.module";
import { HealthModule } from "./health/health.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { NotesModule } from "./notes/notes.module";
import { ProfileModule } from "./profile/profile.module";
import { ResourcesModule } from "./resources/resources.module";
import { SemestersModule } from "./semesters/semesters.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    SemestersModule,
    CoursesModule,
    InvitationsModule,
    ResourcesModule,
    NotesModule,
    FavoritesModule,
    ProfileModule,
    AdminModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ]
})
export class AppModule {}
