import { View } from '@tarojs/components';
import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import BrandSections from '../../components/BrandSections';

/** 原“家庭”页中的品牌介绍与预约表单，独立成页。 */
export default function AppointmentPage() {
  useEffect(() => {
    setTimeout(() => {
      void Taro.pageScrollTo({ selector: '#home-appointment', duration: 300 });
    }, 400);
  }, []);
  return (
    <View className="page">
      <BrandSections />
    </View>
  );
}
