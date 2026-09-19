export type DemoProps = Readonly<Record<string, unknown>>;

export interface DemoHandle {
  destroy?: () => void;
  replay?: () => void;
}

export type DemoMount = (root: HTMLElement, props: DemoProps) => DemoHandle | undefined;

export interface DemoModule {
  mount: DemoMount;
}

export type DemoLoader = () => Promise<DemoModule>;

export interface FrameOptions {
  focusCode: boolean;
  replayButton: boolean;
  bitBigger: boolean;
  fullHeight: boolean;
}

export interface HighlightedSource {
  filename: string;
  code: string;
  html: string;
}
