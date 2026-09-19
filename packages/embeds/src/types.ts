export type EmbedProps = Readonly<Record<string, unknown>>;

export type EscapeHtml = (value: unknown) => string;

export interface PageAssets {
  style(href: string): void;
  script(src: string): void;
  claim(key: string): boolean;
  tags(): string;
}

export interface EmbedContext {
  assets: PageAssets;
  inline: boolean;
  escapeHtml: EscapeHtml;
}

export type EmbedRenderer = (props: EmbedProps, context: EmbedContext) => string;

export interface EmbedMatch {
  raw: string;
  name: string;
  props: EmbedProps;
}

export interface Size {
  width: number;
  height: number;
}
