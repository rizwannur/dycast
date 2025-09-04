<template>
  <div class="index-view">
    <div class="view-left">
      <LiveInfo
        :cover="cover"
        :title="title"
        :avatar="avatar"
        :nickname="nickname"
        :follow-count="followCount"
        :member-count="memberCount"
        :user-count="userCount"
        :like-count="likeCount" />
      <div class="view-left-bottom">
        <div class="view-left-tools">
          <div class="view-left-tool" title="保存弹幕" @click.stop="saveCastToFile">
            <i class="ice-save"></i>
          </div>
        </div>
        <hr class="hr" />
        <LiveStatusPanel ref="panel" :status="connectStatus" />
      </div>
    </div>
    <div class="view-center">
      <!-- Main barrage: chat, gift -->
      <CastList :types="['chat', 'gift']" ref="castEl" />
    </div>
    <div class="view-right">
      <div class="view-input">
        <ConnectInput
          ref="roomInput"
          label="Room"
          placeholder="Please enter the room number"
          v-model:value="roomNum"
          :test="verifyRoomNumber"
          @confirm="connectLive"
          @cancel="disconnectLive" />
        <ConnectInput
          ref="relayInput"
          label="WS Address"
          placeholder="Please enter the forwarding address"
          confirm-text="Forward"
          cancel-text="Stop"
          v-model:value="relayUrl"
          :test="verifyWssUrl"
          @confirm="relayCast"
          @cancel="stopRelayCast" />
      </div>
      <div class="view-other">
        <!-- Other barrage: follow, like, enter, console, etc. -->
        <CastList ref="otherEl" :types="['social', 'like', 'member']" pos="left" no-prefix theme="dark" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConnectInput from '@/components/ConnectInput.vue';
import LiveInfo from '@/components/LiveInfo.vue';
import LiveStatusPanel from '@/components/LiveStatusPanel.vue';
import CastList from '@/components/CastList.vue';
import {
  CastMethod,
  DyCast,
  DyCastCloseCode,
  RoomStatus,
  type ConnectStatus,
  type DyLiveInfo,
  type DyMessage,
  type LiveRoom
} from '@/core/dycast';
import { verifyRoomNum, verifyWsUrl } from '@/utils/verifyUtil';
import { ref, useTemplateRef } from 'vue';
import { CLog } from '@/utils/logUtil';
import { getId } from '@/utils/idUtil';
import { RelayCast } from '@/core/relay';
import SkMessage from '@/components/Message';
import { formatDate } from '@/utils/commonUtil';
import FileSaver from '@/utils/fileUtil';

// Connection status
const connectStatus = ref<ConnectStatus>(0);
// Forwarding status
const relayStatus = ref<ConnectStatus>(0);
// Room number
const roomNum = ref<string>('');
// Room number input box status
const roomInputRef = useTemplateRef('roomInput');
// Forwarding address
const relayUrl = ref<string>('');
const relayInputRef = useTemplateRef('relayInput');
// Status panel
const statusPanelRef = useTemplateRef('panel');

/** Live room information */
const cover = ref<string>('');
const title = ref<string>('*****');
const avatar = ref<string>('');
const nickname = ref<string>('***');
const followCount = ref<string | number>('*****');
const memberCount = ref<string | number>('*****');
const userCount = ref<string | number>('*****');
const likeCount = ref<string | number>('*****');

// Main barrage
const castRef = useTemplateRef('castEl');
// Other barrage
const otherRef = useTemplateRef('otherEl');
// All barrage
const allCasts: DyMessage[] = [];
// Record barrage
const castSet = new Set<string>();
// Barrage client
let castWs: DyCast | undefined;
// Forwarding client
let relayWs: RelayCast | undefined;

/**
 * Verify room number
 * @param value
 * @returns
 */
function verifyRoomNumber(value: string) {
  const flag = verifyRoomNum(value);
  if (flag) return { flag, message: '' };
  else {
    return { flag, message: 'Incorrect room number' };
  }
}

/**
 * Verify forwarding address WsUrl
 * @param value
 * @returns
 */
function verifyWssUrl(value: string) {
  const flag = verifyWsUrl(value);
  if (flag) return { flag, message: '' };
  else {
    return { flag, message: 'Incorrect forwarding address' };
  }
}

/** Set room number input box status */
const setRoomInputStatus = function (flag?: boolean) {
  if (roomInputRef.value) roomInputRef.value.setStatus(flag);
};

/** Set forwarding address input box status */
const setRelayInputStatus = function (flag?: boolean) {
  if (relayInputRef.value) relayInputRef.value.setStatus(flag);
};

/**
 * Set room statistics information
 * @param room
 * @returns
 */
const setRoomCount = function (room?: LiveRoom) {
  if (!room) return;
  if (room.audienceCount) memberCount.value = `${room.audienceCount}`;
  if (room.followCount) followCount.value = `${room.followCount}`;
  if (room.likeCount) likeCount.value = `${room.likeCount}`;
  if (room.totalUserCount) userCount.value = `${room.totalUserCount}`;
};
/**
 * Set live room information
 * @param info
 */
const setRoomInfo = function (info?: DyLiveInfo) {
  if (!info) return;
  if (info.cover) cover.value = info.cover;
  if (info.title) title.value = info.title;
  if (info.avatar) avatar.value = info.avatar;
  if (info.nickname) nickname.value = info.nickname;
};

/**
 * Process message list
 */
const handleMessages = function (msgs: DyMessage[]) {
  const newCasts: DyMessage[] = [];
  const mainCasts: DyMessage[] = [];
  const otherCasts: DyMessage[] = [];
  try {
    for (const msg of msgs) {
      if (!msg.id) continue;
      if (castSet.has(msg.id)) continue;
      castSet.add(msg.id);
      switch (msg.method) {
        case CastMethod.CHAT:
          newCasts.push(msg);
          mainCasts.push(msg);
          break;
        case CastMethod.GIFT:
          if (!msg?.gift?.repeatEnd) {
            newCasts.push(msg);
            mainCasts.push(msg);
          }
          break;
        case CastMethod.LIKE:
          newCasts.push(msg);
          otherCasts.push(msg);
          setRoomCount(msg.room);
          break;
        case CastMethod.MEMBER:
          newCasts.push(msg);
          otherCasts.push(msg);
          setRoomCount(msg.room);
          break;
        case CastMethod.SOCIAL:
          newCasts.push(msg);
          otherCasts.push(msg);
          setRoomCount(msg.room);
          break;
        case CastMethod.EMOJI_CHAT:
          newCasts.push(msg);
          mainCasts.push(msg);
          break;
        case CastMethod.ROOM_USER_SEQ:
          setRoomCount(msg.room);
          break;
        case CastMethod.ROOM_STATS:
          setRoomCount(msg.room);
          break;
        case CastMethod.CONTROL:
          if (msg?.room?.status !== RoomStatus.LIVING) {
            // The live has ended
            newCasts.push(msg);
            otherCasts.push(msg);
            disconnectLive();
          }
          break;
      }
    }
  } catch (err) {}
  // Record
  allCasts.push(...newCasts);
  if (castRef.value) castRef.value.appendCasts(mainCasts);
  if (otherRef.value) otherRef.value.appendCasts(otherCasts);
  if (relayWs && relayWs.isConnected()) {
    relayWs.send(JSON.stringify(msgs));
  }
};

/**
 * Add console message
 * @param msg
 */
const addConsoleMessage = function (content: string) {
  if (otherRef.value)
    otherRef.value.appendCasts([
      {
        id: getId(),
        method: CastMethod.CUSTOM,
        content,
        user: { name: 'Console' }
      }
    ]);
};

/**
 * Clear list
 */
function clearMessageList() {
  castSet.clear();
  allCasts.length = 0;
  if (castRef.value) castRef.value.clearCasts();
  if (otherRef.value) otherRef.value.clearCasts();
}

/**
 * Connect to room
 */
const connectLive = function () {
  try {
    // Clear the messages from the last connection
    clearMessageList();
    CLog.debug('Connecting:', roomNum.value);
    SkMessage.info(`Connecting: ${roomNum.value}`);
    const cast = new DyCast(roomNum.value);
    cast.on('open', (ev, info) => {
      CLog.info('DyCast room connected successfully');
      SkMessage.success(`Room connected successfully[${roomNum.value}]`);
      setRoomInputStatus(true);
      connectStatus.value = 1;
      setRoomInfo(info);
      addConsoleMessage('Live room connected');
    });
    cast.on('error', err => {
      CLog.error('DyCast connection error =>', err);
      SkMessage.error(`Connection error: ${err}`);
      connectStatus.value = 2;
      setRoomInputStatus(false);
    });
    cast.on('close', (code, reason) => {
      CLog.info(`DyCast room closed[${code}] => ${reason}`);
      connectStatus.value = 3;
      setRoomInputStatus(false);
      switch (code) {
        case DyCastCloseCode.NORMAL:
          SkMessage.success('Disconnected successfully');
          break;
        case DyCastCloseCode.LIVE_END:
          SkMessage.info('The host has gone offline');
          break;
        case DyCastCloseCode.CANNOT_RECEIVE:
          SkMessage.error('Unable to receive information normally, closed');
          break;
        default:
          SkMessage.info('Room closed');
      }
      if (code === DyCastCloseCode.LIVE_END) {
        addConsoleMessage(reason || 'The host has not started broadcasting or has gone offline');
      } else {
        if (statusPanelRef.value) addConsoleMessage(`Connection closed, duration: ${statusPanelRef.value.getDuration()}`);
        else addConsoleMessage('Connection closed');
      }
    });
    cast.on('message', msgs => {
      handleMessages(msgs);
    });
    cast.on('reconnecting', (count, code, reason) => {
      switch (code) {
        case DyCastCloseCode.CANNOT_RECEIVE:
          // Unable to receive information normally
          SkMessage.warning('Unable to receive barrage normally, preparing to reconnect');
          break;
        default:
          CLog.warn('DyCast reconnecting =>', count);
          SkMessage.warning(`Reconnecting: ${count}`);
      }
    });
    cast.on('reconnect', ev => {
      CLog.info('DyCast reconnected successfully');
      SkMessage.success('Room reconnection complete');
    });
    cast.connect();
    castWs = cast;
  } catch (err) {
    CLog.error('Error during room connection process:', err);
    SkMessage.error('Error during room connection process');
    setRoomInputStatus(false);
    castWs = void 0;
  }
};
/** Disconnect */
const disconnectLive = function () {
  if (castWs) castWs.close(1000, 'Disconnect');
};

/** Connect to forwarding room */
const relayCast = function () {
  try {
    CLog.info('Connecting to forward =>', relayUrl.value);
    SkMessage.info(`Forwarding connection in progress: ${relayUrl.value}`);
    const cast = new RelayCast(relayUrl.value);
    cast.on('open', () => {
      CLog.info(`DyCast forwarding connected successfully`);
      SkMessage.success(`Forwarding started`);
      setRelayInputStatus(true);
      relayStatus.value = 1;
      addConsoleMessage('Forwarding client connected');
      if (castWs) {
        // Send live room information to the forwarding address
        cast.send(JSON.stringify(castWs.getLiveInfo()));
      }
    });
    cast.on('close', (code, msg) => {
      CLog.info(`(${code})dycast forwarding closed: ${msg || 'Unknown reason'}`);
      if (code === 1000) SkMessage.info(`Forwarding stopped`);
      else SkMessage.warning(`Forwarding stopped: ${msg || 'Unknown reason'}`);
      setRelayInputStatus(false);
      relayStatus.value = 0;
      addConsoleMessage('Forwarding closed');
    });
    cast.on('error', ev => {
      CLog.warn(`dycast forwarding error: ${ev.message}`);
      SkMessage.error(`Forwarding error: ${ev.message}`);
      setRelayInputStatus(false);
      relayStatus.value = 2;
    });
    cast.connect();
    relayWs = cast;
  } catch (err) {
    CLog.error('Barrage forwarding error:', err);
    SkMessage.error('Forwarding error: ${err.message}');
    setRelayInputStatus(false);
    relayStatus.value = 2;
    relayWs = void 0;
  }
};
/** Pause forwarding */
const stopRelayCast = function () {
  if (relayWs) relayWs.close(1000);
};

/** Save barrage to local file */
const saveCastToFile = function () {
  if (connectStatus.value === 1) {
    SkMessage.warning('Please disconnect before saving');
    return;
  }
  const len = allCasts.length;
  if (len <= 0) {
    SkMessage.warning('No barrage to save');
    return;
  }
  const date = formatDate(new Date(), 'yyyy-MM-dd_HHmmss');
  const fileName = `[${roomNum.value}]${date}(${len})`;
  const data = JSON.stringify(allCasts, null, 2);
  FileSaver.save(data, {
    name: fileName,
    ext: '.json',
    mimeType: 'application/json',
    description: 'Barrage data',
    existStrategy: 'new'
  })
    .then(res => {
      if (res.success) {
        SkMessage.success('Barrage saved successfully');
      } else {
        SkMessage.error('Failed to save barrage');
        CLog.error('Failed to save barrage =>', res.message);
      }
    })
    .catch(err => {
      SkMessage.error('Error saving barrage');
      CLog.error('Error saving barrage =>', err);
    });
};
</script>

<style lang="scss" scoped>
$bg: #f7f6f5;
$bd: #b2bfc3;
$theme: #68be8d;
$tool: #8b968d;

.index-view {
  position: relative;
  background-color: $bg;
  display: flex;
  width: 100%;
  height: 100%;
  .view-left,
  .view-center,
  .view-right {
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    width: 0;
    flex-shrink: 0;
  }
  .view-left {
    flex-grow: 2.5;
    border-right: 1px solid $bd;
    justify-content: space-between;
  }
  .view-left-bottom {
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 12px 0;
    .hr {
      height: 0;
      border: 0;
      border-top: 1px solid $bd;
      margin: 5px 0;
    }
  }
  .view-left-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    box-sizing: border-box;
    padding: 0 12px;
  }
  .view-left-tool {
    font-size: 21px;
    width: 1.2em;
    height: 1.2em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: $tool;
    transition: color 0.2s ease-in-out, background-color 0.3s ease-in-out, opacity 0.2s ease;
    background-color: transparent;
    border-radius: 0.4em;
    i {
      font-size: 1em;
    }
    &:hover {
      color: #fff;
      background-color: $theme;
    }
    &:active {
      opacity: 0.8;
    }
  }
  .view-center {
    flex-grow: 4.5;
    padding: 18px 12px;
  }
  .view-right {
    flex-grow: 3;
    border-left: 1px solid $bd;
    padding: 18px 12px;
    gap: 12px;
  }
  .view-input {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .view-other {
    display: flex;
    width: 100%;
    height: 0;
    flex-grow: 1;
    box-sizing: border-box;
  }
}

@media (max-width: 768px) {
  .index-view {
    flex-direction: column;
    height: auto;
    .view-left,
    .view-center,
    .view-right {
      width: 100%;
      flex-grow: 0;
      border: none;
    }
    .view-left {
      margin-top: 250px;
      justify-content: flex-start;
    }
    .view-center {
      height: 100vh;
    }
    .view-right {
      height: 80vh;
    }
    .view-input {
      position: absolute;
      top: 0;
      left: 0;
      box-sizing: border-box;
      padding: 18px 12px;
    }
    .view-left-bottom {
      position: absolute;
      top: 150px;
      left: 0;
    }
  }
}
</style>
