import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'budstar-family',
  framework: 'react',
  compiler: 'webpack5',
  sourceRoot: 'src',
  outputRoot: 'dist',
  mini: {
    webpackChain(chain) {
      // pnpm workspace 下 Taro 对 @tarojs/shared 生成的 alias 是多路径数组，
      // webpack 5.91 schema 不接受；钉到本包解析出的单一文件。
      try {
        chain.resolve.alias.set(
          '@tarojs/shared',
          require.resolve('@tarojs/shared'),
        );
      } catch {
        /* 解析失败则保留 Taro 默认值 */
      }
    },
  },
  h5: {},
});
