import { redirect } from 'next/navigation';

/** ADR-0009/0010：员工页面归入 /teacher 空间，旧路由重定向。 */
export default function FeedbackRedirect() {
  redirect('/teacher/feedback');
}
