import { elements } from "../lib/env.ts";

const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function startChrome(): void {
  const clocks = elements("[data-clock]", HTMLTimeElement);
  if (clocks.length === 0) {
    return;
  }
  const tick = () => {
    const now = new Date();
    for (const clock of clocks) {
      clock.textContent = `${time.format(now)} IST`;
      clock.dateTime = now.toISOString();
    }
  };
  tick();
  setInterval(tick, 30000);
}
