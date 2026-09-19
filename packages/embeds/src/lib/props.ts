import type { EmbedProps } from "../types.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRecord(value: unknown, label: string): EmbedProps {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

export function readString(props: EmbedProps, key: string, embed: string): string {
  const value = props[key];
  if (typeof value !== "string") {
    throw new Error(`${embed} needs a string ${key}`);
  }
  return value;
}

export function optionalString(props: EmbedProps, key: string, embed: string): string | undefined {
  const value = props[key];
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${embed} ${key} must be a string`);
  }
  return value;
}

export function optionalNumber(props: EmbedProps, key: string, embed: string): number | undefined {
  const value = props[key];
  if (value !== undefined && typeof value !== "number") {
    throw new Error(`${embed} ${key} must be a number`);
  }
  return value;
}

export function optionalCount(
  props: EmbedProps,
  key: string,
  embed: string,
): string | number | undefined {
  const value = props[key];
  if (value !== undefined && typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${embed} ${key} must be a string or number`);
  }
  return value;
}

export function readList(props: EmbedProps, key: string, embed: string): readonly unknown[] {
  const value = props[key];
  if (!Array.isArray(value)) {
    throw new Error(`${embed} needs a ${key} array`);
  }
  return value;
}

export function readRecords(props: EmbedProps, key: string, embed: string): EmbedProps[] {
  return readList(props, key, embed).map((entry) => readRecord(entry, `${embed} ${key} entry`));
}

export function readStrings(props: EmbedProps, key: string, embed: string): string[] {
  return readList(props, key, embed).map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`${embed} ${key} entries must be strings`);
    }
    return entry;
  });
}
