import { CLog } from '@/utils/logUtil';
import { Emitter, type EventMap } from './emitter';
import pako from 'pako';
import {
  decodeChatMessage,
  decodeControlMessage,
  decodeEmojiChatMessage,
  decodeGiftMessage,
  decodeLikeMessage,
  decodeMemberMessage,
  decodePushFrame,
  decodeResponse,
  decodeRoomRankMessage,
  decodeRoomStatsMessage,
  decodeRoomUserSeqMessage,
  decodeSocialMessage,
  encodePushFrame
} from './model';
import type {
  GiftStruct,
  Message,
  RoomRankMessage_RoomRank,
  RoomUserSeqMessage_Contributor,
  Text,
  User
} from './model';
import { getImInfo, getLiveInfo } from './request';
import { getSignature } from './signature';
import { logUserCast } from '@/utils/debugUtil';

/**
 * Connection status
 *  - 0 - Not connected
 *  - 1 - Connecting (connection complete)
 *  - 2 - Connection failed
 *  - 3 - Disconnected
 */
export type ConnectStatus = 0 | 1 | 2 | 3;

/** Live room information */
export interface LiveRoom {
  /**
   * Number of online viewers
   */
  audienceCount?: number | string;
  /**
   * Number of likes in this session
   */
  likeCount?: number | string;
  /**
   * Number of anchor's fans
   */
  followCount?: number | string;
  /**
   * Cumulative number of viewers
   */
  totalUserCount?: number | string;
  /** Room status */
  status?: number;
}

/** Live room information - connection information */
export interface DyLiveInfo {
  roomNum?: string;
  roomId: string;
  uniqueId: string;
  avatar: string;
  cover: string;
  nickname: string;
  title: string;
  status: number;
}
/** Live room information - initial connection information */
export interface DyImInfo {
  cursor?: string;
  fetchInterval?: string;
  now?: string;
  internalExt?: string;
  fetchType?: number;
  pushServer?: string;
  liveCursor?: string;
}

/**
 * Gift and like ranking
 */
export interface LiveRankItem {
  nickname: string;
  avatar: string;
  rank: number | string;
}

export interface CastUser {
  // user.sec_uid | user.id_str
  id?: string;
  // user.nickname
  name?: string;
  // user.avatar_thumb.url_list.0
  avatar?: string;
  // Gender 0 | 1 | 2 => Unknown | Male | Female
  gender?: number;
}

export interface CastGift {
  id?: string;
  name?: string;
  // Douyin coin diamond_count
  price?: number;
  type?: number;
  // Description
  desc?: string;
  // Image
  icon?: string;
  // Quantity repeat_count | combo_count
  count?: number | string;
  // Gift messages may be sent repeatedly, 0 means the first time, not repeated
  repeatEnd?: number;
}

/**
 * Rich text type
 *  1 - Plain text
 *  2 - Combined emoji
 */
export enum CastRtfContentType {
  TEXT = 1,
  EMOJI = 2,
  USER = 3
}

// Rich text
export interface CastRtfContent {
  type?: CastRtfContentType;
  text?: string;
  url?: string;
  user?: CastUser;
}

export interface DyMessage {
  id?: string;
  method?: CastMethod;
  user?: CastUser;
  gift?: CastGift;
  content?: string;
  rtfContent?: CastRtfContent[];
  room?: LiveRoom;
  rank?: LiveRankItem[];
}

export enum CastMethod {
  CHAT = 'WebcastChatMessage',
  GIFT = 'WebcastGiftMessage',
  LIKE = 'WebcastLikeMessage',
  MEMBER = 'WebcastMemberMessage',
  SOCIAL = 'WebcastSocialMessage',
  ROOM_USER_SEQ = 'WebcastRoomUserSeqMessage',
  CONTROL = 'WebcastControlMessage',
  ROOM_RANK = 'WebcastRoomRankMessage',
  ROOM_STATS = 'WebcastRoomStatsMessage',
  EMOJI_CHAT = 'WebcastEmojiChatMessage',
  FANSCLUB = 'WebcastFansclubMessage',
  ROOM_DATA_SYNC = 'WebcastRoomDataSyncMessage',
  /** Custom message */
  CUSTOM = 'CustomMessage'
}

/**
 * Live room status
 */
export enum RoomStatus {
  PREPARE = 1,
  LIVING = 2,
  PAUSE = 3,
  END = 4
}
/** Client status */
enum WSRoomStatus {
  /** Not connected */
  UNCONNECTED = 1,
  /** Connecting */
  CONNECTING = 2,
  /** Connecting | Connected */
  CONNECTED = 3,
  /** Reconnecting */
  RECONNECTING = 4,
  /** Closed */
  CLOSED = 5
}

/**
 * DyCast Event
 */
interface DyCastEvent extends EventMap {
  /**
   * Listen for ws open
   * @param ev
   * @returns
   */
  open: (ev?: Event, info?: DyLiveInfo) => void;
  /**
   * Listen for close
   * @param code
   * @param reason
   * @returns
   */
  close: (code: number, reason: string) => void;
  /**
   * Listen for error
   * @param e
   * @returns
   */
  error: (e: Error) => void;
  /**
   * Listen for barrage
   * @param messages
   * @returns
   */
  message: (messages: DyMessage[]) => void;
  /** Reconnecting */
  reconnecting: (count?: number, code?: DyCastCloseCode, reason?: string) => void;
  /** Reconnection complete */
  reconnect: (ev?: Event) => void;
}

/**
 * Custom close code
 */
export enum DyCastCloseCode {
  /** Normal closure */
  NORMAL = 1000,
  /** The endpoint is going away, possibly due to a server error or the browser navigating away from the page */
  GOING_AWAY = 1001,
  /** The connection is terminated due to a protocol error */
  PROTOCOL_ERROR = 1002,
  /** The connection is terminated because an unacceptable data type was received */
  UNSUPPORTED = 1003,
  /** No status code was received */
  NO_STATUS = 1005,
  /** No close frame was handled */
  ABNORMAL = 1006,
  /** Application custom status code */
  /** The host has not started broadcasting */
  LIVE_END = 4001,
  /** Connection process error */
  CONNECTING_ERROR = 4002,
  /** Unable to receive information normally */
  CANNOT_RECEIVE = 4003,
  /** Closed due to reconnection */
  RECONNECTING = 4004
}

// Configuration
interface DyCastOptions {
  aid?: string;
  app_name?: string;
  browser_language?: string;
  browser_name?: string;
  browser_online?: boolean;
  browser_platform?: string;
  browser_version?: string;
  compress?: string;
  cookie_enabled?: boolean;
  cursor: string;
  device_platform?: string;
  did_rule?: number;
  endpoint?: string;
  heartbeatDuration?: string;
  host?: string;
  identity?: string;
  im_path?: string;
  insert_task_id?: string;
  internal_ext: string;
  live_id?: number;
  live_reason?: string;
  need_persist_msg_count?: string;
  room_id: string;
  screen_height?: number;
  screen_width?: number;
  signature: string;
  support_wrds?: number;
  tz_name?: string;
  update_version_code?: string;
  user_unique_id: string;
  version_code?: string;
  webcast_sdk_version?: string;
}

interface DyCastCursor {
  cursor?: string;
  firstCursor?: string;
  internalExt?: string;
}

/**
 * dycast custom close message
 */
interface DyCastCloseEvent {
  code: number;
  msg: string;
}

// Message body type
enum PayloadType {
  Ack = 'ack',
  Close = 'close',
  Hb = 'hb',
  Msg = 'msg'
}

/** API */
// const BASE_URL = 'wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/';
const BASE_URL = `${location.origin.replace(/^http/, 'ws')}/socket/webcast/im/push/v2/`;

/** SDK version */
const VERSION = '1.0.14-beta.0';

/**
 * Default configuration
 */
const defaultOpts: Partial<DyCastOptions> = {
  aid: '6383',
  app_name: 'douyin_web',
  browser_language: 'zh-CN',
  browser_name: 'Mozilla',
  browser_online: true,
  browser_platform: 'Win32',
  browser_version:
    '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  compress: 'gzip',
  cookie_enabled: true,
  device_platform: 'web',
  did_rule: 3,
  endpoint: 'live_pc',
  heartbeatDuration: '0',
  host: 'https://live.douyin.com',
  identity: 'audience',
  im_path: '/webcast/im/fetch/',
  insert_task_id: '',
  live_id: 1,
  live_reason: '',
  need_persist_msg_count: '15',
  screen_height: 1080,
  screen_width: 1920,
  support_wrds: 1,
  tz_name: 'Asia/Shanghai',
  update_version_code: VERSION,
  version_code: '180800',
  webcast_sdk_version: VERSION
};

export class DyCast {
  /** Room number */
  private roomNum: string;

  /** Room information */
  private info: DyLiveInfo;

  // Initial connection information
  private imInfo: DyImInfo;

  /** WS client */
  private ws: WebSocket | undefined;

  /** Connection url */
  private url: string | undefined;

  // Connection status
  private state: boolean;

  /** Client status */
  private wsRoomStatus: WSRoomStatus;

  /** Live room status */
  private status: RoomStatus;

  /** Connection configuration */
  private options: DyCastOptions | undefined;

  // Heartbeat
  // Mainly used to check whether message reception is normal
  private heartbeatDuration: number = 10000;
  // Number of heartbeats
  private pingCount: number = 0;
  // Heartbeat threshold
  // If the number of heartbeats within heartbeatDuration ms is greater than or equal to this value, it proves that the message reception is wrong
  // That is, if no new message is received within 10000 ms, it proves that the message reception is wrong
  private downgradePingCount: number = 2;

  private pingTimer: number | undefined = void 0;

  // Last reception time
  private lastReceiveTime: number;

  private cursor: DyCastCursor;

  /**
   * Custom implemented error message prompt
   *  - Because the dycast server does not handle close frames correctly
   *  - After calling websocket close, the close listener returns 1006
   */
  private closeEvent: DyCastCloseEvent;

  /** Current number of reconnections */
  private reconnectCount: number;
  /** Maximum number of reconnection attempts */
  private maxReconnectCount: number;
  // Whether to reconnect
  private shouldReconnect: boolean;
  // Reconnecting
  private isReconnecting: boolean;

  // Subscriber
  private emitter: Emitter<DyCastEvent>;

  constructor(roomNum: string) {
    // Initialization
    this.roomNum = roomNum;
    this.state = !1;
    // 10 second heartbeat
    this.heartbeatDuration = 10000;
    this.pingCount = 0;
    this.downgradePingCount = 2;
    this.cursor = {
      cursor: '',
      firstCursor: '',
      internalExt: ''
    };
    // Current number of reconnections
    this.reconnectCount = 0;
    // Maximum number of reconnections
    this.maxReconnectCount = 3;
    // Last time a message was received
    this.lastReceiveTime = Date.now();
    // Current client status
    this.wsRoomStatus = WSRoomStatus.UNCONNECTED;
    this.shouldReconnect = !1;
    /**
     * Default case
     *  - That is, the expected status code was not received
     */
    this.closeEvent = { code: 1005, msg: 'CLOSE_NO_STATUS' };
    this.info = {
      roomId: '',
      uniqueId: '',
      avatar: '',
      cover: '',
      nickname: '',
      title: '',
      status: 4
    };
    this.imInfo = {};
    this.status = RoomStatus.END;
    this.emitter = new Emitter<DyCastEvent>();
    this.isReconnecting = false;
  }

  /**
   * Listen
   * @param event
   * @param listener
   */
  public on<K extends keyof DyCastEvent>(event: K, listener: DyCastEvent[K]) {
    this.emitter.on(event, listener);
  }

  /**
   * Cancel listening
   * @param event
   * @param listener
   */
  public off<K extends keyof DyCastEvent>(event: K, listener: DyCastEvent[K]) {
    this.emitter.off(event, listener);
  }

  /**
   * One-time listening
   *  - Such as listening for open and close
   * @param event
   * @param listener
   */
  public once<K extends keyof DyCastEvent>(event: K, listener: DyCastEvent[K]) {
    this.emitter.once(event, listener);
  }

  /**
   * Connect
   * @returns
   */
  public async connect() {
    try {
      if (this.state) {
        this.emitter.emit('error', Error('Already connected, please do not connect again'));
        return;
      }
      await this.fetchConnectInfo(this.roomNum);
      const params = this.getWssParam();
      if (this.isLiving()) {
        // Connecting
        this.wsRoomStatus = WSRoomStatus.CONNECTING;
        this._connect(params);
      } else {
        // The host has not started broadcasting
        const liveStatus = this.getLiveStatus();
        this.wsRoomStatus = WSRoomStatus.CLOSED;
        this.emitter.emit('close', DyCastCloseCode.LIVE_END, liveStatus.msg);
      }
    } catch (err) {
      // Process error
      CLog.error('Error before room connection =>', err);
      // Close
      this.emitter.emit('close', DyCastCloseCode.CONNECTING_ERROR, 'Error before room connection');
      this._afterClose();
      // Report error
      this.emitter.emit('error', err as Error);
    }
  }

  /**
   * Get current connection status
   */
  public getRoomStatus() {
    return this.wsRoomStatus;
  }

  /**
   * Actual connection logic
   * @param opts
   */
  private _connect(opts: DyCastOptions) {
    // Initialization before connection
    this.options = opts;
    this.url = this._getSocketUrl(opts);
    this.cursor = {
      cursor: '',
      firstCursor: opts.cursor,
      internalExt: opts.internal_ext
    };
    this.lastReceiveTime = Date.now();
    this.pingCount = 0;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      this.ws.addEventListener('open', (ev: Event) => {
        // May be the first time to open, or it may be a reconnection to open
        if (this.reconnectCount > 0) {
          // Reconnection successful
          this.reconnectCount = 0;
          this.emitter.emit('reconnect', ev);
        } else {
          // First connection
          this.emitter.emit('open', ev, this.info);
        }
        this.ping();
        this._afterOpen();
      });
      this.ws.addEventListener('close', (ev: CloseEvent) => {
        this.handleClose(ev);
      });
      this.ws.addEventListener('error', (ev: Event) => {
        this.emitter.emit('error', Error(ev.type || 'Unknown Error'));
      });
      this.ws.addEventListener('message', (ev: MessageEvent) => {
        this.handleMessage(ev.data);
      });
    } catch (err) {
      CLog.error('Error during room connection process =>', err);
      // Possible reason is that WebSocket is not available
      // Close
      this.emitter.emit('close', DyCastCloseCode.CONNECTING_ERROR, 'Error during room connection process');
      this._afterClose();
      // Report error
      this.emitter.emit('error', err as Error);
    }
  }

  /** Handle close */
  private handleClose(ev: CloseEvent) {
    let { code, reason } = ev;
    let msg: string = reason.toString();
    switch (code) {
      case DyCastCloseCode.NO_STATUS:
      case DyCastCloseCode.ABNORMAL:
        code = this.closeEvent.code || code;
        msg = this.closeEvent.msg || msg || 'closed';
        break;
    }
    this._afterClose();
    if (this.shouldReconnect || this.reconnectCount > 0) {
      // Need to reconnect
      this.reconnect();
    } else {
      // Normal closure
      this.emitter.emit('close', code, msg);
    }
  }

  /**
   * Handle message
   */
  private async handleMessage(data: ArrayBuffer) {
    this.pingCount = 0;
    this.lastReceiveTime = Date.now();
    let res;
    try {
      res = await this._decodeFrame(new Uint8Array(data));
    } catch (err) {
      res = null;
    }
    if (!res) return;
    const { response, frame, cursor, needAck, internalExt } = res;
    if (needAck) {
      // Send ack
      const ack = this._ack(internalExt, frame?.logId);
      this.setCursor(cursor, internalExt);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(ack);
      } else {
        // Reconnect
        CLog.error(`ACK sending exception => Live room [${this.roomNum}] has been closed`);
        this._afterClose();
        // this.reconnect();
      }
    }
    // Handle message body
    if (frame) {
      // Judge the message body type
      if (frame.payloadType === PayloadType.Msg) {
        this._dealMessages(response.messages);
      }
      if (frame.payloadType === PayloadType.Close) {
        // Close connection
        this.close(DyCastCloseCode.NORMAL, 'Close By PayloadType');
      }
    }
  }

  /**
   * Reconnect
   */
  private reconnect() {
    // Not closed yet
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.close(DyCastCloseCode.RECONNECTING, 'Closed due to reconnection');
    }
    this.shouldReconnect = !1;
    const opts: DyCastOptions = Object.assign({}, this.options, {
      cursor: this.cursor.cursor,
      internal_ext: this.cursor.internalExt
    });
    this.reconnectCount++;
    if (this.reconnectCount > this.maxReconnectCount) {
      CLog.error('The maximum number of reconnections has been exceeded, please try again later');
      this.emitter.emit('error', Error('The maximum number of reconnections has been exceeded, please try again later'));
      return;
    }
    this.wsRoomStatus = WSRoomStatus.RECONNECTING;
    this.emitter.emit('reconnecting', this.reconnectCount);
    this.isReconnecting = true;
    this._connect(opts);
  }

  /**
   * Close
   */
  public close(code: number = 1005, reason: string = 'close') {
    if (this.ws) {
      this.state = !1;
      this.closeEvent = { code, msg: reason };
      // No need to pass code, because the Douyin barrage ws server will not handle close frames
      this.ws.close();
      this.ws = void 0;
    }
  }

  /**
   * Send heartbeat frame
   */
  private ping() {
    try {
      let dur = Math.max(10000, Number(this.heartbeatDuration));
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Connection is normal
        // Send heartbeat => hb
        this.ws.send(this._ping());
        this.pingCount++;
        if (this.pingCount >= this.downgradePingCount) {
          return this.cannotReceiveMessage();
        }
      }
      // Heartbeat: send about once every 10 seconds
      this.pingTimer = setTimeout(() => {
        this.state && this.ping();
      }, dur);
    } catch (err) {
      // Error during sending process
      CLog.error('DyCast Ping Error =>', err);
    }
  }

  /**
   * Unable to receive messages normally
   *  - No message received for a long time
   */
  private cannotReceiveMessage() {
    // Close first
    this.close(DyCastCloseCode.CANNOT_RECEIVE, 'The client cannot receive information normally');
    let tmp = Date.now() - this.lastReceiveTime;
    CLog.error(`DyCast Cannot Receive Message => after ${tmp} ms`);
    // Reconnect
    this.emitter.emit('reconnecting', this.reconnectCount, DyCastCloseCode.CANNOT_RECEIVE, 'The client cannot receive information normally');
    this.reconnectCount < this.maxReconnectCount && (this.shouldReconnect = !0);
  }

  /**
   * Set cursor
   * @param cur
   * @param ext
   */
  private setCursor(cur: string, ext: string) {
    this.cursor.cursor = cur;
    this.cursor.internalExt = ext;
    if (!this.cursor.firstCursor) {
      this.cursor.firstCursor = cur;
    }
  }

  /**
   * Process a set of received messages
   */
  private async _dealMessages(msgs?: Message[]) {
    if (!msgs || msgs.length < 1) return;
    const messages: DyMessage[] = [];
    try {
      for (const msg of msgs) {
        const message = await this._dealMessage(msg);
        if (message) messages.push(message);
      }
    } catch (err) {}
    if (!messages.length) return;
    this.emitter.emit('message', messages);
  }

  /**
   * Process a single message
   * @param msg
   */
  private async _dealMessage(msg: Message) {
    const method = msg.method;
    const data: DyMessage | null = {};
    data.id = msg.msgId;
    let message = null;
    let payload = msg.payload;
    if (!payload) return null;
    try {
      // Process message
      switch (method) {
        case CastMethod.CHAT:
          message = decodeChatMessage(payload);
          data.method = CastMethod.CHAT;
          data.user = this._getCastUser(message.user);
          data.content = message.content;
          // Get rich text: including combined emojis
          data.rtfContent = this._getCastRtfContent(message.rtfContentV2);
          break;
        case CastMethod.GIFT:
          message = decodeGiftMessage(payload);
          data.method = CastMethod.GIFT;
          data.user = this._getCastUser(message.user);
          data.gift = this._getCastGift(message.gift, message.repeatCount || message.comboCount, message.repeatEnd);
          break;
        case CastMethod.LIKE:
          message = decodeLikeMessage(payload);
          data.method = CastMethod.LIKE;
          data.user = this._getCastUser(message.user);
          data.content = `Liked the host (${message.count})`;
          data.room = { likeCount: message.total };
          break;
        case CastMethod.MEMBER:
          message = decodeMemberMessage(payload);
          data.method = CastMethod.MEMBER;
          data.user = this._getCastUser(message.user);
          data.content = 'Entered the live room';
          data.room = { audienceCount: message.memberCount };
          break;
        case CastMethod.SOCIAL:
          message = decodeSocialMessage(payload);
          data.method = CastMethod.SOCIAL;
          data.user = this._getCastUser(message.user);
          data.content = 'Followed the host';
          data.room = { followCount: message.followCount };
          break;
        case CastMethod.EMOJI_CHAT:
          message = decodeEmojiChatMessage(payload);
          data.method = CastMethod.EMOJI_CHAT;
          data.user = this._getCastUser(message.user);
          data.content = this._getCastEmoji(message.emojiContent);
          break;
        case CastMethod.ROOM_USER_SEQ:
          message = decodeRoomUserSeqMessage(payload);
          data.method = CastMethod.ROOM_USER_SEQ;
          data.rank = this._getCastRanksA(message.ranks);
          data.room = { audienceCount: message.total, totalUserCount: message.totalUser };
          break;
        case CastMethod.CONTROL:
          message = decodeControlMessage(payload);
          data.method = CastMethod.CONTROL;
          data.content = message.common?.describe;
          data.room = { status: parseInt(message.action || '') || void 0 };
          break;
        case CastMethod.ROOM_RANK:
          message = decodeRoomRankMessage(payload);
          data.method = CastMethod.ROOM_RANK;
          data.rank = this._getCastRanksB(message.ranks);
          break;
        case CastMethod.ROOM_STATS:
          message = decodeRoomStatsMessage(payload);
          data.method = CastMethod.ROOM_STATS;
          data.room = { audienceCount: message.displayMiddle };
          break;
      }
      if (!data.method) return null;
    } catch (err) {
      // MLog.error('DyCast Message Decode Error =>', method);
      return null;
    }
    return data;
  }

  /**
   * Get the current gift list
   * @param data
   */
  private _getCastRanksA(data?: RoomUserSeqMessage_Contributor[]): LiveRankItem[] | undefined {
    if (!data || !data.length) return void 0;
    const list: LiveRankItem[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      list.push({
        avatar: item.user?.avatarThumb?.urlList?.[0] || '',
        nickname: item.user?.nickname || '',
        rank: item.rank || i + 1
      });
    }
    return list;
  }

  /**
   * Get the current gift list
   * @param data
   */
  private _getCastRanksB(data?: RoomRankMessage_RoomRank[]): LiveRankItem[] | undefined {
    if (!data || !data.length) return void 0;
    const list: LiveRankItem[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      list.push({
        avatar: item.user?.avatarThumb?.urlList?.[0] || '',
        nickname: item.user?.nickname || '',
        rank: item.scoreStr || i + 1
      });
    }
    return list;
  }

  /**
   * Get barrage user
   * @param data
   * @returns
   */
  private _getCastUser(data?: User): CastUser | undefined {
    if (!data) return void 0;
    return {
      id: data.secUid,
      name: data.nickname,
      gender: data.gender,
      avatar: data.avatarThumb?.urlList?.[0]
    };
  }

  /**
   * Get barrage gift
   * @param data
   * @returns
   */
  private _getCastGift(data?: GiftStruct, count?: string, end?: number): CastGift | undefined {
    if (!data) return void 0;
    return {
      id: data.id,
      name: data.name,
      price: data.diamondCount,
      type: data.type,
      desc: data.describe,
      icon: data.image?.urlList?.[0],
      count: count,
      repeatEnd: end
    };
  }

  /**
   * Get member emoji
   * @param data
   * @returns
   */
  private _getCastEmoji(data?: Text): string | undefined {
    if (!data) return void 0;
    return data.pieces?.[0]?.imageValue?.image?.urlList?.[0];
  }

  /**
   * Get barrage rich text content
   * @param data
   * @returns
   */
  private _getCastRtfContent(data?: Text): CastRtfContent[] | undefined {
    if (!data) return void 0;
    if (!data.pieces) return void 0;
    const pieces = data.pieces;
    const list: CastRtfContent[] = [];
    /**
     * pieces type
     *  - type = 1  : Normal chat text : Key field (stringValue)
     *  - type = 11 : @ User : Key field (userValue.user)
     *  - type = 15 : Combined emoji : Key field (imageValue)
     */
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].imageValue) {
        // Combined emoji
        let url = pieces[i].imageValue?.image?.urlList?.[0];
        let name = pieces[i].imageValue?.image?.content?.name;
        list.push({
          type: CastRtfContentType.EMOJI,
          text: name,
          url
        });
      } else if (pieces[i].userValue) {
        // At user
        let toUser = pieces[i].userValue?.user;
        list.push({
          type: CastRtfContentType.USER,
          text: `@${toUser?.nickname}`,
          user: this._getCastUser(toUser)
        });
      } else {
        // Assume it is plain text type
        // It may also be giftValue or something else
        list.push({
          type: CastRtfContentType.TEXT,
          text: pieces[i].stringValue || ''
        });
      }
    }
    return list;
  }

  /**
   * Process received binary messages
   * @param data
   */
  private async _decodeFrame(data: Uint8Array) {
    const frame = decodePushFrame(data);
    let payload = frame.payload;
    const headers = frame.headersList;
    let cursor = '';
    let internalExt = '';
    let needAck = !1;
    if (!payload) return null;
    if (headers) {
      if (headers['compress_type'] && headers['compress_type'] === 'gzip') {
        payload = pako.ungzip(payload);
      }
      if (headers['im-cursor']) {
        cursor = headers['im-cursor'];
      }
      if (headers['im-internal_ext']) {
        internalExt = headers['im-internal_ext'];
      }
    }
    const res = decodeResponse(payload);
    if (!cursor && res.cursor) cursor = res.cursor;
    if (!internalExt && res.internalExt) internalExt = res.internalExt;
    if (res.needAck) needAck = res.needAck;
    return {
      response: res,
      frame,
      cursor,
      needAck,
      internalExt
    };
  }

  /** Heartbeat data */
  private _ping() {
    return encodePushFrame({
      payloadType: PayloadType.Hb
    });
  }

  /**
   * Ack data
   * @param ext Frame im-internal_ext | Response internalExt
   * @param logId
   */
  private _ack(ext: string = '', logId?: string) {
    const getPayload = function (_ext: string) {
      let arr = [];
      for (let s of _ext) {
        let index = s.charCodeAt(0);
        index < 128
          ? arr.push(index)
          : index < 2048
          ? (arr.push(192 + (index >> 6)), arr.push(128 + (63 & index)))
          : index < 65536 &&
            (arr.push(224 + (index >> 12)), arr.push(128 + ((index >> 6) & 63)), arr.push(128 + (63 & index)));
      }
      return new Uint8Array(arr);
    };
    return encodePushFrame({
      payloadType: PayloadType.Ack,
      payload: getPayload(ext),
      logId
    });
  }

  /** After closing */
  private _afterClose() {
    this.state = !1;
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = void 0;
    }
    this.cursor = {
      cursor: '',
      firstCursor: '',
      internalExt: ''
    };
    this.wsRoomStatus = WSRoomStatus.CLOSED;
    this.closeEvent = { code: DyCastCloseCode.NO_STATUS, msg: 'CLOSE_NO_STATUS' };
    this.ws = void 0;
    this.isReconnecting = false;
  }

  /** After opening */
  private _afterOpen() {
    this.state = !0;
    this.wsRoomStatus = WSRoomStatus.CONNECTED;
    this.isReconnecting = false;
    this.reconnectCount = 0;
  }

  /**
   * Get the full wss address
   * @param opts
   * @returns
   */
  private _getSocketUrl(opts: DyCastOptions) {
    const fullOpt = Object.assign({}, defaultOpts, opts);
    return `${BASE_URL}?${this._mergeOptions(fullOpt)}`;
  }

  /**
   * Convert the configuration to a url parameter string
   *  - Such as: item1=value1&item2=value2&...
   * @param opts
   * @returns
   */
  private _mergeOptions(opts: any): string {
    return Object.keys(opts).reduce((t, n) => {
      let r;
      return `${t}${t ? '&' : ''}${n}=${null != (r = opts[n]) ? r : ''}`;
    }, '');
  }

  /**
   * Get connection information
   * @param roomNum
   * @returns
   */
  private async fetchConnectInfo(roomNum: string) {
    try {
      const info = await getLiveInfo(roomNum);
      this.info = info;
      this.status = info.status;
      const res = await getImInfo(info.roomId, info.uniqueId);
      this.imInfo = res;
    } catch (err) {
      // CLog.error('DyCast LiveInfo Request Error =>', err);
      return Promise.reject(err);
    }
  }

  /**
   * Organize the connection parameter object
   */
  private getWssParam(): DyCastOptions {
    const { roomId, uniqueId } = this.info;
    const sign = getSignature(roomId, uniqueId);
    return {
      room_id: roomId,
      user_unique_id: uniqueId,
      cursor: this.imInfo.cursor || '',
      internal_ext: this.imInfo.internalExt || '',
      signature: sign
    };
  }

  /**
   * Whether it is live
   */
  private isLiving() {
    return this.status === RoomStatus.LIVING;
  }

  /** Get live status */
  private getLiveStatus() {
    let type = 'Unknown';
    let code = 0;
    let msg = 'Unknown status';
    switch (this.status) {
      case RoomStatus.PREPARE:
        type = 'PREPARE';
        code = RoomStatus.PREPARE;
        msg = 'The host is preparing';
        break;
      case RoomStatus.LIVING:
        type = 'LIVING';
        code = RoomStatus.LIVING;
        msg = 'The host is live';
        break;
      case RoomStatus.PAUSE:
        type = 'PAUSE';
        code = RoomStatus.PAUSE;
        msg = 'The host has left temporarily';
        break;
      case RoomStatus.END:
        type = 'END';
        code = RoomStatus.END;
        msg = 'The host has gone offline';
        break;
    }
    return {
      type,
      code,
      msg
    };
  }

  /**
   * Get live room information
   */
  public getLiveInfo(): DyLiveInfo {
    return {
      ...this.info,
      roomNum: this.roomNum
    };
  }
}
