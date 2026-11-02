// UI smoke test in a simulated DOM (jsdom). Start the app, then: npm i jsdom && BASE=http://localhost:8000/ node tests/ui_smoke.js
const {JSDOM,VirtualConsole}=require('jsdom'),B=process.env.BASE||'http://localhost:8000/',w=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const errs=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
 const dom=await JSDOM.fromURL(B,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(win){win.URL.createObjectURL=()=>'blob:demo';win.fetch=(u,o={})=>fetch(new URL(u,B),o)}});
 const win=dom.window,d=win.document,app=()=>d.querySelector('#app').textContent,res=[];
 const ck=(n,ok)=>res.push((ok?'PASS ':'FAIL ')+n),click=t=>[...d.querySelectorAll('button')].find(b=>b.textContent.includes(t))?.click();
 await w(300);ck('login screen',app().includes('Sign in'));
 d.querySelector('#ph').value='9000000001';win.login();await w(900);
 ck('customer home',app().includes('Reorder my medicines')&&app().includes('Running low')&&app().includes('Metformin'));
 ck('profiles in form',[...d.querySelectorAll('select[name=for_name] option')].some(o=>o.textContent==='Mother'));
 ck('sample order listed',app().includes('RX-50211'));
 win.out();await w(200);d.querySelector('#ph').value='9000000099';win.login();await w(1200);
 ck('pharmacist queue',app().includes('Verification queue')&&app().includes('RX-50214'));
 ck('review pane with actions',app().includes('Approve')&&app().includes('Telmisartan'));
 ck('prescription image beside items',!!d.querySelector('img.rx'));click('Dashboard');await w(800);ck('dashboard',app().includes('Median time to verify')&&app().includes('H1 register'));
 console.log(res.join('\n'));console.log('script errors:',errs.length?errs:'none');win.close();})();
