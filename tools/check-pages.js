const fs2 = require('fs');
const { chromium } = require('playwright');
const PAGES = ['index.html','service.html','portfolio.html','contact.html','hakadori.html','hakadori-guide.html'];
function lum(h){const c=h.match(/\w\w/g).map(x=>{let v=parseInt(x,16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
(async () => {
  // クラウド環境のプリインストール済みパスがあればそれを使い、無ければ通常インストール（npx playwright install）を使う
  const cloudPath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const launchOpts = { args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] };
  if (fs2.existsSync(cloudPath)) launchOpts.executablePath = cloudPath;
  const b = await chromium.launch(launchOpts);
  let bad = 0;
  for (const f of PAGES) {
    for (const [tag,w,h] of [['PC',1440,900],['SP',390,844]]) {
      const p = await b.newPage({ viewport:{width:w,height:h} });
      const errs=[]; p.on('pageerror',e=>errs.push(e.message));
      p.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_CERT|ERR_NAME|ERR_CONNECTION|ERR_BLOCKED|ERR_INTERNET/.test(t))errs.push(t)});
      const r404=[]; p.on('response',r=>{ if(r.status()>=400) r404.push(r.status()+' '+r.url().split('/').pop()); });
      await p.goto('http://127.0.0.1:8765/'+f,{waitUntil:'networkidle'});
      await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(6000);
      const H = await p.evaluate(()=>document.body.scrollHeight);
      let ox=false, hid=0, low=[];
      for (let y=0;y<=Math.max(0,H-h);y+=Math.max(1,Math.round(h/2))) {
        await p.evaluate(v=>window.scrollTo(0,v),y); await p.waitForTimeout(700);
        const v = await p.evaluate(()=>{
          const de=document.documentElement;
          const rgb=s=>{const m=s.match(/\d+/g);return m?('#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join('')):null;};
          const bad=[];
          // 半透明の地は、下の地と合成してから測る。
          // これをしないと rgba(255,255,255,0.08) を白として拾い、誤検出になる
          const parse=s=>{const m=s.match(/[\d.]+/g);return m?{r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}:null;};
          const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a), g:f.g*f.a+b.g*(1-f.a), b:f.b*f.a+b.b*(1-f.a), a:1});
          const hex=c=>'#'+[c.r,c.g,c.b].map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
          function bgOf(el){
            let acc={r:255,g:255,b:255,a:1}, chain=[];
            for(let e=el; e; e=e.parentElement){ const c=parse(getComputedStyle(e).backgroundColor); if(c&&c.a>0) chain.push(c); }
            acc = parse(getComputedStyle(document.body).backgroundColor) || acc;
            for(let i=chain.length-1;i>=0;i--) acc = over(chain[i], acc);
            return hex(acc);
          }
          document.querySelectorAll('p,li,h1,h2,h3,summary,a,span,td,th,b,i,em,strong').forEach(el=>{
            const bb=el.getBoundingClientRect();
            if(!(bb.height>8&&bb.top<innerHeight&&bb.bottom>0)) return;
            if(el.children.length) return;
            if(!(el.textContent||'').trim()) return;   // 文字を持たない飾りは測らない
            const cs=getComputedStyle(el);
            if(parseFloat(cs.opacity)===0) return;
            const fgc=parse(cs.color); if(!fgc||fgc.a<0.95) return;
            bad.push([el.tagName.toLowerCase()+'.'+String(el.className).split(' ')[0],
                      hex(fgc), bgOf(el), parseFloat(cs.fontSize), cs.fontWeight]);
          });
          const inv=[...document.querySelectorAll('section *, main *, footer *')].filter(el=>{
            if(el.closest('.orbits')) return false;
            const bb=el.getBoundingClientRect();
            // 下端に入った直後はまだ演出が発火していないのが正しい挙動なので、
            // 画面の内側（下端から120px以上）に入ってから数える
            return bb.height>18 && bb.top<innerHeight-120 && bb.bottom>0 && parseFloat(getComputedStyle(el).opacity)===0;
          }).length;
          return { ox: de.scrollWidth>de.clientWidth, inv, bad };
        });
        if(v.ox) ox=true; hid=Math.max(hid,v.inv);
        v.bad.forEach(([n,fg,bg,fs,fw])=>{
          const l1=lum(fg.slice(1)),l2=lum(bg.slice(1));
          const c=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
          const big = fs>=24 || (fs>=18.66 && +fw>=700);
          if (c < (big?3:4.5)) low.push(n+' '+c.toFixed(2)+' ('+fs+'px)');
        });
      }
      low=[...new Set(low)];
      const ok = !ox && !errs.length && !r404.length && hid===0 && low.length===0;
      if(!ok) bad++;
      console.log((ok?'OK  ':'NG  ')+f.padEnd(21)+tag,
        '横溢れ',ox?'あり':'なし','｜隠れ',hid,'｜404',r404.length?r404.slice(0,3):'なし',
        '｜低コントラスト',low.length?low.slice(0,3):'なし','｜エラー',errs.length?errs.slice(0,2):'なし');
      await p.close();
    }
  }
  await b.close();
  console.log(bad?('要修正 '+bad+'件'):'全ページ通過');
})();
