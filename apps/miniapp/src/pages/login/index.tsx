import { useState } from 'react';
import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { wechatLogin, wechatBindPhone } from '../../utils/api';

/**
 * 登录页（ADR-0006）：wx.login 静默登录为身份底座；
 * 进入家庭内容时一键授权手机号绑定（拒绝授权时由短信兜底，见 spec）。
 */
export default function LoginPage() {
  const [session, setSession] = useState<{
    accessToken: string;
    displayName: string;
  } | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setStatus('');
    try {
      const { code } = await Taro.login();
      const result = await wechatLogin(code);
      setSession({
        accessToken: result.accessToken,
        displayName: result.actor.displayName,
      });
      setStatus('登录成功');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleGetPhoneNumber(detail: { code?: string }) {
    if (!session?.accessToken || !detail.code) {
      setStatus('未获取到手机号授权');
      return;
    }
    setLoading(true);
    try {
      await wechatBindPhone(session.accessToken, detail.code);
      setStatus('手机号绑定成功，可以进入家庭视图');
      Taro.switchTab({ url: '/pages/family/index' });
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '绑定失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="login-page">
      <Text className="login-title">BudStar 星芽</Text>
      <Text className="login-subtitle">家长学生共用家庭视图 · 亲子共学</Text>
      {session ? (
        <View className="login-bind">
          <Text>已登录：{session.displayName}</Text>
          <Button
            openType="getPhoneNumber"
            onGetPhoneNumber={(event) =>
              void handleGetPhoneNumber(event.detail)
            }
            disabled={loading}
          >
            微信手机号一键绑定
          </Button>
          <Text className="login-hint">
            绑定后即可查看已绑定孩子的作品、点评和成长报告
          </Text>
        </View>
      ) : (
        <Button loading={loading} onClick={() => void handleLogin()}>
          微信一键登录
        </Button>
      )}
      {status ? <Text role="status">{status}</Text> : null}
    </View>
  );
}
