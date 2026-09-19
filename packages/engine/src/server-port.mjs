import process from "node:process";

export function serverPort(env = process.env) {
  const explicit = env.PORT !== undefined && env.PORT !== "";
  const port = Number(explicit ? env.PORT : env.SITE_PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535 (0 selects an available port)");
  }
  return { port, explicit };
}
