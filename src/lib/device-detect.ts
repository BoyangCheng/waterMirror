// 浏览器设备/环境识别。
// 用途：
//   1. 候选人面试页根据设备类型展示不同的入场提示
//      - iOS 微信内嵌 WebView：MediaRecorder/getUserMedia 兼容性最差，建议跳到 Safari
//      - 其他移动端：录像可用但屏幕/性能不如桌面，建议用电脑
//   2. 录像/上传日志附带设备信息（写入 error_log.context）便于排查

export interface DeviceClass {
  isIOS: boolean;
  isAndroid: boolean;
  isWeChat: boolean;
  isSafari: boolean;
  /** 任意手机/平板（iOS 或 Android），不含桌面浏览器的窄窗口 */
  isMobile: boolean;
  /** iOS 微信内嵌 WebView —— 录像最容易挂的环境 */
  isIOSWeChat: boolean;
}

const DEFAULT_CLASS: DeviceClass = {
  isIOS: false,
  isAndroid: false,
  isWeChat: false,
  isSafari: false,
  isMobile: false,
  isIOSWeChat: false,
};

/**
 * 从 UA 字符串识别设备。SSR 安全 —— 没传 ua 且 navigator 不可用时返回全 false。
 *
 * 注意：UA 不可信（用户能改），但对"提示"场景够用。真正的能力检测要用 feature
 * detection（如 MediaRecorder.isTypeSupported）。
 */
export function getDeviceClass(ua?: string): DeviceClass {
  const userAgent = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!userAgent) return DEFAULT_CLASS;

  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isWeChat = /MicroMessenger/i.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  const isIOSWeChat = isIOS && isWeChat;

  return { isIOS, isAndroid, isWeChat, isSafari, isMobile, isIOSWeChat };
}
