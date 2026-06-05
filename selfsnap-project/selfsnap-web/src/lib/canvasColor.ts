export function pickTextColorFromRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: {
    threshold?: number;
  }
) {
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  let r = 0, g = 0, b = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }

  r /= pixelCount;
  g /= pixelCount;
  b /= pixelCount;

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const threshold = options?.threshold ?? 150;

  return luminance > threshold ? "#000000" : "#FFFFFF";
}
