import { Text, View } from '@tarojs/components';
import { openLegal } from '../utils/legal';
import './LegalConsent.css';

/** 协议勾选：默认不勾选，用户主动勾选后才可继续。 */
export default function LegalConsent({
  checked,
  onChange,
  prefix = '我已阅读并同意',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  prefix?: string;
}) {
  return (
    <View className="legal-consent">
      <View
        className={`legal-consent-box ${checked ? 'is-checked' : ''}`}
        onClick={() => onChange(!checked)}
      >
        {checked ? '✓' : ''}
      </View>
      <Text className="legal-consent-text">
        <Text onClick={() => onChange(!checked)}>{prefix}</Text>
        <Text
          className="legal-consent-link"
          onClick={() => openLegal('agreement')}
        >
          《用户服务协议》
        </Text>
        和
        <Text
          className="legal-consent-link"
          onClick={() => openLegal('privacy')}
        >
          《隐私政策》
        </Text>
      </Text>
    </View>
  );
}
