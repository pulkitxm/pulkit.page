export interface FrameOptions {
  src: string;
  title: string | undefined;
  className: string | undefined;
  allow?: string | undefined;
  sandbox?: string | undefined;
  referrerPolicy?: ReferrerPolicy;
  lazy?: boolean;
  allowFullscreen?: boolean;
}

export function createFrame(options: FrameOptions): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.title = options.title ?? "";
  frame.className = options.className ?? "";
  if (options.sandbox !== undefined) {
    frame.setAttribute("sandbox", options.sandbox);
  }
  if (options.allow !== undefined) {
    frame.setAttribute("allow", options.allow);
  }
  if (options.referrerPolicy !== undefined) {
    frame.referrerPolicy = options.referrerPolicy;
  }
  if (options.lazy) {
    frame.loading = "lazy";
  }
  if (options.allowFullscreen) {
    frame.allowFullscreen = true;
  }
  frame.src = options.src;
  return frame;
}
