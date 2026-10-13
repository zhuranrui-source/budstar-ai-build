import { redirect } from 'next/navigation';

/** ADR-0009：线索运营归平台管理员（CRM），旧路由重定向到平台空间。 */
export default function LeadsRedirect() {
  redirect('/platform/leads');
}
