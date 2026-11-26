import hero1 from '../assets/home/hero-1.png';
import hero2 from '../assets/home/hero-2.png';
import hero3 from '../assets/home/hero-3.png';
import hero4 from '../assets/home/hero-4.png';

export const HERO_ITEMS = [
  { label: 'AI 创作课', bg: '#F4845F', panel: '#F79B7F', image: hero1 },
  { label: '提示词训练', bg: '#6BBF7A', panel: '#85CC92', image: hero2 },
  { label: '成长作品集', bg: '#E882B4', panel: '#ED9DC4', image: hero3 },
  { label: 'AI 项目课', bg: '#6EB5FF', panel: '#8DC4FF', image: hero4 },
] as const;
