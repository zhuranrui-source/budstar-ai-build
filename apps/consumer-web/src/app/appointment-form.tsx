'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createAppointmentLeadSchema } from '@budstar/contracts';
import type { PublicCampus } from '@budstar/contracts';
import { createPublicAppointmentLead, listPublicCampuses } from './public-api';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function AppointmentForm() {
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const [campuses, setCampuses] = useState<PublicCampus[]>([]);
  const [campusState, setCampusState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listPublicCampuses(controller.signal)
      .then((items) => {
        setCampuses(items);
        setCampusState(items.length > 0 ? 'ready' : 'error');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCampusState('error');
        }
      });

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    setMessage('');

    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      childAgeOrGrade: String(data.get('childAgeOrGrade') ?? ''),
      interestedCourse: String(data.get('interestedCourse') ?? ''),
      campusId: String(data.get('campusId') ?? ''),
      preferredContactTime: String(data.get('preferredContactTime') ?? ''),
    };
    const parsed = createAppointmentLeadSchema.safeParse(input);

    if (!parsed.success) {
      setState('error');
      setMessage(parsed.error.issues[0]?.message ?? '请检查填写内容');
      return;
    }

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      await createPublicAppointmentLead(parsed.data, idempotencyKey.current);

      form.reset();
      idempotencyKey.current = null;
      setState('success');
      setMessage('预约已提交，校区老师会按你选择的时间联系。');
    } catch {
      setState('error');
      setMessage('暂时无法提交，请稍后重试。你填写的内容仍保留在页面中。');
    }
  }

  return (
    <form
      className="toon-appointment"
      onSubmit={handleSubmit}
      aria-busy={state === 'submitting'}
    >
      <div className="form-heading">
        <span>预约到校体验</span>
        <strong>先聊孩子，再聊课程</strong>
      </div>

      <div className="field-grid">
        <label htmlFor="parentName">
          家长称呼
          <input
            id="parentName"
            name="parentName"
            autoComplete="name"
            maxLength={50}
            placeholder="例如：陈女士"
            required
          />
        </label>
        <label htmlFor="phone">
          联系手机
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            pattern="1[3-9][0-9]{9}"
            placeholder="11 位手机号"
            required
          />
        </label>
        <label htmlFor="childAgeOrGrade">
          孩子年龄或年级
          <input
            id="childAgeOrGrade"
            name="childAgeOrGrade"
            maxLength={30}
            placeholder="例如：10 岁 / 四年级"
            required
          />
        </label>
        <label htmlFor="interestedCourse">
          感兴趣的课程
          <select
            id="interestedCourse"
            name="interestedCourse"
            defaultValue=""
            required
          >
            <option value="" disabled>
              请选择
            </option>
            <option value="AI 体验课">AI 体验课</option>
            <option value="AI 星芽种子实验班">AI 星芽种子实验班</option>
            <option value="AI 亲子营">AI 亲子营</option>
          </select>
        </label>
        <label htmlFor="campusId">
          意向校区
          <select
            id="campusId"
            name="campusId"
            defaultValue=""
            disabled={campusState !== 'ready'}
            aria-describedby="campus-help"
            required
          >
            <option value="" disabled>
              {campusState === 'loading'
                ? '正在加载校区…'
                : campusState === 'error'
                  ? '校区暂时不可用'
                  : '请选择校区'}
            </option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
          <span id="campus-help" className="field-help">
            {campusState === 'error' ? '请稍后刷新页面，或联系校区老师。' : ''}
          </span>
        </label>
        <label htmlFor="preferredContactTime">
          方便联系时间
          <input
            id="preferredContactTime"
            name="preferredContactTime"
            maxLength={100}
            placeholder="例如：工作日 18:00 后"
            required
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={state === 'submitting' || campusState !== 'ready'}
      >
        {state === 'submitting' ? '正在提交…' : '提交预约'}
      </button>
      <p
        className={state === 'error' ? 'form-error' : 'form-message'}
        aria-live="polite"
        role={state === 'error' ? 'alert' : 'status'}
      >
        {message || '提交即表示同意校区为本次课程咨询联系你。'}
      </p>
    </form>
  );
}
