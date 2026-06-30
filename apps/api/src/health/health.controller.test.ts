import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns API health", () => {
    const result = new HealthController(
      { $queryRaw: () => Promise.resolve(1) } as never,
      { assertBucketReady: () => Promise.resolve({ bucket: "test", status: "ok" }) } as never
    ).health();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("api");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("checks database and storage readiness", async () => {
    const result = await new HealthController(
      { $queryRaw: () => Promise.resolve(1) } as never,
      { assertBucketReady: () => Promise.resolve({ bucket: "test", status: "ok" }) } as never
    ).ready();
    expect(result).toMatchObject({
      status: "ok",
      checks: {
        database: "ok",
        storage: "ok"
      }
    });
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });
});
