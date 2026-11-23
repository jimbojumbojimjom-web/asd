const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,R=Math.random;
const PH=[[110,30,20],[65,25,18],[30,20,16],[10,18,14],[3,15,12]];
const html=fs.readFileSync(path.join(__dirname,'public','index.html'));
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html)});
const wss=new WebSocketServer({server:srv});
const players=new Map();let nid=1,lid=1,pieces=[],used=new Set(),loot=[],st,peak=0,over=false;
const send=(p,o)=>{if(p.ws.readyState===1)p.ws.send(JSON.stringify(o))};
const all=(o,except)=>{for(const p of players.values())if(p!==except)send(p,o)};
const alive=()=>[...players.values()].filter(p=>p.alive);
const num=v=>Number.isFinite(v)?v:0;
const mkLoot=(x,z,ty)=>({id:lid++,x,z,ty:ty||['ammo','wood','hp'][R()*3|0]});
const pub=()=>({x:st.x,z:st.z,r:st.r,t:st.t,hold:st.hold,ph:st.ph,done:st.done});
function spawn(p){const a=R()*6.28,d=R()*120;Object.assign(p,{x:Math.cos(a)*d,y:0,z:Math.sin(a)*d,yaw:0,hp:100,alive:true,k:0,lh:0})}
function init(p){send(p,{t:'init',id:p.id,x:p.x,z:p.z,pieces,loot,storm:pub()})}
function reset(){pieces=[];used.clear();loot=[];peak=0;over=false;
  st={x:0,z:0,r:190,hold:true,t:PH[0][1],ph:0,done:false};
  for(let i=0;i<60;i++)loot.push(mkLoot((R()-.5)*380,(R()-.5)*380));
  for(const p of players.values()){spawn(p);init(p)}}
function check(){const a=alive();
  if(!over&&(a.length===0||(peak>=2&&a.length===1))){over=true;
    all({t:'win',id:a[0]?a[0].id:0,n:a[0]?a[0].n:'Nobody'});setTimeout(reset,8000)}}
function kill(v,k){if(!v.alive)return;v.alive=false;const place=alive().length+1;
  send(v,{t:'dead',place});if(k)k.k++;
  const l=mkLoot(v.x,v.z);loot.push(l);all({t:'loot',...l});
  all({t:'feed',s:(k?k.n:'The storm')+' eliminated '+v.n});check()}
reset();
setInterval(()=>{const dt=.05;
  if(!st.done){st.t-=dt;
    if(st.hold){if(st.t<=0){const p=PH[st.ph],a=R()*6.28,d=R()*(st.r-p[0])*.9;
      st.a={x:st.x,z:st.z,r:st.r,tx:st.x+Math.cos(a)*d,tz:st.z+Math.sin(a)*d,tr:p[0]};st.hold=false;st.t=st.T=p[2]}}
    else{const u=1-Math.max(st.t,0)/st.T,a=st.a;
      st.x=a.x+(a.tx-a.x)*u;st.z=a.z+(a.tz-a.z)*u;st.r=a.r+(a.tr-a.r)*u;
      if(st.t<=0){st.ph++;if(st.ph>=PH.length)st.done=true;else{st.hold=true;st.t=PH[st.ph][1]}}}}
  peak=Math.max(peak,alive().length);
  for(const p of alive())if(Math.hypot(p.x-st.x,p.z-st.z)>st.r){p.hp-=dt*(1+st.ph*1.5);if(p.hp<=0)kill(p,null)}
  const f=n=>+n.toFixed(2);
  all({t:'p',s:alive().map(p=>[p.id,f(p.x),f(p.y),f(p.z),f(p.yaw),Math.round(p.hp),p.k]),st:pub()})},50);
wss.on('connection',ws=>{
  const p={ws,id:nid++,n:'Player',alive:false,x:0,y:0,z:0,yaw:0,hp:0,k:0,lh:0};
  ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch{return}
    if(m.t==='join'){p.n=String(m.name||'Player').replace(/[<>&]/g,'').slice(0,12)||'Player';
      players.set(p.id,p);spawn(p);init(p);all({t:'feed',s:p.n+' joined'},p);return}
    if(!players.has(p.id)||!p.alive)return;
    if(m.t==='s'){const c=(v,l)=>Math.max(-l,Math.min(l,num(v)));p.x=c(m.x,205);p.z=c(m.z,205);p.y=c(m.y,200);p.yaw=num(m.yaw)}
    else if(m.t==='shot'){if(Array.isArray(m.a)&&Array.isArray(m.b))all({t:'shot',a:m.a.map(num),b:m.b.map(num)},p)}
    else if(m.t==='hit'){const v=players.get(m.id),now=Date.now();
      if(v&&v!==p&&v.alive&&now-p.lh>=90&&Math.hypot(p.x-v.x,p.z-v.z)<=230){p.lh=now;v.hp-=20;if(v.hp<=0)kill(v,p)}}
    else if(m.t==='build'&&['wall','ramp','floor'].includes(m.ty)){
      const pc={ty:m.ty,cx:num(m.cx),cz:num(m.cz),base:num(m.base),dir:m.dir|0,D:Array.isArray(m.D)?m.D.map(num):[0,1]};
      const k=[pc.ty,pc.cx,pc.cz,pc.base,pc.ty==='wall'?pc.dir%2:pc.dir].join();
      if(!used.has(k)&&pieces.length<2000){used.add(k);pieces.push(pc);all({t:'piece',...pc},p)}}
    else if(m.t==='pick'){const l=loot.find(x=>x.id===m.id);
      if(l&&Math.hypot(p.x-l.x,p.z-l.z)<4){loot.splice(loot.indexOf(l),1);all({t:'gone',id:l.id});
        if(l.ty==='hp')p.hp=Math.min(100,p.hp+30);send(p,{t:'got',ty:l.ty})}}});
  ws.on('close',()=>{players.delete(p.id);check()})});
srv.listen(PORT,()=>console.log('Stormfall running at http://localhost:'+PORT));
