/**
 * 座標変換ユーティリティ
 * すべての座標は動画領域に対する % で保持する。
 */

/** パーセント → ピクセル */
export function toPixel(percent: number, containerSize: number): number {
  return (percent / 100) * containerSize;
}

/** ピクセル → パーセント */
export function toPercent(pixel: number, containerSize: number): number {
  return (pixel / containerSize) * 100;
}

/**
 * 表示スケーリング係数
 * 動画のオリジナル幅と表示幅から計算
 */
export function getScale(displayWidth: number, originalWidth: number): number {
  return displayWidth / originalWidth;
}

/**
 * クリック可能領域のサイズをスケーリング
 */
export function scaleRadius(radius: number, scale: number): number {
  return radius * scale;
}
