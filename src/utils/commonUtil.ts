/**
 * Format date
 * @param date {Date} Date
 * @param format {string} Format string
 *   - y:year, M:month, d:day
 *   - h:hour(12), H:hour(24), m:minute, s:second
 *   - q:quarter, a:morning|afternoon, A:AM|PM
 *   - w:week(EN), W:week(CN)
 *   - Example: 'yyyy-MM-dd W' = '1970-01-01 Thursday'
 */
export const formatDate = function (date: Date, format: string = 'HH:mm') {
  const re = /(y+)/;
  if (re.test(format)) {
    const t = re.exec(format)![1];
    format = format.replace(t, (date.getFullYear() + '').substring(4 - t.length));
  }
  const CW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const o: Record<string, number | string> = {
    'M+': date.getMonth() + 1, // Month
    'd+': date.getDate(), // Day
    'h+': date.getHours() % 12 === 0 ? 12 : date.getHours() % 12, // Hour[12]
    'H+': date.getHours(), // Hour[24]
    'm+': date.getMinutes(), // Minute
    's+': date.getSeconds(), // Second
    'q+': Math.floor((date.getMonth() + 3) / 3), // Quarter
    'S+': date.getMilliseconds(), // Millisecond
    a: date.getHours() < 12 ? 'morning' : 'afternoon', // morning/afternoon
    A: date.getHours() < 12 ? 'AM' : 'PM', // AM/PM
    w: EW[date.getDay()],
    W: CW[date.getDay()]
  };
  for (let k in o) {
    const regx = new RegExp('(' + k + ')');
    if (regx.test(format)) {
      const t = regx.exec(format)![1];
      format = format.replace(t, t.length === 1 ? `${o[k]}` : `00${o[k]}`.slice(t.length * -1));
    }
  }
  return format;
};
