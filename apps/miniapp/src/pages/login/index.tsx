import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import brandLogo from '../../assets/content/budstar-logo.jpeg';
import {
  wechatBindPhone,
  wechatLogin,
  type WechatSession,
} from '../../utils/api';
import {
  consumeLoginNotice,
  consumeAutoLoginSuppression,
  getValidSession,
  saveSession,
} from '../../utils/session';
import LegalConsent from '../../components/LegalConsent';
import { PHONE_WITH_PRIVACY, saveLegalConsent } from '../../utils/legal';
import './index.css';

type Feedback = { kind: 'success' | 'error' | 'info'; message: string } | null;
type PhoneNumberEvent = { detail?: { code?: string; errMsg?: string } };

export default function LoginPage() {
  const [restoring, setRestoring] = useState(true);
  const [pendingWechatSession, setPendingWechatSession] =
    useState<WechatSession | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const session = getValidSession();
    const notice = consumeLoginNotice();
    if (notice) setFeedback({ kind: 'info', message: notice });
    if (session) {
      enterApp();
      return;
    }
    setRestoring(false);
    // 不自动登录：须用户勾选同意协议后主动点击登录。
    consumeAutoLoginSuppression();
  }, []);

  /** 登录成功：回到触发登录的页面；直接打开登录页时回首页。 */
  function enterApp(): void {
    if (Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack();
      return;
    }
    void Taro.switchTab({ url: '/pages/home/index' });
  }

  async function handleWechatLogin(): Promise<void> {
    if (loading) return;
    if (!agreed) {
      setFeedback({
        kind: 'error',
        message: '请先阅读并勾选同意《用户服务协议》和《隐私政策》',
      });
      return;
    }
    saveLegalConsent();
    setLoading(true);
    setFeedback(null);
    try {
      const { code } = await Taro.login();
      if (!code) throw new Error('微信未返回登录凭证，请重试');
      const session = await wechatLogin(code);
      const stored = saveSession(session, 'wechat');
      if (stored.phoneBound) {
        enterApp();
      } else {
        setPendingWechatSession(session);
        setFeedback({
          kind: 'info',
          message:
            '微信登录成功。绑定手机号可匹配已有家庭账号，也可以稍后再绑定。',
        });
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        message:
          error instanceof Error ? error.message : '微信登录失败，请重试',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleBindPhone(event: PhoneNumberEvent): Promise<void> {
    const code = event.detail?.code;
    if (!pendingWechatSession || !code) {
      setFeedback({
        kind: 'error',
        message: '未获得手机号授权。你可以稍后再试，或使用短信验证码登录。',
      });
      return;
    }
    if (loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const session = await wechatBindPhone(
        pendingWechatSession.accessToken,
        code,
      );
      saveSession(session, 'wechat', true);
      await Taro.showToast({ title: '绑定成功', icon: 'success' });
      enterApp();
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : '手机号绑定失败',
      });
    } finally {
      setLoading(false);
    }
  }

  if (restoring) {
    return (
      <View className="login-page login-restoring">
        <Image className="brand-logo" src={brandLogo} mode="aspectFill" />
        <Text className="login-muted">正在恢复登录状态…</Text>
      </View>
    );
  }

  return (
    <View className="login-page">
      <View className="login-hero">
        <Image className="brand-logo" src={brandLogo} mode="aspectFill" />
        <Text className="login-title">BudStar 星芽</Text>
        <Text className="login-subtitle">陪伴每一次探索与成长</Text>
      </View>

      <View className="login-panel">
        {feedback ? (
          <View className={`feedback feedback--${feedback.kind}`}>
            <Text>{feedback.message}</Text>
          </View>
        ) : null}

        {pendingWechatSession ? (
          <>
            <Text className="panel-title">完善家庭账号</Text>
            <Text className="panel-description">
              绑定微信手机号后，可自动匹配已有家庭资料。手机号仅用于账号识别与安全验证。
            </Text>
            <Button
              className="primary-button"
              loading={loading}
              disabled={loading}
              openType={PHONE_WITH_PRIVACY}
              onGetPhoneNumber={(event) => void handleBindPhone(event)}
            >
              绑定微信手机号
            </Button>
            <Button
              className="secondary-button"
              disabled={loading}
              onClick={enterApp}
            >
              暂时跳过
            </Button>
          </>
        ) : (
          <>
            <Text className="panel-title">微信快捷登录</Text>
            <Text className="panel-description">
              使用当前微信身份安全登录，首次登录后可选择绑定手机号。
            </Text>
            <LegalConsent checked={agreed} onChange={setAgreed} />
            <Button
              className="primary-button wechat-button"
              loading={loading}
              disabled={loading}
              onClick={() => void handleWechatLogin()}
            >
              微信一键登录
            </Button>
          </>
        )}
      </View>

      <Text className="login-footnote">
        我们仅在你同意后获取微信身份标识；手机号仅在你主动点击绑定并授权后获取。
      </Text>
    </View>
  );
}
