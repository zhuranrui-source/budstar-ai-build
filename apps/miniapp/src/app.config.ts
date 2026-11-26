const previewMode = process.env.TARO_APP_PREVIEW_MODE === 'true';

export default defineAppConfig({
  pages: previewMode
    ? [
        'pages/home/index',
        'pages/family/index',
        'pages/lab/index',
        'pages/lab/detail/index',
        'pages/lab/content/index',
        'pages/planet/index',
        'pages/profile/index',
        'pages/login/index',
        'pages/legal/index',
      ]
    : [
        'pages/home/index',
        'pages/family/index',
        'pages/lab/index',
        'pages/lab/detail/index',
        'pages/lab/content/index',
        'pages/planet/index',
        'pages/profile/index',
        'pages/login/index',
        'pages/legal/index',
      ],
  tabBar: {
    color: '#76665f',
    selectedColor: '#f4845f',
    backgroundColor: '#fffaf6',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home-default.png',
        selectedIconPath: 'assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/family/index',
        text: '家庭',
        iconPath: 'assets/tabbar/home-default.png',
        selectedIconPath: 'assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/lab/index',
        text: '实验室',
        iconPath: 'assets/tabbar/lab-default.png',
        selectedIconPath: 'assets/tabbar/lab-active.png',
      },
      {
        pagePath: 'pages/planet/index',
        text: '星球',
        iconPath: 'assets/tabbar/planet-default.png',
        selectedIconPath: 'assets/tabbar/planet-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tabbar/profile-default.png',
        selectedIconPath: 'assets/tabbar/profile-active.png',
      },
    ],
  },
  window: {
    backgroundColor: '#fffaf6',
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#fffaf6',
    navigationBarTitleText: 'BudStar 星芽',
    navigationBarTextStyle: 'black',
  },
});
