import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../http/api-error';

export const PLANET_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

type ImageKind = { ext: 'jpg' | 'png' | 'webp'; mime: string };

/** 以文件头识别真实格式，不信任客户端声明的 Content-Type。 */
function detectImage(buffer: Buffer): ImageKind | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * 星球图片存储（方案 A：服务器本地磁盘，nginx 以 /media/planet/ 直接提供）。
 * 以后迁移到 COS 时只需替换本服务的实现，帖子里保存的仍是相对 URL。
 */
@Injectable()
export class PlanetMediaService {
  private readonly root = path.resolve(
    process.env.PLANET_MEDIA_ROOT ?? path.join(process.cwd(), 'storage/planet'),
  );

  async save(body: unknown): Promise<{ url: string }> {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请上传 JPG、PNG 或 WebP 图片',
      );
    }
    if (body.length > PLANET_IMAGE_MAX_BYTES) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '图片不能超过 4MB',
      );
    }
    const kind = detectImage(body);
    if (!kind) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '仅支持 JPG、PNG 或 WebP 图片',
      );
    }
    const now = new Date();
    const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const name = `${randomUUID()}.${kind.ext}`;
    const dir = path.join(this.root, month);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), body, { mode: 0o644 });
    return { url: `/media/planet/${month}/${name}` };
  }

  /** 帖子只能引用本服务已保存的图片。 */
  async exists(url: string): Promise<boolean> {
    const match =
      /^\/media\/planet\/([0-9]{6})\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/.exec(
        url,
      );
    if (!match) return false;
    try {
      await fs.access(path.join(this.root, match[1], match[2]));
      return true;
    } catch {
      return false;
    }
  }
}
