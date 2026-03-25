const DAY_BOUNDARY_HOUR = 4;
const DAY_BOUNDARY_MINUTE = 30;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function getGrndDayKey(now = new Date()) {
  const boundary = new Date(now);
  boundary.setHours(DAY_BOUNDARY_HOUR, DAY_BOUNDARY_MINUTE, 0, 0);

  const effective = now < boundary ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;

  const yyyy = effective.getFullYear();
  const mm = pad2(effective.getMonth() + 1);
  const dd = pad2(effective.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function formatHeaderDate(now = new Date()) {
  const dayKey = getGrndDayKey(now);
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);

  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  const day = date.toLocaleDateString(undefined, { day: '2-digit' });
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  return `${weekday} ${day} ${month}`;
}

export function previousDayKey(dayKey: string) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
