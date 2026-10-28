// ============================================================
// 1. 主题切换
// ============================================================
const themeBtn = document.getElementById('themeBtn');
const root = document.documentElement;

const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
};

function syncButton() {
  if (!themeBtn) return;
  const isDark = root.classList.contains('dark');
  themeBtn.textContent = isDark ? '切换浅色' : '切换深色';
  themeBtn.setAttribute('aria-pressed', String(isDark));
}

syncButton();

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const isDark = root.classList.toggle('dark');
    store.set('theme', isDark ? 'dark' : 'light');
    syncButton();
  });
}

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
if (darkMedia.addEventListener) {
  darkMedia.addEventListener('change', (e) => {
    if (store.get('theme')) return;
    root.classList.toggle('dark', e.matches);
    syncButton();
  });
}

// ============================================================
// 2. 年份
// ============================================================
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ============================================================
// 3. 博客渲染
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(d);
}

function sortedPosts() {
  return [...(window.POSTS || [])].sort((a, b) => b.date.localeCompare(a.date));
}

function renderTags(tags) {
  return (tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');
}

// ---------- 列表页 ----------
const postList = document.getElementById('postList');
if (postList) {
  const posts = sortedPosts();

  if (!posts.length) {
    postList.innerHTML = '<li>还没有文章。</li>';
  } else {
    postList.innerHTML = posts.map((p) => `
      <li class="post-item">
        <a class="post-title" href="post.html?slug=${encodeURIComponent(p.slug)}">
          ${escapeHtml(p.title)}
        </a>
        <p class="post-meta">
          <time datetime="${escapeHtml(p.date)}">${formatDate(p.date)}</time>
          ${renderTags(p.tags)}
        </p>
        <p class="post-summary">${escapeHtml(p.summary || '')}</p>
      </li>
    `).join('');
  }
}

// ---------- 详情页 ----------
const postEl = document.getElementById('post');
if (postEl) {
  const slug = new URLSearchParams(location.search).get('slug');
  const post = (window.POSTS || []).find((p) => p.slug === slug);

  if (!post) {
    document.title = '文章不存在 · Henrybeta';
    postEl.innerHTML = `
      <h2>文章不存在</h2>
      <p>链接可能已经失效，<a href="blog.html">返回列表</a>。</p>
    `;
  } else {
    document.title = post.title + ' · Henrybeta';
    postEl.innerHTML = `
      <h2>${escapeHtml(post.title)}</h2>
      <p class="post-meta">
        <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
        ${renderTags(post.tags)}
      </p>
      <div class="post-content">${post.content}</div>
    `;
  }
}