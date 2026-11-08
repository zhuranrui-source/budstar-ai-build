import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

export default function ProfilePage() {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(Taro.getStorageSync('displayName') || '用户');
  }, []);

  function handleLogout() {
    Taro.removeStorageSync('accessToken');
    Taro.removeStorageSync('displayName');
    Taro.navigateTo({ url: '/pages/login/index' });
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="h1">{name}</Text>
        <Text className="sub">BudStar 星芽 · 家长用户</Text>
      </View>
      <View className="section">
        <Button type="default" onClick={handleLogout}>
          退出登录
        </Button>
      </View>
    </View>
  );
}
