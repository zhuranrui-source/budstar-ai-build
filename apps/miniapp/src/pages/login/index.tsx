import { useState, useEffect } from 'react';
import { View, Text, Button, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  wechatLogin,
  wechatBindPhone,
  requestParentOtp,
  verifyParentOtp,
} from '../../utils/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'wechat' | 'sms'>('wechat');
  const [session, setSession] = useState<{
    accessToken: string;
    displayName: string;
  } | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    const saved = Taro.getStorageSync('accessToken');
    if (saved) Taro.switchTab({ url: '/pages/family/index' });
  }, []);

  function done(accessToken: string, displayName: string) {
    Taro.setStorageSync('accessToken', accessToken);
    setSession({ accessToken, displayName });
    Taro.switchTab({ url: '/pages/family/index' });
  }

  async function wxLogin() {
    setLoading(true);
    setStatus('');
    try {
      const { code } = await Taro.login();
      const r = await wechatLogin(code);
      done(r.accessToken, r.actor?.displayName ?? '微信用户');
    } catch (c) {
      setStatus(c instanceof Error ? c.message : '微信登录失败');
    } finally {
      setLoading(false);
    }
  }

  async function bindPhone(e: { detail?: { code?: string } }) {
    if (!session?.accessToken || !e?.detail?.code) return;
    setLoading(true);
    try {
      await wechatBindPhone(session.accessToken, e.detail.code);
      setStatus('绑定成功');
      Taro.switchTab({ url: '/pages/family/index' });
    } catch (c) {
      setStatus(c instanceof Error ? c.message : '绑定失败');
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    if (phone.length !== 11) {
      setStatus('请填 11 位手机号');
      return;
    }
    setLoading(true);
    try {
      await requestParentOtp(phone);
      setStatus('验证码已发送');
    } catch (c) {
      setStatus(c instanceof Error ? c.message : '发送失败');
    } finally {
      setLoading(false);
    }
  }

  async function smsLogin() {
    if (otp.length !== 6) {
      setStatus('请填 6 位验证码');
      return;
    }
    setLoading(true);
    try {
      const r = await verifyParentOtp(phone, otp);
      done(r.accessToken, r.actor?.displayName ?? '家长用户');
    } catch (c) {
      setStatus(c instanceof Error ? c.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView scrollY className="page">
      <View className="section">
        <Text className="h1">BudStar 星芽</Text>
        <Text className="sub">AI 互动探究学习工具 · 家长学生共用家庭视图</Text>
      </View>

      {status ? (
        <View className="notice-box">
          <Text className="notice">{status}</Text>
        </View>
      ) : null}

      {session ? (
        <View className="section">
          <Text className="h2">已登录：{session.displayName}</Text>
          <Text className="muted">绑定手机号后可查看家庭课节、作品与成长报告。</Text>
          <View className="btn-col">
            <Button
              type="primary"
              loading={loading}
              openType="getPhoneNumber"
              onGetPhoneNumber={(e) => void bindPhone(e)}
            >
              微信手机号一键绑定
            </Button>
            <Button
              type="default"
              onClick={() => Taro.switchTab({ url: '/pages/family/index' })}
            >
              进入家庭视图
            </Button>
          </View>
        </View>
      ) : mode === 'wechat' ? (
        <View className="section">
          <Text className="h2">微信登录</Text>
          <Text className="muted">使用微信身份快速登录，无需填写手机号即可浏览。</Text>
          <View className="btn-col">
            <Button
              type="primary"
              loading={loading}
              onClick={() => void wxLogin()}
            >
              微信一键登录
            </Button>
          </View>
        </View>
      ) : (
        <View className="section">
          <Text className="h2">短信验证码登录</Text>
          <Input
            className="ipt"
            type="number"
            maxlength={11}
            placeholder="手机号"
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
          <View className="otp-row">
            <Input
              className="ipt otp-input"
              type="number"
              maxlength={6}
              placeholder="验证码"
              value={otp}
              onInput={(e) => setOtp(e.detail.value)}
            />
            <Button
              className="otp-btn"
              size="mini"
              disabled={loading || phone.length !== 11}
              onClick={() => void sendOtp()}
            >
              获取验证码
            </Button>
          </View>
          <View className="btn-col">
            <Button
              type="primary"
              loading={loading}
              disabled={otp.length !== 6}
              onClick={() => void smsLogin()}
            >
              验证码登录
            </Button>
          </View>
        </View>
      )}

      {!session ? (
        <Text
          className="link"
          onClick={() => {
            setStatus('');
            setMode(mode === 'wechat' ? 'sms' : 'wechat');
          }}
        >
          {mode === 'wechat' ? '微信授权不可用？改用短信登录' : '返回微信登录'}
        </Text>
      ) : null}
    </ScrollView>
  );
}
