export function simulateMainThreadWork(iterations: number): number {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i) * Math.sin(i);
  }
  return sum;
}

export function blockMainThread(duration: number): void {
  const start = performance.now();
  while (performance.now() - start < duration) {
    void (Math.random() * Math.random());
  }
}
