'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';

const CAMPUS_KEY = 'budstar.admin.campus';

export default function FeedbackPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const campusId =
    typeof window === 'undefined'
      ? ''
      : (window.sessionStorage.getItem(CAMPUS_KEY) ?? '');
  const [workSubmissionId, setWorkSubmissionId] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftId, setDraftId] = useState('');
  const [formalBody, setFormalBody] = useState('');
  const [formalId, setFormalId] = useState('');
  const [wechatCopy, setWechatCopy] = useState('');
  const [fiveDimId, setFiveDimId] = useState('');
  const [fiveDimSummary, setFiveDimSummary] = useState('');
  const [studentProfileId, setStudentProfileId] = useState('');
  const [classId, setClassId] = useState('');
  const [reportId, setReportId] = useState('');
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function run(action: () => Promise<void>) {
    if (!campusId) {
      setError('请先选择校区');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(
        cause instanceof ForbiddenError
          ? '无权执行点评或报告操作'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const draft = await client.generateFeedbackDraft(
        campusId,
        workSubmissionId,
      );
      setDraftId(draft.id);
      setDraftContent(draft.content);
      setFormalBody(draft.content);
      setMessage(`AI 草稿已生成（${draft.status}），不会自动发布`);
    });
  }

  async function saveAndPublish(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const formal = await client.saveFormalFeedback(campusId, {
        workSubmissionId,
        body: formalBody,
        highlights: ['课堂表现积极'],
        nextSteps: ['继续巩固本节方法'],
        aiDraftId: draftId || undefined,
      });
      const published = await client.publishFormalFeedback(campusId, formal.id);
      setFormalId(published.id);
      setMessage(`正式点评已人工发布（v${formal.version}）`);
    });
  }

  async function copyWechat() {
    await run(async () => {
      if (!formalId) throw new Error('请先发布正式点评');
      const copy = await client.getLessonReportCopy(campusId, formalId);
      setWechatCopy(copy.wechatCopy);
      setMessage('每课一报微信文案已生成，可手动复制');
    });
  }

  async function runFiveDim() {
    await run(async () => {
      const evaluation = await client.generateFiveDim(
        campusId,
        workSubmissionId,
      );
      setFiveDimId(evaluation.id);
      setFiveDimSummary(
        evaluation.scores
          .map((score) => `${score.dimension}:${score.level}`)
          .join(' · '),
      );
      const confirmed = await client.reviewFiveDim(
        campusId,
        evaluation.id,
        'confirm',
      );
      setMessage(`五维评价已人工确认（${confirmed.status}）`);
    });
  }

  async function runReport(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const report = await client.generateGrowthReport(campusId, {
        studentProfileId,
        classId,
        milestone: 4,
      });
      const published = await client.publishGrowthReport(
        campusId,
        report.id,
        observation || undefined,
      );
      setReportId(published.id);
      setMessage(`第4节成长报告已人工发布（${published.status}）`);
    });
  }

  return (
    <OpsShell
      active="feedback"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>教学反馈</p>
            <h1>点评草稿、正式发布与成长报告</h1>
          </div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        {message && <p>{message}</p>}
        <form className="ops-form" onSubmit={generateDraft}>
          <label>
            作品提交 ID
            <input
              value={workSubmissionId}
              onChange={(event) => setWorkSubmissionId(event.target.value)}
              required
            />
          </label>
          <button className="ops-primary" disabled={loading}>
            生成 AI 点评草稿
          </button>
        </form>
        {draftContent && (
          <section>
            <h2>AI 草稿（只读，不自动发布）</h2>
            <pre>{draftContent}</pre>
          </section>
        )}
        <form className="ops-form" onSubmit={saveAndPublish}>
          <label>
            正式点评正文
            <textarea
              value={formalBody}
              onChange={(event) => setFormalBody(event.target.value)}
              rows={6}
              required
            />
          </label>
          <button className="ops-primary" disabled={loading}>
            保存并人工发布
          </button>
        </form>
        <button
          type="button"
          className="ops-primary"
          disabled={loading || !formalId}
          onClick={() => void copyWechat()}
        >
          生成每课一报微信文案
        </button>
        {wechatCopy && (
          <section>
            <h2>微信可复制文案</h2>
            <textarea readOnly value={wechatCopy} rows={12} />
          </section>
        )}
        <button
          type="button"
          className="ops-primary"
          disabled={loading || !workSubmissionId}
          onClick={() => void runFiveDim()}
        >
          生成并确认五维评价
        </button>
        {fiveDimSummary && (
          <p>
            五维草稿 {fiveDimId}：{fiveDimSummary}
          </p>
        )}
        <form className="ops-form" onSubmit={runReport}>
          <label>
            学生档案 ID
            <input
              value={studentProfileId}
              onChange={(event) => setStudentProfileId(event.target.value)}
              required
            />
          </label>
          <label>
            班级 ID
            <input
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              required
            />
          </label>
          <label>
            教师观察
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              rows={3}
            />
          </label>
          <button className="ops-primary" disabled={loading}>
            生成并发布第4节成长报告
          </button>
        </form>
        {reportId && <p>已发布报告：{reportId}</p>}
      </>
    </OpsShell>
  );
}
