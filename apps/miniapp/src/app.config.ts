export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/family/index',
    'pages/lab/index',
    'pages/planet/index',
    'pages/profile/index',
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#1f6f5c',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/family/index', text: '家庭' },
      { pagePath: 'pages/lab/index', text: '实验室' },
      { pagePath: 'pages/planet/index', text: '星球' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1f6f5c',
    navigationBarTitleText: 'BudStar 星芽',
    navigationBarTextStyle: 'white',
  },
});
