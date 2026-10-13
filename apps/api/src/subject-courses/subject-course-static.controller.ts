import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { Public } from '../authorization/authorization.decorators';
import type { Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 学科互动实验室静态托管（K12 HTML 互动包）。
 *
 * 开发/试点：本地磁盘 apps/api/storage/subject-courses；
 * 生产：由 COS + 私有读签名接管（OPS-04），此控制器仅作本地回退。
 * 课程内容不含未成年人个人数据，公开可读不构成隐私面（ADR-0008 边界不受影响）。
 */
@Public()
@Controller('static/subject-courses')
export class SubjectCourseStaticController {
  private readonly root = path.resolve(
    process.env.SUBJECT_COURSE_STATIC_ROOT ??
      path.join(process.cwd(), 'storage/subject-courses'),
  );

  @Get()
  serve(@Query('path') relative: string, @Res() response: Response) {
    if (!relative) throw new NotFoundException();
    // 防目录穿越：解码后校验最终路径仍在根目录内
    const decoded = decodeURIComponent(relative);
    const target = path.resolve(this.root, decoded);
    if (!target.startsWith(this.root + path.sep)) {
      throw new NotFoundException();
    }
    // macOS APFS 文件名为 NFD、URL 通常 NFC——按目录实测条目做规范化匹配
    const resolved = this.resolveUnicode(target);
    if (!resolved) {
      throw new NotFoundException();
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // 沙箱化渲染：禁止实验室页面访问父页面与同源凭证
    response.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    fs.createReadStream(resolved).pipe(response);
  }

  private resolveUnicode(target: string): string | null {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
    const dir = path.dirname(target);
    const wanted = path.basename(target).normalize('NFC');
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.normalize('NFC') === wanted) {
        const candidate = path.join(dir, entry);
        if (fs.statSync(candidate).isFile()) return candidate;
      }
    }
    return null;
  }
}
