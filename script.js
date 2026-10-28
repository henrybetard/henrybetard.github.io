// 1. 主题切换
const themeBtn = document.getElementById('themeBtn');

// 读取上次保存的主题
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

themeBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// 2. 自动显示当前年份
const yearEl = document.getElementById('year');
yearEl.textContent = new Date().getFullYear();