import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma.module";
import { NotesModule } from "../notes/notes.module";
import { ResourcesModule } from "../resources/resources.module";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [PrismaModule, ResourcesModule, NotesModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService]
})
export class FavoritesModule {}
