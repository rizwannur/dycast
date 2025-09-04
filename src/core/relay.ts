import { Emitter, type EventMap } from './emitter';

interface RelayCastEvent extends EventMap {
  open: (ev: Event) => void;
  close: (code?: number, msg?: string) => void;
  error: (ev: Error) => void;
  message: (data: any) => void;
}

/**
 * Barrage forwarder
 *  - Simple encapsulation, optimize if there are problems
 */
export class RelayCast {
  private url: string;

  private ws: WebSocket | undefined;

  private emitter: Emitter<RelayCastEvent>;

  constructor(url: string) {
    this.url = url;
    this.emitter = new Emitter();
  }

  /**
   * Listen
   * @param event
   * @param listener
   */
  public on<K extends keyof RelayCastEvent>(event: K, listener: RelayCastEvent[K]) {
    this.emitter.on(event, listener);
  }

  /**
   * Cancel listening
   * @param event
   * @param listener
   */
  public off<K extends keyof RelayCastEvent>(event: K, listener: RelayCastEvent[K]) {
    this.emitter.off(event, listener);
  }

  /**
   * One-time listening
   *  - Such as listening for open and close
   * @param event
   * @param listener
   */
  public once<K extends keyof RelayCastEvent>(event: K, listener: RelayCastEvent[K]) {
    this.emitter.once(event, listener);
  }

  /**
   * Connect
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener('open', ev => {
        this.emitter.emit('open', ev);
      });
      this.ws.addEventListener('close', ev => {
        this.emitter.emit('close', ev.code, ev.type);
      });
      this.ws.addEventListener('error', ev => {
        this.emitter.emit('error', Error(ev.type));
      });
      this.ws.addEventListener('message', ev => {
        this.emitter.emit('message', ev.data);
      });
    } catch (err) {
      this.emitter.emit('error', Error('Forwarding server connection error'));
      this.emitter.emit('close', 4002);
    }
  }

  /**
   * Whether to connect
   */
  isConnected() {
    if (this.ws) return this.ws.readyState === WebSocket.OPEN;
    else return false;
  }

  /**
   * Send message
   * @param data
   */
  send(data: string | ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
  }

  /**
   * Close forwarding
   * @param code
   * @param msg
   */
  close(code: number = 1000, msg: string = 'close replay') {
    if (this.ws) {
      this.ws.close(code, msg);
      this.ws = void 0;
    }
  }
}
