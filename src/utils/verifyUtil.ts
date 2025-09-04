/**
 * Verify room number
 * @param value
 * @returns
 */
export function verifyRoomNum(value: string) {
  const reg = /^[0-9]{8,12}$/;
  return reg.test(value);
}

/**
 * Verify wss address
 * @param value
 * @returns
 */
export function verifyWsUrl(value: string) {
  const reg = /^wss?:\/\/(?:\[[^\]]+\]|[^/:]+)(?::\d+)?(?:\/.*)?$/i;
  return reg.test(value);
}
