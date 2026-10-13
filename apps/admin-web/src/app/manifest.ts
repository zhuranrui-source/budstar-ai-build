import type { MetadataRoute } from 'next';

/** ADR-0010：admin H5 以 PWA 形态承载移动办公（添加到主屏幕）。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BudStar 机构工作台',
    short_name: 'BudStar',
    description: '教师、平台管理员与合作方的移动办公工作台',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5f1',
    theme_color: '#1f6f5c',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
