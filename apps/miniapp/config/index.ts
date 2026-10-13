import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'budstar-family',
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    webpackChain(chain) {
      chain.resolve.extensions.add('.ts').add('.tsx');
    },
  },
  h5: {},
});
