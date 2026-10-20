import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 读取 package.json 获取版本号
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const version = packageJson.version;

export default defineConfig(({ mode }) => {
  // 根据环境设置base路径
  const isGitHubPages = process.env.GITHUB_PAGES === 'true'
  const base = isGitHubPages ? '/SVG-Morpheus-ts/' : '/'
  
  // 备选方案：也可以使用 import.meta.env
  // 在 .env 文件中设置：VITE_SVG_BASE_PATH=/SVG-Morpheus-ts/
  // 然后在JS中使用：import.meta.env.VITE_SVG_BASE_PATH
  
  const isDemo = mode === 'demo';
  const isCore = mode === 'core';
  const isDev = mode === 'development' || !mode || mode === 'dev';
  
  return {
    // 根据模式设置不同的root
    root: (isDemo || isDev) ? 'demos' : '.',
    base,
    publicDir: (isDemo || isDev) ? '../public' : 'public',
    
    // 定义全局常量，在开发和构建环境都可用
    define: {
      __SVG_BASE_PATH__: JSON.stringify(base),
      __IS_GITHUB_PAGES__: JSON.stringify(isGitHubPages)
    },
    
    plugins: [
      // 只在库模式下使用dts插件
      ...(isDemo || isDev ? [] : [dts({ insertTypesEntry: true })]),
    ],
    
    build: isDemo ? {
      // Demo构建配置
      outDir: '../dist-demo',
      emptyOutDir: true,
      target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
      minify: 'terser',
      terserOptions: {
        format: {
          comments: /^!/,
        },
      },
      rollupOptions: {
        input: './demos/index.html',
        output: {
          format: 'es',
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash].[ext]',
          banner: () => `/*!
 * SVG Morpheus TypeScript Demo - Compiled Version
 * Version: v${version}
 * Build Date: ${new Date().toISOString()}
 * Repository: https://github.com/adoin/SVG-Morpheus-ts
 */`,
        },
      },
    } : {
      // Core is built after the main bundle into the same output directory.
      emptyOutDir: !isCore,
      // 库构建配置
      lib: {
        entry: isCore ? './src/core.ts' : './src/index.ts',
        name: 'SVGMorpheus',
        formats: isCore ? ['es', 'cjs'] : ['es', 'cjs', 'umd'],
        fileName: (format) => {
          switch (format) {
            case 'es':
              return isCore ? 'core.js' : 'index.js';
            case 'cjs':
              return isCore ? 'core.cjs' : 'index.cjs';
            case 'umd':
              return 'index.umd.js';
            default:
              return `index.${format}.js`;
          }
        },
      },
      rollupOptions: {
        external: [],
        output: {
          exports: 'named',
          globals: {},
        },
      },
    },
    
    server: {
      port: isDemo ? 9111 : 9001,
      open: isDev ? '/' : (isDemo ? '/' : '/demos/index.html'),
    },
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'svg-morpheus-ts': resolve(__dirname, 'src/index.ts'),
      },
    },
  };
}); 