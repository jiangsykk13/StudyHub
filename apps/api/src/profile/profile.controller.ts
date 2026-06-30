import { Controller, Get, Inject } from "@nestjs/common";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { ProfileService } from "./profile.service";

@Controller("profile")
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profileService: ProfileService) {}

  @Get("summary")
  summary(@CurrentAuth() auth: RequestAuth) {
    return this.profileService.summary(auth);
  }
}
