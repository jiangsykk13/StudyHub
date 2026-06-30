import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
export class FavoritesController {
  constructor(@Inject(FavoritesService) private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentAuth() auth: RequestAuth) {
    return this.favoritesService.list(auth);
  }

  @Post()
  add(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    return this.favoritesService.add(auth, body);
  }

  @Post("remove")
  remove(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    return this.favoritesService.remove(auth, body);
  }
}
