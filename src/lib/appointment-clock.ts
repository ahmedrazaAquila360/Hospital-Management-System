export function appointmentClock(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
export function appointmentMinutes(date: Date, timeZone: string) {
  const [h,m] = appointmentClock(date,timeZone).split(":").map(Number);
  return h * 60 + m;
}
