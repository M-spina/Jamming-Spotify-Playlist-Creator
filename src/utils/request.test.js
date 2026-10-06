import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./request";
import { deferred, jsonResponse } from "../test/fixtures";
afterEach(() => vi.useRealTimers());
describe("request deadlines and cancellation", () => {
  it("times out even if fetch ignores abort", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const check = expect(requestJson("/test")).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
  });
  it("includes stalled body reading in the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => new Promise(() => {}) }));
    const check = expect(requestJson("/test")).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
  });
  it("distinguishes cancellation from a timeout and removes its timer", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const controller = new AbortController();
    const check = expect(requestJson("/test", {}, [controller.signal])).rejects.toMatchObject({ code: "operation_cancelled" });
    controller.abort();
    await check;
    pending.resolve(jsonResponse({}));
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns a stable network error without logging credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failure")));
    await expect(requestJson("/test")).rejects.toMatchObject({ code: "network_error" });
  });
});
