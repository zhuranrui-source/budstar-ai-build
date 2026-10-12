import { redirect } from 'next/navigation';

/**
 * ADR-0007：家长/学生合并为统一家庭视图。
 * 旧学生学习页 301 到家庭视图，课节与作品在其内按学生档案呈现。
 */
export default function LearningPageRedirect() {
  redirect('/family');
}
