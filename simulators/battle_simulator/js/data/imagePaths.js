export const SIMULATOR_IMAGE_BASE = "../../img_base/battle_simulator/";

export function imageUrl(value, fallback = "unknown.png") {
  const source = String(value || fallback).trim();
  if (/^(?:https?:|data:|blob:|\/|\.{1,2}\/)/i.test(source)) return source;
  return `${SIMULATOR_IMAGE_BASE}${source}`;
}
