import { isGithubUrl, isHttpUrl } from './format';

export type SubmissionStatus =
  'DRAFT' | 'SUBMITTED' | 'NEEDS_REVISION' | 'RESUBMITTED' | 'COMPLETED';

export type DraftForm = {
  title: string;
  description: string;
  workUrl: string;
  githubUrl: string;
  demoUrl: string;
};

export const SUBMISSION_STATUS_TEXT: Record<SubmissionStatus, string> = {
  DRAFT: '草稿待提交',
  SUBMITTED: '已提交，等待老师反馈',
  NEEDS_REVISION: '老师建议修改',
  RESUBMITTED: '已重新提交',
  COMPLETED: '已完成',
};

export function getTransitionStatus(
  currentStatus: SubmissionStatus | null,
): 'SUBMITTED' | 'RESUBMITTED' {
  return currentStatus === 'NEEDS_REVISION' ? 'RESUBMITTED' : 'SUBMITTED';
}

export function hasReachedSubmissionStatus(
  currentStatus: SubmissionStatus | null | undefined,
  targetStatus: 'SUBMITTED' | 'RESUBMITTED',
): boolean {
  return currentStatus === targetStatus;
}

export function validateDraft(track: string, draft: DraftForm): string | null {
  if (!draft.title.trim()) return '请填写作品标题';
  if (!draft.description.trim()) return '请填写作品说明';
  if (draft.title.trim().length > 200) return '作品标题不能超过 200 字';
  if (draft.description.trim().length > 2000) return '作品说明不能超过 2000 字';

  if (track === 'VIBE_CODING') {
    if (!isGithubUrl(draft.githubUrl)) return '请填写有效的 GitHub 仓库地址';
    if (!isHttpUrl(draft.demoUrl))
      return '请填写以 http 或 https 开头的演示地址';
    return null;
  }
  if (draft.workUrl && !isHttpUrl(draft.workUrl))
    return '作品链接须以 http 或 https 开头';
  return null;
}
