import { BadRequestException } from "@nestjs/common";
import type { ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      message: result.error.issues.map((issue) => issue.message).join("; ")
    });
  }
  return result.data;
}
