import { reviewReasonFor } from './content-filter';

describe('reviewReasonFor (星球内容兜底过滤)', () => {
  it('passes ordinary encouragement', () => {
    expect(
      reviewReasonFor('太棒了，继续加油！', '小星的机器人好酷'),
    ).toBeNull();
  });

  it('flags blocked words regardless of spacing and case', () => {
    expect(reviewReasonFor('加 V 了解')).toContain('加v');
    expect(reviewReasonFor('这里有赌博网站')).toContain('赌博');
  });

  it('flags private contact information', () => {
    expect(reviewReasonFor('电话 13912345678')).toBe('包含手机号');
    expect(reviewReasonFor('看 https://example.com')).toBe('包含外部链接');
    expect(reviewReasonFor('微信号: abc_12345')).toBe('包含联系方式');
  });
});
