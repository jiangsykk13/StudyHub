import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

type SafeError = {
  code: string;
  message: string;
};

@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.toSafeError(exception, status);
    response.status(status).json(payload);
  }

  private toSafeError(exception: unknown, status: number): SafeError {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null && "message" in body) {
        return {
          code: `HTTP_${status}`,
          message: Array.isArray(body.message) ? body.message.join("; ") : String(body.message)
        };
      }
      return {
        code: `HTTP_${status}`,
        message: exception.message
      };
    }

    return {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    };
  }
}
