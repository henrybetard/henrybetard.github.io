window.POSTS = [
  {
    slug: 'test-post',
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
  },
  {
    slug: 'odd-records-repeat-queue',
    title: '算法笔记：奇数记录 & 周期队列',
    date: '2026-10-28',
    tags: ['算法', '题解', 'C++'],
    summary: '两道题的思路整理：T1 用双堆维护奇偶次数，T2 用循环节加无冲突哈希压缩队列状态。',
    content: `
      <h3>T1 奇数记录</h3>
      <p><strong>简化题意</strong>：有 1~n 这些数，每种数有 h[i] 个，要求构造一个长度为 m 的序列，使得对于任意 1&lt;=t&lt;=m 有出现次数为奇数的数的个数 Ht=ht。无法构造输出 "NO"，可以构造则输出 "YES" 以及构造出的序列。</p>
      <p>由于 0 也是偶数，所以当我们放入一个数后，会使一个奇数次数变为偶数次数，或使一个偶数次数变为奇数次数，所以：</p>
      <p><strong>对于任意 1&lt;=t&lt;=m，在位置 t 放入一个数后，出现次数为奇数的数的个数要么 +1，要么 -1。</strong></p>
      <p>所以当 h[i]==h[i-1]+1 时，若所有已经出现次数为偶数的数都已经用完了，无法将偶数变为奇数，就无法构造出一个合法序列；同样的当 h[i]==h[i-1]-1 时，若所有已经出现次数为奇数的数都已经用完了，也无法构造出一个合法序列；若当前不属于两种情况中的任意一种，就更不可能构造出了。</p>
      <p>所以我们在每次选择时，应当先选择剩余次数最多的数，保证能尽可能构造出合法序列。</p>
      <p>那么我们可以定义两个二元组类型大根堆，一个存已出现次数为偶数的数，一个存已出现次数为奇数的数，二元组第一项存剩余可选次数，第二项存这一项对应的数是哪一个。当我们需要选择一个数时，就把对应类型的堆顶的二元组拿出，将剩余次数 -1，若剩余次数比 0 大，就放到另一个堆里。</p>
      <h4>AC 代码</h4>
      <pre><code>#include&lt;bits/stdc++.h&gt;
using namespace std;
#define ff first
#define ss second
const int N=2e5+20;
int n,m,t,h[N],f[N],gz[N];

int main(){
    freopen("oddrecords.in","r",stdin);
    freopen("oddrecords.out","w",stdout);
    cin&gt;&gt;t;
    while(t--){
        priority_queue&lt;pair&lt;int,int&gt;&gt;ous;
        priority_queue&lt;pair&lt;int,int&gt;&gt;js;
        cin&gt;&gt;n&gt;&gt;m;
        long long sumF=0;
        for(int i=1;i&lt;=n;i++){
            cin&gt;&gt;f[i];
            sumF+=f[i];
        }
        for(int j=1;j&lt;=m;j++){
            cin&gt;&gt;h[j];
        }
        if(sumF!=m){
            cout&lt;&lt;"NO\\n";
            continue;
        }
        bool f2=false;
        for(int i=1;i&lt;=n;i++){
            if(f[i]&gt;0){
                ous.push({f[i],i});    
            }
        }
        for(int i=1;i&lt;=m;i++){
            if(h[i]==h[i-1]+1){
                if(ous.empty()){
                    cout&lt;&lt;"NO"&lt;&lt;endl;
                    f2=true;
                    break;
                }
                else{
                    gz[i]=ous.top().ss;
                    if(ous.top().ff-1&gt;0){
                        pair&lt;int,int&gt; tmp=ous.top();
                        ous.pop();
                        js.push({tmp.ff-1,tmp.ss});
                    }
                    else{
                        ous.pop();
                    }
                }
            }
            else if(h[i]==h[i-1]-1){
                if(js.empty()){
                    cout&lt;&lt;"NO"&lt;&lt;endl;
                    f2=true;
                    break;
                }
                else{
                    gz[i]=js.top().ss;
                    if(js.top().ff-1&gt;0){
                        pair&lt;int,int&gt; tmp=js.top();
                        js.pop();
                        ous.push({tmp.ff-1,tmp.ss});
                    }
                    else{
                        js.pop();
                    }
                }
            }
            else{
                cout&lt;&lt;"NO"&lt;&lt;endl;
                f2=true;
                break;
            }
        }
        if(!f2){
            cout&lt;&lt;"YES"&lt;&lt;endl;
            for(int i=1;i&lt;=m;i++){
                cout&lt;&lt;gz[i]&lt;&lt;" ";
            }
            cout&lt;&lt;endl;
        }
    }
}</code></pre>

      <h3>T2 周期队列</h3>
      <p><strong>简化题意</strong>：有一个由 (k/n) 个长度为 n 的二进制串 w 和一个长度为 (k%n) 的二进制串 w 的前缀组成的一个长度为 k 的二进制串。依次读入这个二进制串的每一位，若队列非空且队首元素等于当前读到的这一位，就弹出队首继续读下一位；否则将当前这一位加入队列。问处理完整个二进制串后，队列的长度和队列的每一个元素（长度为 0 不输出）。</p>

      <h4>24 分做法</h4>
      <p>暴力模拟 + 特殊性质 A（奇偶判断）可得 24 分。当满足特殊性质 A 时，若 w 长度为奇数，则队列长度为 1，队列中的元素为 w 中任意一个字符；若长度为偶数，则队列为空。</p>

      <p>接下来的做法核心都是找循环节，利用循环节跳过中间漫长的无效遍历，只是找循环节的方式略有不同。</p>

      <h4>36 分做法</h4>
      <p>先正常模拟，每遍历一遍后使用 Hash 表记录队列里元素的状态和下标，若当前状态已经出现过，则得出上一次出现此状态的下标，得到循环开始的地方 beg 和循环节长度 len，然后跳出正常循环，重新模拟读入 beg-1 遍二进制串 w，再模拟读入 (k/n-beg-1)%len 遍二进制串 w，最后模拟读入剩下的二进制串前缀，然后就可以正常输出；若未出现过该状态，则将状态映射成一个值，加入 hash 表中。每出现过循环节就一直正常模拟，由于出现循环节和未出现循环节都需要读入剩下的二进制串前缀，可以把读入剩下的二进制串前缀放在 if 的外面。</p>
      <pre><code>#include&lt;bits/stdc++.h&gt;
using namespace std;
#define ll long long
const int N = 2e3 + 20, M = 1e6 + 20;
const int P = 131, MOD = 999991;
int w[N], t, n;
int head[M], tim[M], cur_tim;
int jc[N]; 
ll k;
int main(){
    freopen("repeatqueue.in","r",stdin);
    freopen("repeatqueue.out","w",stdout);
    ios::sync_with_stdio(false);
    cin.tie(0);
    jc[0] = 1;
    for(int i = 1; i &lt;= N - 10; i++){
        jc[i] = 1LL * jc[i-1] * P % MOD;
    }
    cin &gt;&gt; t;
    while(t--){
        cin &gt;&gt; n &gt;&gt; k;
        string a;
        cin &gt;&gt; a;
        for(int i = 1; i &lt;= n; i++){
            w[i] = a[i-1] - '0';
        }
        ll nn = k / n;
        ll r  = k % n;
        deque&lt;int&gt; q;
        bool f = false;
        int beg = 0, len = 0;
        cur_tim++;  
        for(ll i = 1; i &lt;= nn; i++){
            for(int j = 1; j &lt;= n; j++){
                if(!q.empty() &amp;&amp; q.front() == w[j]){
                    q.pop_front();
                }else{
                    q.push_back(w[j]);
                }
            }
            int val = 0, tt = 1;
            for(int x:q){
                val = (val + 1LL * x * jc[tt]) % MOD;
                tt++;
            }
            if(tim[val] == cur_tim){
                beg = head[val];
                len = i - beg;
                f = true;
                break;
            }else{
                tim[val] = cur_tim;
                head[val] = i;
            }
        }
        if(f){
            ll rem = (nn - beg) % len;
            for(ll i = 1; i &lt;= rem; i++){
                for(int j = 1; j &lt;= n; j++){
                    if(!q.empty() &amp;&amp; q.front() == w[j]){
                        q.pop_front();
                    }else{
                        q.push_back(w[j]);
                    }
                }
            }
        }
        for(int i = 1; i &lt;= r; i++){
            int c = w[i];
            if(!q.empty() &amp;&amp; q.front() == c){
                q.pop_front();
            }else{
                q.push_back(c);
            }
        }
        cout &lt;&lt; q.size() &lt;&lt; '\\n';
        if(!q.empty()){
            for(int x : q){
                cout &lt;&lt; x;
            }
            cout &lt;&lt; '\\n';
        }
    }
    return 0;
}</code></pre>
      <p>使用了时间戳因而 hash 表无需多测清空。</p>
      <p>很明显，被卡掉了很多分（双 hash 也只能得 36 分）。</p>

      <h4>96 分做法</h4>
      <p>与 36 分做法思路类似，只是用一个自定义类型 vector 来存储状态。</p>
      <p><strong>观察发现</strong>：该队列只由 a 个 0 和 b 个 1，或 a 个 1 和 b 个 0 组成，不会出现像 0...01.....10......0、1...10.....01......1 这样的 010 或 101 的情况，也就是说可以用队首元素、0 的个数、1 的个数来唯一确定队列的状态。vector 的四个元素分别为队首元素、0 的个数、1 的个数和下标。在程序中线性查找是否有相同状态，相同则表明出现循环节，进行 36 分做法中接下来的步骤，不同则将该状态加入数组中。</p>
      <pre><code>#include&lt;bits/stdc++.h&gt;
using namespace std;
#define ll long long
struct node{
    int a,b,c,d;
};
const int N = 2e3 + 20;
const int MOD1 = 999983, P1 = 131;
const int MOD2 = 999979, P2 = 13331;
const int M1 = MOD1 + 5;
const int M2 = MOD2 + 5;
int w[N], t, n;
int jc1[N],jc2[N];
ll k;
int main(){
    freopen("repeatqueue.in","r",stdin);
    freopen("repeatqueue.out","w",stdout);
    ios::sync_with_stdio(false);
    cin.tie(0);
    cin &gt;&gt; t;
    while(t--){
        vector&lt;node&gt; vec;
        cin &gt;&gt; n &gt;&gt; k;
        string a;
        cin &gt;&gt; a;
        for(int i = 1; i &lt;= n; i++){
            w[i] = a[i-1] - '0';
        }
        ll nn = k / n;
        ll r  = k % n;
        deque&lt;int&gt; q;
        bool f = false;
        int beg = 0, len = 0;
        for(ll i = 1; i &lt;= nn; i++){
            for(int j = 1; j &lt;= n; j++){
                if(!q.empty() &amp;&amp; q.front() == w[j]){
                    q.pop_front();
                }else{
                    q.push_back(w[j]);
                }
            }
            int q0 = 0, q1 = 0, h =q.front();
            for(int x : q){
                if(x==0) q0++;
                if(x==1) q1++;
            }
            bool cf=false;
            for(int j=0;j&lt;vec.size();j++){
                if(vec[j].a==h&amp;&amp;vec[j].b==q0&amp;&amp;vec[j].c==q1){
                    cf=true;
                    beg = vec[j].d;
                    break;
                }
            }
            if(cf){
                len = i - beg;
                f = true;
                break;
            }else{
                vec.push_back({h,q0,q1,i});
            }
        }
        if(f){
            ll rem = (nn - beg) % len;
            for(ll i = 1; i &lt;= rem; i++){
                for(int j = 1; j &lt;= n; j++){
                    if(!q.empty() &amp;&amp; q.front() == w[j]){
                        q.pop_front();
                    }else{
                        q.push_back(w[j]);
                    }
                }
            }
        }
        for(int i = 1; i &lt;= r; i++){
            int c = w[i];
            if(!q.empty() &amp;&amp; q.front() == c){
                q.pop_front();
            }else{
                q.push_back(c);
            }
        }
        cout &lt;&lt; q.size() &lt;&lt; '\\n';
        if(!q.empty()){
            for(int x : q){
                cout &lt;&lt; x;
            }
            cout &lt;&lt; '\\n';
        }
    }
    return 0;
}</code></pre>
      <p>线性查找时间复杂度最高会到 O(n^2)，导致超时。</p>

      <h4>满分做法</h4>
      <p>线性查找非常耗时，hash 查询能减少到 O(n)，所以我们还是回到 hash 思路。</p>
      <p>我们需要找到一种不会冲突的映射办法，结合 96 分做法的结论，我们将 <code>队首元素*(n+1)^2 + 0 的个数*(n+1) + 1 的个数</code> 作为映射值。</p>
      <p><strong>为什么这样不会冲突？</strong></p>
      <p>因为 0 和 1 的个数最多只能到 n，1 的个数永远小于 0 的个数*(n+1)，0 的个数*(n+1) 也永远小于 队首元素*(n+1)^2。</p>
      <p><strong>会因溢出而冲突吗？</strong></p>
      <p>队首元素为 0 或 1，1 的个数 + 0 的个数 &lt;= 2000，n &lt;= 2000，所以他们的和实际不会超过 (n+1)^2。</p>

      <h4>AC 代码</h4>
      <pre><code>#include&lt;bits/stdc++.h&gt;
using namespace std;
#define ll long long
struct node{
    int a,b,c,d;
};
int S; 
int get_id(int h, int q0, int q1){
    return h * S * S + q0 * S + q1;
};
const int N = 2e3 + 20;
int w[N], t, n;
int jc1[N],jc2[N];
ll k;
int main(){
    freopen("repeatqueue.in","r",stdin);
    freopen("repeatqueue.out","w",stdout);
    ios::sync_with_stdio(false);
    cin.tie(0);
    cin &gt;&gt; t;
    while(t--){
        vector&lt;node&gt; vec;
        cin &gt;&gt; n &gt;&gt; k;
        string a;
        cin &gt;&gt; a;
        for(int i = 1; i &lt;= n; i++){
            w[i] = a[i-1] - '0';
        }
        ll nn = k / n;
        ll r  = k % n;
        S = n + 1;
        int SZ = 3 * S * S;
        vector&lt;int&gt; seen(SZ, -1);
        deque&lt;int&gt; q;
        bool f = false;
        int beg = 0, len = 0;
        for(ll i = 1; i &lt;= nn; i++){
            for(int j = 1; j &lt;= n; j++){
                if(!q.empty() &amp;&amp; q.front() == w[j]){
                    q.pop_front();
                }else{
                    q.push_back(w[j]);
                }
            }
            int h;
            if(q.empty()){
                h =2;
            }
            else{
                h=q.front(); 
            }
            int q0=0,q1=0;
            for(int x : q){
                if(x==0) q0++;
                if(x==1) q1++;
            }
            bool cf=false;
            int id = get_id(h, q0, q1);
            if(seen[id] != -1){
                beg=seen[id];
                len=i-beg;
                f=true;
                break;
            }else{
                seen[id]=i;
            }
        }
        if(f){
            ll rem = (nn - beg) % len;
            for(ll i = 1; i &lt;= rem; i++){
                for(int j = 1; j &lt;= n; j++){
                    if(!q.empty() &amp;&amp; q.front() == w[j]){
                        q.pop_front();
                    }else{
                        q.push_back(w[j]);
                    }
                }
            }
        }
        for(int i = 1; i &lt;= r; i++){
            int c = w[i];
            if(!q.empty() &amp;&amp; q.front() == c){
                q.pop_front();
            }else{
                q.push_back(c);
            }
        }
        cout &lt;&lt; q.size() &lt;&lt; '\\n';
        if(!q.empty()){
            for(int x : q){
                cout &lt;&lt; x;
            }
            cout &lt;&lt; '\\n';
        }
    }
    return 0;
}</code></pre>
    `
  }
];