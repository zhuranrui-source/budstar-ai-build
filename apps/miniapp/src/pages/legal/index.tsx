import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect } from 'react';
import {
  LEGAL_VERSION,
  PRIVACY_POLICY,
  USER_AGREEMENT,
} from '../../utils/legal';
import './index.css';

export default function LegalPage() {
  const { params } = useRouter();
  const isPrivacy = params.kind === 'privacy';
  const title = isPrivacy ? '隐私政策' : '用户服务协议';
  const sections = isPrivacy ? PRIVACY_POLICY : USER_AGREEMENT;

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title });
  }, [title]);

  return (
    <ScrollView scrollY className="legal-page">
      <Text className="legal-title">{title}</Text>
      <Text className="legal-meta">版本：{LEGAL_VERSION}</Text>
      {sections.map((section) => (
        <View key={section.title} className="legal-section">
          <Text className="legal-section-title">{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} className="legal-paragraph">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
