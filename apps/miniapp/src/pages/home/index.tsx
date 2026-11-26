import { useState } from 'react';
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { HERO_ITEMS } from '../../components/hero-items';
import './index.css';

export default function HomePage() {
  const [active, setActive] = useState(0);
  const current = HERO_ITEMS[active];

  function goAppointment(): void {
    Taro.setStorageSync('budstar.scrollToAppointment', '1');
    void Taro.switchTab({ url: '/pages/family/index' });
  }

  return (
    <View className="home-page" style={{ backgroundColor: current.bg }}>
      <Text className="home-hero-ghost">AI 课堂</Text>
      <View className="home-brand">
        <Text className="home-brand-name">星芽AI</Text>
        <View
          className="home-brand-link"
          onClick={() => Taro.switchTab({ url: '/pages/planet/index' })}
        >
          星芽星球 →
        </View>
      </View>
      <Swiper
        className="home-swiper"
        circular
        autoplay
        interval={4500}
        previousMargin="170rpx"
        nextMargin="170rpx"
        onChange={(event) => setActive(event.detail.current)}
      >
        {HERO_ITEMS.map((item, index) => (
          <SwiperItem key={item.label}>
            <View
              className={`home-slide${index === active ? ' is-active' : ''}`}
            >
              <Image
                className="home-slide-img"
                src={item.image}
                mode="aspectFit"
              />
            </View>
          </SwiperItem>
        ))}
      </Swiper>
      <View className="home-hero-copy">
        <Text className="home-hero-label">{current.label}</Text>
        <Text className="home-hero-desc">
          青少年 AI 实践学院。从体验入门到系统学习，让孩子在真实项目里完成作品。
        </Text>
        <View className="home-hero-cta" onClick={goAppointment}>
          预约体验
        </View>
      </View>
    </View>
  );
}
