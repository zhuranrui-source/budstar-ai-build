import { redirect } from 'next/navigation';

/** 脱敏数据浏览器已下线，平台首页回到工作台。 */
export default function PlatformHome() {
  redirect('/');
}
