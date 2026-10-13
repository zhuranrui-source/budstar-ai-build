import { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  listBoundStudents,
  selectActiveStudent,
  listStudentClasses,
  getStudentCurriculum,
  transitionSubmission,
  listPublishedSubjectCourses,
  type Curriculum,
  type SubjectCourseSummary,
  type StudentSwitcher,
} from '../../utils/family-api';

const SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  CHINESE: '语文',
  ENGLISH: '英语',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
  BIOLOGY: '生物',
  HISTORY: '历史',
  GEOGRAPHY: '地理',
  POLITICS: '道法',
  OTHER: '其他',
};

const GRADE_LABELS: Record<string, string> = {
  PRIMARY: '小学',
  JUNIOR_HIGH: '初中',
  SENIOR_HIGH: '高中',
  GENERAL: '全学段',
};

/**
 * 家庭视图（ADR-0007）：家长与学生共用——
 * 学生档案切换、课节与作品（亲子共学）、学科互动实验室、星球与报告入口。
 */
export default function FamilyPage() {
  const [switcher, setSwitcher] = useState<StudentSwitcher | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [subjects, setSubjects] = useState<SubjectCourseSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = Taro.getStorageSync('accessToken') as string;

  useEffect(() => {
    void reloadAll();
    // 学科内容目录：家长 token 经家庭读取面获取（ADR-0007）
    if (token) {
      listPublishedSubjectCourses(token)
        .then(setSubjects)
        .catch(() => setSubjects([]));
    }
  }, []);

  async function reloadAll() {
    if (!token) {
      setError('请先登录');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await listBoundStudents(token);
      setSwitcher(next);
      const selected = next.selectedStudentProfileId;
      if (selected) await loadCurriculum(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadCurriculum(studentProfileId: string) {
    const classes = await listStudentClasses(token, studentProfileId);
    if (classes.length === 0) {
      setCurriculum(null);
      return;
    }
    setCurriculum(
      await getStudentCurriculum(token, studentProfileId, classes[0].classId),
    );
  }

  async function handleSwitch(studentProfileId: string) {
    setLoading(true);
    try {
      await selectActiveStudent(token, studentProfileId);
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '切换失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(lesson: {
    submission: { id: string; status: string } | null;
  }) {
    if (!lesson.submission || !switcher?.selectedStudentProfileId) return;
    const toStatus =
      lesson.submission.status === 'SUBMITTED' ? 'RESUBMITTED' : 'SUBMITTED';
    setLoading(true);
    try {
      await transitionSubmission(
        token,
        switcher.selectedStudentProfileId,
        lesson.submission.id,
        toStatus,
      );
      await loadCurriculum(switcher.selectedStudentProfileId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView scrollY className="family-page">
      <View className="family-section">
        <Text className="family-title">家庭视图</Text>
        <Text className="family-subtitle">亲子共学 · 家长学生共用</Text>
        {error ? <Text className="family-error">{error}</Text> : null}
        {loading ? <Text>加载中…</Text> : null}
      </View>

      {switcher && switcher.students.length > 0 && (
        <View className="family-section">
          <Text className="family-h2">学生切换（档案选择）</Text>
          <View className="family-students">
            {switcher.students.map((student) => (
              <Button
                key={student.studentProfileId}
                size="mini"
                type={
                  student.studentProfileId === switcher.selectedStudentProfileId
                    ? 'primary'
                    : 'default'
                }
                onClick={() => void handleSwitch(student.studentProfileId)}
              >
                {student.displayName}
              </Button>
            ))}
          </View>
        </View>
      )}

      <View className="family-section">
        <Text className="family-h2">课节与作品</Text>
        {curriculum ? (
          <View>
            <Text className="family-muted">
              {curriculum.className} · {curriculum.coursePackageTitle} v
              {curriculum.coursePackageVersion}
            </Text>
            {curriculum.lessons.map((lesson) => (
              <View key={lesson.mainLessonId} className="family-lesson">
                <Text>
                  {lesson.sequence}. {lesson.title}
                </Text>
                <Text className="family-muted">
                  {lesson.submission
                    ? `作品：${lesson.submission.status}`
                    : lesson.assignment
                      ? '待提交'
                      : '本节无作业'}
                </Text>
                {lesson.submission &&
                ['DRAFT', 'NEEDS_REVISION', 'SUBMITTED'].includes(
                  lesson.submission.status,
                ) ? (
                  <Button
                    size="mini"
                    disabled={loading}
                    onClick={() => void handleSubmit(lesson)}
                  >
                    {lesson.submission.status === 'SUBMITTED'
                      ? '重新提交'
                      : '提交作品'}
                  </Button>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text className="family-muted">
            当前学生暂未加入班级；入班后课节会出现在这里。
          </Text>
        )}
      </View>

      <View className="family-section">
        <Text className="family-h2">学科互动实验室</Text>
        {subjects.length === 0 ? (
          <Text className="family-muted">
            已发布学科内容将按年级出现在这里（管理端发布后可见）。
          </Text>
        ) : (
          subjects.map((course) => (
            <View key={course.id} className="family-lesson">
              <Text>
                {SUBJECT_LABELS[course.subject] ?? course.subject} ·{' '}
                {course.title}
              </Text>
              <Text className="family-muted">
                {GRADE_LABELS[course.gradeBand] ?? course.gradeBand}
                {course.gradeLevel ? ` ${course.gradeLevel} 年级` : ''} ·{' '}
                {course.chapterCount} 章
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="family-section">
        <Text className="family-h2">星芽星球与成长报告</Text>
        <Text className="family-muted">
          封闭社区与成长报告在下一版接入（家庭视图不展示五维数字等级）。
        </Text>
      </View>
    </ScrollView>
  );
}
