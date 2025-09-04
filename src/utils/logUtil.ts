/**
 * Log level
 */
enum LogLevel {
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4
}

const levelNames: Record<LogLevel, string> = {
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warn]: 'WARN',
  [LogLevel.Error]: 'ERROR'
};

const consoleMethod: Record<LogLevel, (...data: any[]) => void> = {
  // debug is hidden by default by the browser
  // [LogLevel.Debug]: console.debug,
  [LogLevel.Debug]: console.log,
  [LogLevel.Info]: console.info,
  [LogLevel.Warn]: console.warn,
  [LogLevel.Error]: console.error
};

interface Trace {
  // Calling function
  caller: string;
  // File path
  location: string;
}

interface LogData {
  // Log header
  header: string;
  // Style
  style: string;
  // Output data
  args: any[];
}

const styles = {
  [LogLevel.Debug]: 'color: #6b798e',
  [LogLevel.Info]: 'color: #4994c4',
  [LogLevel.Warn]: 'color: #e9c46a',
  [LogLevel.Error]: 'color: #e94829'
};

interface LoggerConfig {
  prefix?: string;
  level?: LogLevel;
  // Whether to output the stack
  trace?: boolean;
  // Whether it is available
  enabled?: boolean;
}

/**
 * Self-encapsulated logging tool
 */
class Logger {
  /** Configuration */
  private prefix: string;
  private enabled: boolean;
  private level: LogLevel;
  private trace: boolean;

  /**
   * Logging tool
   */
  constructor(config: LoggerConfig = {}) {
    this.prefix = config.prefix || '';
    this.enabled = config.enabled ?? true;
    this.level = config.level ?? LogLevel.Debug;
    this.trace = config.trace ?? true;
  }

  /**
   * Set log level
   * @param level
   */
  public setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * Set whether to output the call stack
   * @param flag
   */
  public setTrace(flag: boolean) {
    this.trace = flag;
  }

  /**
   * Get the call stack
   * @returns
   */
  private getTrace(origin?: string) {
    if (!origin) return null;
    const lines = origin.split('\n').map(l => l.trim());
    // 0: Error
    // 1: at Logger.getCallTrace ···
    // 2: at Logger.getLogPrefix ···
    // 3: at Logger._log ···
    // 4: at Logger.debug ···
    // 5: user code ···
    const stacks: Trace[] = [];
    lines.forEach(s => {
      let matchArray = s.match(/at (.+?) \((.+?)\)/);
      if (!matchArray) return;
      let name = matchArray[1];
      let location = matchArray[2];
      stacks.push({ caller: name, location });
    });
    if (stacks.length > 3) return stacks.slice(3);
    else return null;
  }


  /** Get call stack */
  private getCallTrace() {
    const origin = new Error().stack;
    const stacks = this.getTrace(origin);
    if (!stacks) return 'unknown';
    const stack = stacks[1] || stacks[0];
    return stack.caller;
  }

  /** Whether to output */
  private isLog(level: LogLevel) {
    return this.enabled && level >= this.level;
  }

  /** Get output prefix */
  private getLogPrefix(level: LogLevel) {
    const time = this.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    const prefixText = this.prefix ? `[${this.prefix}] ` : '';
    const LEVEL = `   ${levelNames[level]}`.slice(-7);
    const stack = this.trace ? ` --- [${this.getCallTrace()}]` : '';
    // Log header
    const header = `%c${prefixText}${time} ${LEVEL}${stack}:`;
    // Style
    const style = styles[level];
    return [header, style];
  }

  /**
   * Output log
   * @param level
   * @param message
   */
  private _log(level: LogLevel, args: any[]) {
    if (!this.isLog(level)) return;
    const [header, style] = this.getLogPrefix(level);
    // Output console
    this._console(level, {
      header,
      style,
      args
    });
    // Can be extended to save files
    // ··· ···
  }

  /**
   * Output to console
   */
  private _console(level: LogLevel, data: LogData) {
    const { header, style, args } = data;
    const _printMethod = consoleMethod?.[level] || console.log;
    _printMethod(header, style, ...args);
  }

  /**
   * Record to file
   * @param level
   * @param data
   */
  private _printFile(level: LogLevel, data: LogData) {
    // Record to log file
  }

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
  private formatDate(date: Date, format: string = 'HH:mm') {
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
  }

  /**
   * Development log
   * @param message
   */
  public debug(...message: any[]) {
    this._log(LogLevel.Debug, message);
  }

  /**
   * Message log
   * @param params
   */
  public info(...message: any[]) {
    this._log(LogLevel.Info, message);
  }

  /**
   * Warning log
   * @param params
   */
  public warn(...message: any[]) {
    this._log(LogLevel.Warn, message);
  }

  /**
   * Error log
   * @param params
   */
  public error(...message: any[]) {
    this._log(LogLevel.Error, message);
  }
}

function test() {
  const MLog = new Logger({ prefix: 'dycast' });
  MLog.debug('debug message');
  MLog.info('info message');
  MLog.warn('warning message');
  MLog.error('error message');
}

/**
 * Output tag
 * @param tip
 * @param link
 * @param color
 */
export const printInfo = function (
  tip: string = 'Douyin Cast',
  link: string = 'https://github.com/skmcj/dycast',
  color: string = '#fe2c55'
) {
  console.log(
    `%c ${tip} %c ${link}`,
    `color:white;background:${color};padding:5px 0;border-radius: 5px 0 0 5px;`,
    `padding:4px;border:1px solid ${color};border-radius: 0 5px 5px 0;`
  );
};

export const printSKMCJ = function () {
  const info = `
 ________  ___  __    _____ ______   ________        ___     
|\\   ____\\|\\  \\|\\  \\ |\\   _ \\  _   \\|\\   ____\\      |\\  \\    
\\ \\  \\___|\\ \\  \\/  /|\\ \\  \\\\\\__\\ \\  \\ \\  \\___|      \\ \\  \\   
 \\ \\_____  \\ \\   ___  \\ \\  \\\\|__| \\  \\ \\  \\       __ \\ \\  \\  
  \\|____|\\  \\ \\  \\\\ \\  \\ \\  \\    \\ \\  \\ \\  \\____ |\\  \\\\_\\  \\ 
    ____\\_\\  \\ \\__\\\\ \\__\\ \\__\\    \\ \\__\\ \\_______\\ \\________\\
   |\\_________\\|__| \\|__|\\|__|     \\|__|\\|_______|\\|________|
   \\|_________|
  `;
  console.log(`%c${info}`, `color: #00faf0`);
};

export const CLog = new Logger({ prefix: 'dycast' });
// RLog.setLevel(LogLevel.error);
