import "server-only";

/** Deployment configuration only; never derive auth redirects from requests. */
export function getAppOrigin(): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN must be configured for authentication.");
  }
  const url = new URL(configured || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production"))) {
    throw new Error("APP_ORIGIN must be a trusted HTTPS base origin (HTTP localhost is development-only).");
  }
  return url.origin;
}
