import type { DyImInfo } from './dycast';
import { decodeResponse } from './model';
import { getMsToken } from './signature';
import { makeUrlParams, parseLiveHtml } from './util';

/**
 * Request live room information
 */
export const fetchLiveInfo = async function (id: string) {
  try {
    const html = await fetch(`/dylive/${id}`).then(res => res.text());
    return html;
  } catch (err) {
    return Promise.reject(Error('Fetch Live Info Error'));
  }
};

/**
 * Get live room information
 * @param id Room number
 * @returns
 */
export const getLiveInfo = async function (id: string) {
  try {
    const html = await fetchLiveInfo(id);
    const first = parseLiveHtml(html);
    if (first) return first;
    else {
      // If the first request has no cookie => __ac_nonce, the target information cannot be obtained
      // But the first request will return a cookie => __ac_nonce
      // Request for the second time
      const realHtml = await fetchLiveInfo(id);
      const second = parseLiveHtml(realHtml);
      if (second) return second;
      else throw new Error('Get Live Info Error');
    }
  } catch (err) {
    return Promise.reject(err);
  }
};

const USER_AGENT =
  navigator.userAgent ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const BROWSER_VERSION =
  navigator.appVersion ||
  '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const BROWSER_NAME = navigator.appCodeName || 'Mozilla';
const VERSION_CODE = 180800;

/**
 * Default interface parameters
 *  - /webcast/im/fetch
 */
const defaultIMFetchParams = {
  aid: 6383,
  app_name: 'douyin_web',
  browser_language: 'zh-CN',
  browser_name: BROWSER_NAME,
  browser_online: true,
  browser_platform: 'Win32',
  browser_version: BROWSER_VERSION,
  cookie_enabled: true,
  cursor: '',
  device_id: '',
  device_platform: 'web',
  did_rule: 3,
  endpoint: 'live_pc',
  fetch_rule: 1,
  identity: 'audience',
  insert_task_id: '',
  internal_ext: '',
  last_rtt: 0,
  live_id: 1,
  live_reason: '',
  need_persist_msg_count: 15,
  resp_content_type: 'protobuf',
  screen_height: 1080,
  screen_width: 1920,
  support_wrds: 1,
  tz_name: 'Asia/Shanghai',
  version_code: VERSION_CODE
};

/**
 * Request initial connection information
 *  - im/fetch
 * @param roomId
 * @param uniqueId
 * @param roomNum Room number; not currently needed
 */
export const fetchImInfo = async function (roomId: string, uniqueId: string) {
  // The request requires some key parameters: msToken, a_bogus
  // After the request is successful, it will respond with protobuf binary data, which is decoded into the Response type of the model
  // Mainly need the cursor and internal_ext values inside
  try {
    const msToken = getMsToken(184);
    const params = Object.assign({}, defaultIMFetchParams, {
      msToken,
      room_id: roomId,
      user_unique_id: uniqueId
    });
    // An encrypted parameter that must be calculated through the params parameter above. If you are interested, you can reverse it yourself. It is not parsed here and may not be verified.
    const aBogus = '00000000';
    Object.assign(params, {
      live_pc: roomId,
      a_bogus: aBogus
    });
    const url = `/dylive/webcast/im/fetch/?${makeUrlParams(params)}`;
    // It is not clear whether the interface has referer verification. If it is needed, it must be set in the server's cross-domain configuration. The configuration here is invalid.
    // const headers = {
    //   Referer: `https://live.douyin.com/${roomNum}`
    // };
    const buffer = await fetch(url).then(res => res.arrayBuffer());
    return buffer;
  } catch (err) {
    return Promise.reject(Error('Fetch Im Info Error'));
  }
};

/**
 * Get initial connection information
 * @param roomId
 * @param uniqueId
 * @returns
 */
export const getImInfo = async function (roomId: string, uniqueId: string): Promise<DyImInfo> {
  const reqMs = Date.now();
  try {
    const buffer = await fetchImInfo(roomId, uniqueId);
    // The return of a request error may be json
    const res = decodeResponse(new Uint8Array(buffer));
    return {
      cursor: res.cursor,
      internalExt: res.internalExt,
      now: res.now,
      pushServer: res.pushServer,
      fetchInterval: res.fetchInterval,
      fetchType: res.fetchType,
      liveCursor: res.liveCursor
    };
  } catch (err) {
    const now = Date.now();
    // Ensure that cursor and internalExt can be returned
    return {
      cursor: `r-7497180536918546638_d-1_u-1_fh-7497179772733760010_t-${now}`,
      internalExt: `internal_src:dim|wss_push_room_id:${roomId}|wss_push_did:${uniqueId}|first_req_ms:${reqMs}|fetch_time:${now}|seq:1|wss_info:0-${now}-0-0|wrds_v:7497180515443673855`
    };
  }
};
