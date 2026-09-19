import { expect, test } from "bun:test";
import { serverPort } from "./server-port.mjs";

test("prefers 3000 when nothing is set", () => {
  expect(serverPort({})).toEqual({ port: 3000, explicit: false });
});

test("uses the app's preferred port without making it strict", () => {
  expect(serverPort({ SITE_PORT: "3001" })).toEqual({ port: 3001, explicit: false });
});

test("an explicit PORT wins and is strict", () => {
  expect(serverPort({ PORT: "4100", SITE_PORT: "3001" })).toEqual({ port: 4100, explicit: true });
  expect(serverPort({ PORT: "0" })).toEqual({ port: 0, explicit: true });
});

test("an empty PORT falls back to the preferred port", () => {
  expect(serverPort({ PORT: "", SITE_PORT: "3001" })).toEqual({ port: 3001, explicit: false });
});

test("rejects ports outside the valid range", () => {
  for (const PORT of ["-1", "65536", "3.5", "abc"]) {
    expect(() => serverPort({ PORT })).toThrow("PORT must be an integer");
  }
});
