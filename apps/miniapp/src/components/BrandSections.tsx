import { useEffect, useRef, useState } from 'react';
import { Button, Image, Input, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  createAppointmentLead,
  listPublicCampuses,
  type PublicCampus,
} from '../utils/api';
import { HERO_ITEMS } from './hero-items';
import './BrandSections.css';
import LegalConsent from './LegalConsent';

const PRODUCTS = [
  ['99元体验课', '1课时', '首次了解AI课堂，现场完成小作品，获得学习建议。'],
  ['学期课', '4480元 / 2个月', '16课时线下课 + 8课时答疑课，共24课时。'],
  ['AI亲子营', '980元', '亲子一起体验AI创作，假期到店、作品展示。'],
] as const;

const STEPS = [
  ['主题导入', '用故事、任务或真实问题进入课堂。'],
  ['AI共创', '孩子动手提问、生成、筛选和修改。'],
  ['老师点评', '老师帮助孩子说清楚作品思路。'],
  ['作品入档', '每次成果进入个人成长档案。'],
] as const;

const PATHS = [
  ['6-8岁', '星芽启萌', '认识AI能做什么，用图像、声音和故事完成第一件作品。'],
  [
    '9-11岁',
    '星芽探索',
    '围绕一个主题生成素材、筛选方案，并改出更完整的作品。',
  ],
  ['12-15岁', '星芽创新', '把想法整理成可展示的应用原型、短视频或主题项目。'],
] as const;

const THINKING = [
  ['提问意识', '把模糊想法变成清楚的问题。'],
  ['判断能力', '比较不同结果，说明为什么选择这一版。'],
  ['表达结构', '讲清目标、过程和作品亮点。'],
  ['迭代习惯', '愿意修改、复盘，再做出更好的一版。'],
] as const;

const EVENTS = [
  ['7月18日 14:00', 'AI体验开放日', '1课时到店体验'],
  ['7月19日 15:30', '创意挑战赛', '孩子创意挑战'],
  ['7月25日 19:30', '家长AI沙龙', '家长理解AI教育'],
  ['8月2日 16:00', '作品展示', '阶段成果开放看'],
] as const;

const TEACHERS = [
  ['林老师', 'AI创作导师', '引导想法表达', 0],
  ['周老师', '项目导师', '陪伴项目迭代', 3],
  ['陈老师', '家长沟通导师', '同步课堂反馈', 2],
  ['许老师', '作品展示导师', '训练表达展示', 1],
] as const;

const COURSES = ['AI 体验课', 'AI 星芽种子实验班', 'AI 亲子营'];

type Form = {
  parentName: string;
  phone: string;
  childAgeOrGrade: string;
  courseIndex: number;
  campusIndex: number;
  preferredContactTime: string;
};

const EMPTY_FORM: Form = {
  parentName: '',
  phone: '',
  childAgeOrGrade: '',
  courseIndex: -1,
  campusIndex: -1,
  preferredContactTime: '',
};

function newKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function BrandSections() {
  const [campuses, setCampuses] = useState<PublicCampus[]>([]);
  const [campusState, setCampusState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicCampuses()
      .then((items) => {
        if (cancelled) return;
        setCampuses(items);
        setCampusState(items.length > 0 ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setCampusState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    const parentName = form.parentName.trim();
    const phone = form.phone.trim();
    const childAgeOrGrade = form.childAgeOrGrade.trim();
    const preferredContactTime = form.preferredContactTime.trim();
    const campus = campuses[form.campusIndex];
    const course = COURSES[form.courseIndex];
    let problem = '';
    if (!parentName) problem = '请填写家长称呼';
    else if (!/^1[3-9]\d{9}$/.test(phone)) problem = '请填写 11 位手机号';
    else if (!childAgeOrGrade) problem = '请填写孩子年龄或年级';
    else if (!course) problem = '请选择感兴趣的课程';
    else if (!campus) problem = '请选择意向校区';
    else if (!preferredContactTime) problem = '请填写方便联系的时间';
    else if (!agreed)
      problem = '请先阅读并勾选同意《用户服务协议》和《隐私政策》';
    if (problem) {
      setFailed(true);
      setMessage(problem);
      return;
    }
    setSubmitting(true);
    setFailed(false);
    setMessage('');
    try {
      idempotencyKey.current ??= newKey();
      await createAppointmentLead(
        {
          parentName,
          phone,
          childAgeOrGrade,
          interestedCourse: course,
          campusId: campus.id,
          preferredContactTime,
        },
        idempotencyKey.current,
      );
      idempotencyKey.current = null;
      setForm(EMPTY_FORM);
      setMessage('预约已提交，校区老师会按你选择的时间联系。');
    } catch {
      setFailed(true);
      setMessage('暂时无法提交，请稍后重试。你填写的内容已保留。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="brand-sections">
      <View className="home-section" id="home-products">
        <Text className="home-label">课程产品</Text>
        <Text className="home-h2">产品介绍</Text>
        {PRODUCTS.map((item, index) => (
          <View key={item[0]} className="home-card">
            <Text className="home-card-no">
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text className="home-card-title">{item[0]}</Text>
            <Text className="home-card-sub">{item[1]}</Text>
            <Text className="home-card-text">{item[2]}</Text>
          </View>
        ))}
      </View>

      <View className="home-section home-section--tint">
        <Text className="home-label">课堂体验</Text>
        <Text className="home-h2">一节课怎么发生。</Text>
        <View className="home-grid">
          {STEPS.map((item, index) => (
            <View key={item[0]} className="home-card home-card--half">
              <Text className="home-card-no">
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text className="home-card-title">{item[0]}</Text>
              <Text className="home-card-text">{item[1]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="home-section">
        <Text className="home-label">成长路径</Text>
        <Text className="home-h2">按年龄进阶。</Text>
        <Text className="home-lead">从AI认知，到创意生成，再到项目发布。</Text>
        {PATHS.map((item, index) => (
          <View
            key={item[1]}
            className="home-path"
            style={{ backgroundColor: HERO_ITEMS[index].bg }}
          >
            <Text className="home-path-age">{item[0]}</Text>
            <Text className="home-path-title">{item[1]}</Text>
            <Text className="home-path-text">{item[2]}</Text>
          </View>
        ))}
      </View>

      <View className="home-section home-section--tint">
        <Text className="home-label">思维培养</Text>
        <Text className="home-h2">AI思维培养。</Text>
        <Text className="home-lead">
          AI课堂不是只学工具，而是训练孩子把想法说清楚、把结果看明白、把作品改得更好。
        </Text>
        <View className="home-grid">
          {THINKING.map((item) => (
            <View key={item[0]} className="home-card home-card--half">
              <Text className="home-card-title">{item[0]}</Text>
              <Text className="home-card-text">{item[1]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="home-section">
        <View className="home-report">
          <Text className="home-label home-label--light">星芽星球</Text>
          <Text className="home-report-title">家长看见每一次进步。</Text>
          <Text className="home-report-text">
            作品、老师点评和阶段成果，沉淀成孩子的AI成长档案。
          </Text>
          <View
            className="home-report-btn"
            onClick={() => Taro.switchTab({ url: '/pages/planet/index' })}
          >
            进入星球
          </View>
        </View>
      </View>

      <View className="home-section home-section--tint">
        <Text className="home-label">活动预告</Text>
        <Text className="home-h2">先体验，再决定。</Text>
        <Text className="home-lead">
          开放日、挑战赛、家长沙龙，先看真实课堂。
        </Text>
        {EVENTS.map((item) => (
          <View key={item[1]} className="home-event">
            <Text className="home-event-time">{item[0]}</Text>
            <Text className="home-event-title">{item[1]}</Text>
            <Text className="home-event-sub">{item[2]}</Text>
          </View>
        ))}
      </View>

      <View className="home-section">
        <Text className="home-label">师资与校区</Text>
        <Text className="home-h2">师资与校区</Text>
        <Text className="home-lead">
          师资雄厚，高学历导师团队，兼顾AI创作、项目引导和家长沟通。
        </Text>
        <View className="home-grid">
          {TEACHERS.map((item) => (
            <View key={item[0]} className="home-card home-card--half">
              <View
                className="home-avatar"
                style={{ backgroundColor: HERO_ITEMS[item[3]].bg }}
              >
                <Image
                  className="home-avatar-img"
                  src={HERO_ITEMS[item[3]].image}
                  mode="aspectFill"
                />
              </View>
              <Text className="home-card-title">{item[0]}</Text>
              <Text className="home-card-sub">{item[1]}</Text>
              <Text className="home-card-text">{item[2]}</Text>
            </View>
          ))}
        </View>
        <View className="home-address">
          <Text className="home-label">到店地址</Text>
          <Text className="home-card-title">深圳市南山区深云路2号</Text>
          <Text className="home-card-text">
            预约到店体验，现场了解课堂环境。
          </Text>
        </View>
      </View>

      <View className="home-section home-cta" id="home-appointment">
        <Text className="home-label home-label--light">星芽AI</Text>
        <Text className="home-cta-title">上一节真正的AI课。</Text>
        <View className="home-form">
          <Text className="home-form-title">预约到校体验</Text>
          <Text className="home-form-sub">先聊孩子，再聊课程</Text>

          <Text className="home-field">家长称呼</Text>
          <Input
            className="home-input"
            maxlength={50}
            placeholder="例如：陈女士"
            value={form.parentName}
            onInput={(e) => update('parentName', e.detail.value)}
          />
          <Text className="home-field">联系手机</Text>
          <Input
            className="home-input"
            type="number"
            maxlength={11}
            placeholder="11 位手机号"
            value={form.phone}
            onInput={(e) => update('phone', e.detail.value)}
          />
          <Text className="home-field">孩子年龄或年级</Text>
          <Input
            className="home-input"
            maxlength={30}
            placeholder="例如：10 岁 / 四年级"
            value={form.childAgeOrGrade}
            onInput={(e) => update('childAgeOrGrade', e.detail.value)}
          />
          <Text className="home-field">感兴趣的课程</Text>
          <Picker
            mode="selector"
            range={COURSES}
            value={Math.max(0, form.courseIndex)}
            onChange={(e) => update('courseIndex', Number(e.detail.value))}
          >
            <View className="home-input home-picker">
              {COURSES[form.courseIndex] ?? '请选择'}
            </View>
          </Picker>
          <Text className="home-field">意向校区</Text>
          <Picker
            mode="selector"
            range={campuses.map((c) => c.name)}
            disabled={campusState !== 'ready'}
            value={Math.max(0, form.campusIndex)}
            onChange={(e) => update('campusIndex', Number(e.detail.value))}
          >
            <View className="home-input home-picker">
              {campuses[form.campusIndex]?.name ??
                (campusState === 'loading'
                  ? '正在加载校区…'
                  : campusState === 'error'
                    ? '校区暂时不可用'
                    : '请选择校区')}
            </View>
          </Picker>
          <Text className="home-field">方便联系时间</Text>
          <Input
            className="home-input"
            maxlength={100}
            placeholder="例如：工作日 18:00 后"
            value={form.preferredContactTime}
            onInput={(e) => update('preferredContactTime', e.detail.value)}
          />

          <LegalConsent
            checked={agreed}
            onChange={setAgreed}
            prefix="提交即表示你同意我们为安排体验联系你，并已阅读"
          />
          <Button
            className="home-submit"
            loading={submitting}
            disabled={submitting || campusState !== 'ready'}
            onClick={() => void handleSubmit()}
          >
            提交预约
          </Button>
          <Text
            className={`home-form-note${failed ? ' home-form-note--error' : ''}`}
          >
            {message || '提交即表示同意校区为本次课程咨询联系你。'}
          </Text>
        </View>
      </View>
    </View>
  );
}
