/** Copilot routes are for the admin on this PC. */
export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
