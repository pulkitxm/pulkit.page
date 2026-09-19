import type { DemoProps, FrameOptions, HighlightedSource } from "../types.ts";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(text: string | undefined): Readonly<Record<string, unknown>> {
  const value: unknown = JSON.parse(text ?? "{}");
  return isRecord(value) ? value : {};
}

function isHighlightedSource(value: unknown): value is HighlightedSource {
  return (
    isRecord(value) &&
    typeof value.filename === "string" &&
    typeof value.code === "string" &&
    typeof value.html === "string"
  );
}

export function parseFrame(text: string | undefined): FrameOptions {
  const frame = parseRecord(text);
  return {
    focusCode: frame.focusCode === true,
    replayButton: frame.replayButton === true,
    bitBigger: frame.bitBigger === true,
    fullHeight: frame.fullHeight === true,
  };
}

export function parseProps(text: string | undefined): DemoProps {
  return parseRecord(text);
}

export function parseSources(text: string | null | undefined): HighlightedSource[] {
  const value: unknown = JSON.parse(text ?? "[]");
  return Array.isArray(value) ? value.filter(isHighlightedSource) : [];
}
