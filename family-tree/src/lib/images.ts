/** Downscale an image file to a data URL. Keeps big scans out of memory. */
export async function makeThumbnail(
  file: File | Blob,
  maxEdge = 480,
  quality = 0.82,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h };
  } catch {
    return null;
  }
}

export const kindOf = (file: File): 'photo' | 'document' | 'audio' | 'video' => {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
};
