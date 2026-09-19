import type { DemoProps, FrameOptions } from "../client/types.ts";

export interface ShowcaseFile {
  filename: string;
  language: string;
  code: string;
}

export interface Showcase {
  component: string;
  props: DemoProps;
  frame: FrameOptions;
  files: ShowcaseFile[];
  heavy: boolean;
}

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) {
    throw new TypeError(`Demo showcase ${field} must be an object`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Demo showcase ${field} must be a string`);
  }
  return value;
}

function file(value: unknown, index: number): ShowcaseFile {
  const entry = record(value, `files[${index}]`);
  return {
    filename: text(entry.filename, `files[${index}].filename`),
    language: text(entry.language, `files[${index}].language`),
    code: text(entry.code, `files[${index}].code`),
  };
}

export function parseShowcase(value: unknown): Showcase {
  const data = record(value, "root");
  const frame = record(data.frame, "frame");
  if (!Array.isArray(data.files)) {
    throw new TypeError("Demo showcase files must be an array");
  }
  return {
    component: text(data.component, "component"),
    props: record(data.props, "props"),
    frame: {
      focusCode: frame.focusCode === true,
      replayButton: frame.replayButton === true,
      bitBigger: frame.bitBigger === true,
      fullHeight: frame.fullHeight === true,
    },
    files: data.files.map(file),
    heavy: data.heavy === true,
  };
}
