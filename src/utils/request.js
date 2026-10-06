export class OperationCancelledError extends Error {
  constructor() {
    super("This operation was cancelled.");
    this.name = "OperationCancelledError";
    this.code = "operation_cancelled";
  }
}

export function assertNotCancelled(signal) {
  if (signal?.aborted) throw new OperationCancelledError();
}

export function isCancellation(error) {
  return error instanceof OperationCancelledError || error?.name === "AbortError";
}

// Race explicitly as well as aborting fetch: mocks or transports may ignore abort.
export async function requestJson(url, options = {}, signals = []) {
  const controller = new AbortController();
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const cancel = () => controller.abort(new OperationCancelledError());
  const onAbort = () => rejectAbort(controller.signal.reason);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  }
  const timeout = setTimeout(() => {
    const error = new Error("Spotify took too long to respond. Please try again.");
    error.code = "request_timeout";
    controller.abort(error);
  }, 15_000);

  try {
    const task = (async () => {
      assertNotCancelled(controller.signal);
      const response = await fetch(url, { ...options, signal: controller.signal });
      let body;
      let bodyValid = true;
      try {
        body = await response.json();
        bodyValid = Boolean(body && typeof body === "object");
      } catch {
        bodyValid = false;
      }
      return { response, body: bodyValid ? body : {}, bodyValid };
    })();
    return await Promise.race([task, aborted]);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    const networkError = new Error("Could not reach Spotify. Check your connection and try again.", { cause: error });
    networkError.code = "network_error";
    throw networkError;
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", onAbort);
    for (const signal of signals.filter(Boolean)) signal.removeEventListener("abort", cancel);
  }
}
