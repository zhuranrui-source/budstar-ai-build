import PageState from './PageState';
import { goToLogin } from '../utils/session';

/** 未登录时的占位：说明需要登录的原因，由用户主动发起登录。 */
export default function LoginRequired({
  description,
}: {
  description: string;
}) {
  return (
    <PageState
      kind="empty"
      title="登录后查看"
      description={description}
      actionText="微信一键登录"
      onAction={() => goToLogin()}
    />
  );
}
