/**
 * 发布内容的基础过滤（先发后审的兜底）：命中即转入后台待处理，不直接展示。
 * 只做明显违规与“私下联系方式”拦截——平台涉及未成年人，不允许在公开区留联系方式。
 * 词表刻意保持精简，可按运营需要扩充；真正的内容安全以后台人工处理为准。
 */
const BLOCKED_WORDS = [
  '赌博',
  '博彩',
  '色情',
  '裸聊',
  '约炮',
  '毒品',
  '冰毒',
  '代孕',
  '枪支',
  '自杀',
  '贷款',
  '刷单',
  '兼职日结',
  '加微信',
  '加v',
  '加qq',
  '私聊我',
  '傻逼',
  '操你',
  '他妈的',
];

const CONTACT_PATTERNS: Array<[RegExp, string]> = [
  [/1[3-9]\d{9}/, '包含手机号'],
  [/https?:\/\/|www\.|\.com\b|\.cn\b/i, '包含外部链接'],
  [/(微信|vx|wx|v信|qq)[\s:：号]*[A-Za-z0-9_-]{5,}/i, '包含联系方式'],
];

/** 返回命中原因；未命中返回 null。 */
export function reviewReasonFor(...texts: string[]): string | null {
  const text = texts.join('\n');
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  const word = BLOCKED_WORDS.find((item) => normalized.includes(item));
  if (word) return `命中敏感词「${word}」`;
  for (const [pattern, reason] of CONTACT_PATTERNS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}
