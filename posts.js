window.POSTS = [
  {
    slug: 'test-post',          // 改为 ASCII，URL 更干净、更抗截断
    title: '第0篇：这是一个示例标题',
    date: '2026-10-28',
    tags: ['测试'],
    summary: '一些示例内容',
    content: `
      <p>示例示例示例示例示例示例</p>
      <h3>示例示例示例</h3>
      <ul>
        <li>示例示例示例示例示例示例示例示例</li>
        <li>示例示例示例示例示例示例示例示例示例示例</li>
        <li>飞扬的小鸟三维DP已经写出来了，前往 NSOJ 观看</li>
      </ul>
    `
  },
  {
    slug: 'css-vars',
    title: '用 CSS 变量做主题',
    date: '2026-10-25',
    tags: ['CSS', '前端'],
    summary: '只需要在 html 上切换一个类名，所有颜色自动跟着变。',
    content: `
      <p>核心思路是把颜色抽成变量，深色主题只覆盖变量值：</p>
      <pre><code>:root { --bg: #ffffff; }
html.dark { --bg: #121212; }</code></pre>
      <p>组件里一律用 <code>var(--bg)</code>，就再也不用写第二套样式了。</p>
      <h3>顺带解决对比度</h3>
      <p>按钮背景和文字也拆成变量，深色主题下换成"亮底深字"，避免白字配浅蓝看不清。</p>
    `
  }
];