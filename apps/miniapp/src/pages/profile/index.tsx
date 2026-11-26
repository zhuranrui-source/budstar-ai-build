import { useCallback, useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { wechatBindPhone } from '../../utils/api';
import { listBoundStudents } from '../../utils/family-api';
import LoginRequired from '../../components/LoginRequired';
import { PHONE_WITH_PRIVACY, openLegal } from '../../utils/legal';
import {
  clearSession,
  getValidSession,
  saveSession,
  suppressNextAutoLogin,
  type StoredSession,
} from '../../utils/session';
import './index.css';

type PhoneNumberEvent = { detail?: { code?: string } };

export default function ProfilePage() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadProfile = useCallback(async (): Promise<void> => {
    const current = getValidSession();
    setSession(current);
    if (!current) return;
    const sequence = ++requestSequence.current;
    setError('');
    try {
      const switcher = await listBoundStudents(current.accessToken);
      if (sequence === requestSequence.current)
        setStudentCount(switcher.students.length);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setStudentCount(0);
      setError(caught instanceof Error ? caught.message : '账号信息加载失败');
    }
  }, []);

  useDidShow(() => {
    void loadProfile();
  });

  usePullDownRefresh(() => {
    void loadProfile().finally(() => Taro.stopPullDownRefresh());
  });

  async function handleBindPhone(event: PhoneNumberEvent): Promise<void> {
    const code = event.detail?.code;
    if (!session || !code) {
      setError('未获得手机号授权，请确认授权后重试');
      return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const next = await wechatBindPhone(session.accessToken, code);
      const stored = saveSession(next, 'wechat', true);
      setSession(stored);
      await Taro.showToast({ title: '绑定成功', icon: 'success' });
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '手机号绑定失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新验证身份才能查看家庭内容。',
      confirmText: '退出',
      confirmColor: '#d54941',
    });
    if (!result.confirm) return;
    suppressNextAutoLogin();
    clearSession();
    setSession(null);
    setStudentCount(0);
  }

  if (!session) {
    return (
      <View className="page tab-page profile-page">
        <View className="portal-page-head">
          <Text className="portal-kicker">MY BUDSTAR</Text>
          <Text className="portal-title">我的</Text>
        </View>
        <LoginRequired description="登录后可管理家庭成员、账号与隐私设置。" />
        <View className="profile-group">
          <View className="profile-row" onClick={() => openLegal('agreement')}>
            <Text className="profile-row-title">用户服务协议</Text>
            <Text className="profile-row-value">查看 ›</Text>
          </View>
          <View className="profile-row" onClick={() => openLegal('privacy')}>
            <Text className="profile-row-title">隐私政策</Text>
            <Text className="profile-row-value">查看 ›</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="page tab-page profile-page">
      <View className="portal-page-head">
        <Text className="portal-kicker">MY BUDSTAR</Text>
        <Text className="portal-title">我的</Text>
        <Text className="portal-description">
          管理家庭成员、账号与隐私设置。
        </Text>
      </View>

      <View className="profile-card">
        <View className="profile-avatar">
          {session.actor.displayName.slice(0, 1)}
        </View>
        <View className="profile-copy">
          <Text className="profile-name">{session.actor.displayName}</Text>
          <Text className="profile-role">星芽家长账号</Text>
        </View>
        <Text className="profile-badge">家庭</Text>
      </View>

      {error ? <View className="message message--error">{error}</View> : null}

      {!session.phoneBound ? (
        <View className="profile-todo">
          <View>
            <Text className="profile-todo-kicker">账号待完善</Text>
            <Text className="profile-todo-title">绑定手机号</Text>
            <Text className="profile-todo-description">
              匹配已有家庭资料，并提升账号找回能力。
            </Text>
          </View>
          <Button
            className="profile-todo-action"
            openType={PHONE_WITH_PRIVACY}
            loading={loading}
            disabled={loading}
            onGetPhoneNumber={(event) => void handleBindPhone(event)}
          >
            去绑定
          </Button>
        </View>
      ) : null}

      <View className="profile-group">
        <Text className="profile-group-title">账号与安全</Text>
        <View className="profile-row">
          <View>
            <Text className="profile-row-title">登录方式</Text>
            <Text className="profile-row-description">
              用于验证当前家长身份
            </Text>
          </View>
          <Text className="profile-row-value">
            {session.loginMethod === 'wechat' ? '微信登录' : '短信验证码'}
          </Text>
        </View>
        <View className="profile-row">
          <View>
            <Text className="profile-row-title">手机号</Text>
            <Text className="profile-row-description">账号匹配与安全验证</Text>
          </View>
          <Text
            className={
              session.phoneBound ? 'profile-row-success' : 'profile-row-value'
            }
          >
            {session.phoneBound ? '已绑定' : '未绑定'}
          </Text>
        </View>
      </View>

      <View className="profile-group">
        <Text className="profile-group-title">关于星芽</Text>
        <View className="profile-row">
          <View>
            <Text className="profile-row-title">帮助与反馈</Text>
            <Text className="profile-row-description">
              可通过所属校区老师获得帮助
            </Text>
          </View>
          <Text className="profile-row-value">服务支持</Text>
        </View>
        <View className="profile-row" onClick={() => openLegal('agreement')}>
          <Text className="profile-row-title">用户服务协议</Text>
          <Text className="profile-row-value">查看 ›</Text>
        </View>
        <View className="profile-row" onClick={() => openLegal('privacy')}>
          <Text className="profile-row-title">隐私政策</Text>
          <Text className="profile-row-value">查看 ›</Text>
        </View>
        <View className="profile-row">
          <Text className="profile-row-title">当前版本</Text>
          <Text className="profile-row-value">v0.2.1</Text>
        </View>
      </View>

      <Button className="logout-button" onClick={() => void handleLogout()}>
        退出登录
      </Button>
    </View>
  );
}
