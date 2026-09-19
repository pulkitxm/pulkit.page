import process from "node:process";
import type { Environment } from "../types.ts";

export interface ServerPort {
  port: number;
  explicit: boolean;
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 0 && port <= 65_535;
}

export function serverPort(env: Environment = process.env): ServerPort {
  const explicit = env.PORT !== undefined && env.PORT !== "";
  const port = Number(explicit ? env.PORT : env.SITE_PORT || 3000);
  if (!isValidPort(port)) {
    throw new Error("PORT must be an integer between 0 and 65535 (0 selects an available port)");
  }
  return { port, explicit };
}
