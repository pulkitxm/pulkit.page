type Tick = (time: number, delta: number) => void;

const subscribers = new Set<Tick>();
let frame = 0;
let last = 0;

function step(time: number): void {
  const delta = last ? Math.min(64, time - last) : 16;
  last = time;
  for (const subscriber of subscribers) {
    subscriber(time, delta);
  }
  frame = subscribers.size > 0 ? requestAnimationFrame(step) : 0;
}

export function onTick(subscriber: Tick): () => void {
  subscribers.add(subscriber);
  if (!frame) {
    last = 0;
    frame = requestAnimationFrame(step);
  }
  return () => {
    subscribers.delete(subscriber);
  };
}
