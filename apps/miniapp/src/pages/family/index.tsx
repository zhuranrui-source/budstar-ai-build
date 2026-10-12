import { View, Text } from '@tarojs/components';

/**
 * 家庭视图占位页（ADR-0007）：完整课节/作品/星球/报告
 * 在 ISSUE-05 落地；本页先承接登录后的入口导航。
 */
export default function FamilyPage() {
  return (
    <View className="family-page">
      <Text className="family-title">家庭视图</Text>
      <Text className="family-hint">
        课节共学、作品提交、星芽星球与成长报告将在 ISSUE-05 接入
      </Text>
    </View>
  );
}
