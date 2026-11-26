/**
 * 上传前在浏览器内压缩：最长边 1600px、JPEG 质量 0.85。
 * 重新编码会去掉照片里的 EXIF（含拍摄地点），避免泄露孩子的位置信息。
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('仅支持 JPG、PNG 或 WebP 图片');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持图片处理');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('图片处理失败');
  if (blob.size > 4 * 1024 * 1024) throw new Error('图片过大，请换一张');
  return blob;
}
