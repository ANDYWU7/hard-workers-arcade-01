'use strict';
const $=s=>document.querySelector(s), storageKey='hard-workers-arcade-v2';
let tasks=[],activeId=null,rolling=false,toastTimer;
const catalog=[
 {id:'pearl',kind:'ball',name:'Pearl',cost:0,colors:['#fff3f8','#e0c6df','#86658e']},
 {id:'ice',kind:'ball',name:'Ice pop',cost:100,colors:['#f0ffff','#68e8ff','#2370aa']},
 {id:'gold',kind:'ball',name:'Gold rush',cost:250,colors:['#fffbe1','#ffd166','#ad5b21']},
 {id:'plasma',kind:'ball',name:'Plasma',cost:400,colors:['#fff1ff','#c985ff','#622b9f']},
 {id:'neon',kind:'lane',name:'Original neon',cost:0,colors:['#231c30','#242236','#363047'],rail:'#ff9bd1'},
 {id:'glacier',kind:'lane',name:'Glacier',cost:200,colors:['#122833','#163b48','#225665'],rail:'#6ee9ff'},
 {id:'sunset',kind:'lane',name:'Afterglow',cost:350,colors:['#332137','#492d40','#694151'],rail:'#ffb568'}
];
function defaultRewards(){const earned=tasks.filter(t=>t.status==='done').reduce((sum,t)=>sum+t.points,0);return {wallet:earned,lifetime:earned,streak:0,best:0,lastDay:null,lastThrowDay:null,owned:['pearl','neon'],ball:'pearl',lane:'neon'};}
let rewards;
try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null'),legacy=stored?stored.tasks:JSON.parse(localStorage.getItem('hard-workers-arcade-v1')||'[]');if(Array.isArray(legacy))tasks=legacy.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&['ready','scored','done'].includes(t.status)&&Number.isFinite(t.points)&&t.points>=0).map(t=>({...t,note:typeof t.note==='string'?t.note:''}));rewards={...defaultRewards(),...stored?.rewards};for(const key of ['wallet','lifetime','streak','best'])if(!Number.isFinite(rewards[key])||rewards[key]<0)rewards[key]=0;rewards.owned=Array.from(new Set(['pearl','neon',...(Array.isArray(rewards.owned)?rewards.owned:[])])).filter(id=>catalog.some(c=>c.id===id));for(const kind of ['ball','lane'])if(!rewards.owned.includes(rewards[kind])||!catalog.some(c=>c.id===rewards[kind]&&c.kind===kind))rewards[kind]=kind==='ball'?'pearl':'neon';}catch{rewards=defaultRewards();setTimeout(()=>toast('Your browser could not load saved progress.'),100);}
function localDay(date=new Date()){return Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);}
function streakToday(day=localDay()){return rewards.lastDay===day||rewards.lastDay===day-1?rewards.streak:0;}
function streakMultiplier(day=localDay()){return 1+Math.min(Math.max(streakToday(day)-1,0),10)/10;}
function claimDailyThrow(day=localDay()){
 if(rewards.lastThrowDay!==null&&day<=rewards.lastThrowDay)return 0;
 if(rewards.lastDay!==null&&day<rewards.lastDay)return 0;
 if(rewards.lastDay!==day){rewards.streak=rewards.lastDay===day-1?rewards.streak+1:1;rewards.lastDay=day;}
 rewards.lastThrowDay=day;rewards.best=Math.max(rewards.best,rewards.streak);rewards.wallet+=50;rewards.lifetime+=50;return 50;
}
function taskValue(task){return task.status==='done'?(task.awardedPoints??task.points):Math.round(task.points*streakMultiplier());}
function redeemCosmetic(id){const item=catalog.find(c=>c.id===id);if(!item)throw Error('Unknown cosmetic.');if(!rewards.owned.includes(id)){if(rewards.wallet<item.cost)throw Error('Not enough points yet.');rewards.wallet-=item.cost;rewards.owned.push(id);}rewards[item.kind]=id;save();render();return {id,balance:rewards.wallet};}
function renderRewards(){
 $('#wallet').textContent=rewards.wallet;$('#streak-count').textContent=streakToday();$('#best-streak').textContent=rewards.best;
 const claimed=rewards.lastThrowDay!==null&&rewards.lastThrowDay>=localDay();
 $('#streak-detail').textContent=`${streakMultiplier().toFixed(1)}× task points · ${claimed?'50 daily points banked':'first throw +50 pts'}`;
 const list=$('#cosmetic-list');list.replaceChildren();$('#shop-balance').textContent=`${rewards.wallet} points available`;
 for(const item of catalog){const owned=rewards.owned.includes(item.id),equipped=rewards[item.kind]===item.id,card=el('article','cosmetic');const swatch=el('canvas','cosmetic-preview artwork');swatch.width=160;swatch.height=130;paintCosmeticPreview(swatch,item);swatch.setAttribute('aria-hidden','true');const info=el('div');info.append(el('span','cosmetic-kind',item.kind),el('h3','',item.name));const button=el('button','cosmetic-buy',equipped?'Equipped':owned?'Equip':`${item.cost} pts · Unlock`);button.disabled=equipped||(!owned&&rewards.wallet<item.cost);button.setAttribute('aria-label',`${equipped?'Equipped':owned?'Equip':'Unlock'} ${item.name}${owned?'':` for ${item.cost} points`}`);button.onclick=()=>{try{redeemCosmetic(item.id);toast(`${item.name} equipped`);}catch(e){toast(e.message);}};card.append(swatch,info,button);list.append(card);}
}
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function save(){try{localStorage.setItem(storageKey,JSON.stringify({tasks,rewards}));}catch{$('#save-label').textContent='Not saved · browser storage unavailable';toast('Browser storage is unavailable. Keep this tab open to keep your tasks.');}}
function addTask(title,note=''){if(typeof title!=='string'||!title.trim()||title.trim().length>160||typeof note!=='string'||note.length>500)throw Error('Enter a task of 1–160 characters and notes of up to 500 characters.');const task={id:crypto.randomUUID(),title:title.trim(),note:note.trim(),status:'ready',points:0};tasks.push(task);save();render();return task;}
function completeTask(id){const task=tasks.find(t=>t.id===id);if(!task||task.status!=='scored')throw Error('Roll this task before completing it.');const multiplier=streakMultiplier(),points=Math.round(task.points*multiplier);task.awardedPoints=points;task.multiplier=multiplier;task.status='done';rewards.wallet+=points;rewards.lifetime+=points;save();render();toast(`+${points} points · ${multiplier.toFixed(1)}× streak`);celebrate();return{id:task.id,points,multiplier,status:task.status};}
function bankAllPoints(){if(rolling)return;const pending=tasks.filter(t=>t.status==='scored');if(!pending.length)return;const multiplier=streakMultiplier();let points=0;for(const t of pending){t.awardedPoints=Math.round(t.points*multiplier);t.multiplier=multiplier;t.status='done';points+=t.awardedPoints;}rewards.wallet+=points;rewards.lifetime+=points;save();render();toast(`+${points} points · ${pending.length} tasks completed`);celebrate();return {points,count:pending.length};}
function render(){
 renderRewards();const ready=tasks.filter(t=>t.status==='ready'),done=tasks.filter(t=>t.status==='done'),unfinished=tasks.filter(t=>t.status!=='done'),pending=tasks.filter(t=>t.status==='scored');
 $('#total').textContent=String(rewards.lifetime).padStart(4,'0');$('#done-count').textContent=done.length;$('#task-count').textContent=unfinished.length;$('#balls').textContent=ready.length;$('.led').textContent=rolling?'● BALL IN PLAY':ready.length?'● READY TO PLAY':'○ LOAD A TASK';
 const bank=$('#bank-all'),sum=pending.reduce((n,t)=>n+taskValue(t),0);bank.disabled=rolling||!pending.length;bank.textContent=pending.length?`Bank all points · ${sum}`:'Bank all points';$('#bank-summary').textContent=pending.length?`Marks ${pending.length} rolled task${pending.length===1?'':'s'} complete`:'No rolled tasks to bank';
 const rack=$('#tasks'),scroll=rack.scrollTop;rack.replaceChildren();if(!unfinished.length)rack.append(el('p','rack-empty','No unfinished tasks.'));for(const t of unfinished){const row=el('div','task-title-row',t.title);row.setAttribute('role','listitem');rack.append(row);}rack.scrollTop=scroll;
 const details=$('#task-details');details.replaceChildren();if(!tasks.length)details.append(el('p','rack-empty','Add a task to load a ball.'));
 tasks.forEach(t=>{const card=el('article',`task ${t.status==='done'?'done':''}`),top=el('div','task-top');top.append(el('span','task-status',t.status==='ready'?'○ Ready to roll':t.status==='done'?`✓ ${taskValue(t)} points banked`:`◎ ${taskValue(t)} pts · ${streakMultiplier().toFixed(1)}×`));const remove=el('button','delete','×');remove.setAttribute('aria-label',`Delete task: ${t.title}`);remove.disabled=rolling;remove.onclick=()=>{tasks=tasks.filter(x=>x.id!==t.id);if(activeId===t.id)activeId=null;save();render();};top.append(remove);card.append(top,el('h3','',t.title));if(t.note)card.append(el('p','',t.note));if(t.status==='scored'){const complete=el('button','complete','Complete & bank ↗');complete.onclick=()=>completeTask(t.id);card.append(complete);}details.append(card);});draw();
}
$('#open-task-menu').onclick=()=>$('#task-menu').showModal();$('#close-task-menu').onclick=()=>$('#task-menu').close();$('#bank-all').onclick=bankAllPoints;
$('#add-task').onclick=()=>{$('#task-dialog').showModal();$('#task-title').focus();};$('#close-dialog').onclick=()=>$('#task-dialog').close();$('#task-form').onsubmit=e=>{e.preventDefault();try{addTask($('#task-title').value,$('#task-note').value);$('#task-form').reset();$('#task-dialog').close();toast('Ball added.');}catch(error){toast(error.message);}};$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
const canvas=$('#lane'),ctx=canvas.getContext('2d');
const origin={x:400,y:1100};
let drag=null,flight=null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function pointerPoint(event){const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/800,rect.height/1200);return {x:(event.clientX-rect.left-(rect.width-800*scale)/2)/scale,y:(event.clientY-rect.top-(rect.height-1200*scale)/2)/scale};}
// Fit velocity over the last 140 ms, including release, so a paused hand has no momentum.
function releaseVelocity(samples,now){const recent=samples.filter(p=>now-p.t<=140);if(recent.length<2)return {vx:0,vy:0};const mean=recent.reduce((a,p)=>({t:a.t+p.t,x:a.x+p.x,y:a.y+p.y}),{t:0,x:0,y:0});for(const k of ['t','x','y'])mean[k]/=recent.length;let variance=0,cx=0,cy=0;for(const p of recent){const dt=(p.t-mean.t)/1000;variance+=dt*dt;cx+=dt*(p.x-mean.x);cy+=dt*(p.y-mean.y);}if(variance<.000001)return {vx:0,vy:0};const vx=cx/variance,vy=cy/variance,factor=Math.min(1,1900/Math.hypot(vx,vy));return {vx:vx*factor,vy:vy*factor};}
function samplePointer(event){const p=pointerPoint(event);drag.ball={x:clamp(origin.x+p.x-drag.start.x,140,660),y:clamp(origin.y+p.y-drag.start.y,770,1130)};drag.samples.push({...drag.ball,t:event.timeStamp});drag.samples=drag.samples.filter(p=>event.timeStamp-p.t<=180);}
canvas.addEventListener('pointerdown',event=>{if(rolling||drag||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;const p=pointerPoint(event),rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/800,rect.height/1200);if(Math.hypot(p.x-origin.x,p.y-origin.y)>Math.max(38,24/scale))return;if(!tasks.some(t=>t.status==='ready')){toast('Add a task to load a ball.');return;}event.preventDefault();drag={id:event.pointerId,start:p,ball:{...origin},samples:[{...origin,t:event.timeStamp}]};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;event.preventDefault();const events=event.getCoalescedEvents?.();for(const sample of events?.length?events:[event])samplePointer(sample);draw();});
function cancelDrag(){drag=null;canvas.classList.remove('dragging');draw();}
canvas.addEventListener('pointerup',event=>{if(drag?.id!==event.pointerId)return;samplePointer(event);const velocity=releaseVelocity(drag.samples,event.timeStamp),from={...drag.ball};cancelDrag();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(velocity.vy < -100)rollTask(from,velocity).catch(error=>toast(error.message));});
canvas.addEventListener('pointercancel',cancelDrag);
canvas.addEventListener('lostpointercapture',()=>{if(drag)cancelDrag();});
const holes=[{x:241,y:112,r:38,p:100},{x:559,y:112,r:38,p:100},{x:400,y:153,r:44,p:50},{x:400,y:246,r:49,p:40},{x:400,y:348,r:53,p:30},{x:400,y:456,r:57,p:20}];
function path(points,fill,stroke,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function circle(x,y,r,fill,stroke,width=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function draw(ball){const ballStyle=catalog.find(c=>c.id===rewards.ball),laneStyle=catalog.find(c=>c.id===rewards.lane);ctx.clearRect(0,0,800,1200);const bed=ctx.createLinearGradient(0,0,0,1160);bed.addColorStop(0,laneStyle.colors[0]);bed.addColorStop(.6,laneStyle.colors[1]);bed.addColorStop(1,laneStyle.colors[2]);path([[210,54],[590,54],[702,1160],[98,1160]],bed,'#675273',2);ctx.save();ctx.clip();paintLanePattern(ctx,laneStyle.id,800,1200);ctx.restore();ctx.save();ctx.shadowBlur=15;ctx.shadowColor=laneStyle.rail;path([[193,54],[207,54],[101,1160],[84,1160]],laneStyle.rail,laneStyle.rail,2);path([[593,54],[607,54],[716,1160],[699,1160]],laneStyle.rail,laneStyle.rail,2);ctx.restore();path([[210,54],[590,54],[595,77],[205,77]],'#604565','#ba70a3',2);ctx.save();ctx.shadowBlur=9;ctx.shadowColor='#74dcf7';ctx.strokeStyle='#5fa1bd';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(400,330,176,238,0,0,2*Math.PI);ctx.stroke();ctx.restore();holes.forEach(h=>{ctx.save();ctx.shadowBlur=10;ctx.shadowColor=h.p===100?'#ff77bd':'#60c4df';circle(h.x,h.y,h.r,'#11121e',h.p===100?'#e886bf':'#74bfda',4);ctx.restore();circle(h.x,h.y+3,h.r-9,'#15131f','#373442',2);ctx.fillStyle=h.p===100?'#ffb7df':'#c1e6f1';ctx.font=`500 ${h.p===100?23:26}px "Space Grotesk",sans-serif`;ctx.textAlign='center';ctx.fillText(h.p,h.x,h.y+9);});ctx.strokeStyle='#8c789740';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(132,609);ctx.quadraticCurveTo(400,665,668,609);ctx.stroke();if(!ball){const body=flight||drag?.ball||origin;const radius=14+12*clamp(body.y/1100,0,1);if(flight&&body.z>2){ctx.save();ctx.globalAlpha=.35;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(body.x,body.y,radius*(1+body.z/400),radius*.4,0,0,Math.PI*2);ctx.fill();ctx.restore();}ball={x:body.x,y:body.y-(body.z||0)*.55,r:radius};}const grad=ctx.createRadialGradient(ball.x-8,ball.y-10,2,ball.x,ball.y,ball.r);grad.addColorStop(0,ballStyle.colors[0]);grad.addColorStop(.4,ballStyle.colors[1]);grad.addColorStop(1,ballStyle.colors[2]);ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.shadowOffsetY=8;circle(ball.x,ball.y,ball.r,grad,ballStyle.colors[0],1);ctx.restore();paintBallPattern(ctx,ballStyle.id,ball.x,ball.y,ball.r,flight?flight.y/60:0);}
function paintBallPattern(c,id,x,y,r,rotation=0){
 c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();c.translate(x,y);c.rotate(rotation);c.lineWidth=Math.max(1,r*.065);
 if(id==='ice'){c.strokeStyle='#e8ffff';c.globalAlpha=.85;for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.moveTo(0,0);c.lineTo(0,-r*.86);for(const f of [.38,.65]){c.moveTo(0,-r*f);c.lineTo(-r*.17,-r*(f+.15));c.moveTo(0,-r*f);c.lineTo(r*.17,-r*(f+.15));}c.stroke();c.restore();}}
 if(id==='gold'){c.fillStyle='#643600';c.globalAlpha=.7;c.fillRect(-r*1.2,-r*.25,r*2.4,r*.5);c.globalAlpha=1;c.strokeStyle='#fff4b5';c.beginPath();c.arc(0,0,r*.65,0,Math.PI*2);c.stroke();c.fillStyle='#fff2a3';c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=r*(i%2?.22:.49);i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();}
 if(id==='plasma'){c.strokeStyle='#f5caff';for(let i=0;i<3;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.ellipse(0,0,r*.85,r*.3,0,0,Math.PI*2);c.stroke();c.restore();}c.fillStyle='#fff7ff';for(const [a,b] of [[-.6,-.3],[.6,.3],[0,0]]){c.beginPath();c.arc(a*r,b*r,r*.12,0,Math.PI*2);c.fill();}}
 if(id==='pearl'){c.strokeStyle='#ffffff45';c.beginPath();c.ellipse(0,0,r*.7,r*1.2,.4,0,Math.PI*2);c.stroke();}
 c.restore();
}
function paintLanePattern(c,id,w,h){
 c.save();c.scale(w/800,h/1200);c.lineWidth=2;
 if(id==='glacier'){c.strokeStyle='#abf6ff';c.globalAlpha=.22;for(let i=0;i<7;i++){const x=110+i*90;c.beginPath();c.moveTo(x,600);c.lineTo(x+45,750);c.lineTo(x-15,930);c.lineTo(x+65,1190);c.moveTo(x+45,750);c.lineTo(x+100,690);c.moveTo(x-15,930);c.lineTo(x-90,1000);c.stroke();}c.fillStyle='#befaff';c.globalAlpha=.07;for(let i=0;i<5;i++){c.beginPath();c.moveTo(120+i*120,1190);c.lineTo(200+i*95,650);c.lineTo(300+i*100,1190);c.fill();}}
 if(id==='sunset'){c.strokeStyle='#ffb76e';c.globalAlpha=.22;for(let y=620;y<1180;y+=50){c.beginPath();c.moveTo(90,y);c.lineTo(710,y);c.stroke();}for(let x=-500;x<1400;x+=120){c.beginPath();c.moveTo(400,560);c.lineTo(x,1200);c.stroke();}c.fillStyle='#ffbf80';c.globalAlpha=.3;c.beginPath();c.arc(400,740,94,Math.PI,0);c.fill();for(let y=748;y<820;y+=13)c.fillRect(310+(y-748)*.5,y,180-(y-748),5);}
 if(id==='neon'){c.strokeStyle='#ed9dd3';c.globalAlpha=.14;for(const x of [225,575]){c.beginPath();c.moveTo(x,1140);c.lineTo(x,800);c.lineTo(x+(x<400?35:-35),765);c.lineTo(x+(x<400?35:-35),640);c.stroke();for(const y of [830,940,1050]){c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.stroke();}}}
 c.restore();
}
function paintCosmeticPreview(canvas,item){const c=canvas.getContext('2d');if(item.kind==='ball'){const g=c.createRadialGradient(62,43,2,80,65,49);item.colors.forEach((color,i)=>g.addColorStop(i/2,color));c.fillStyle=g;c.beginPath();c.arc(80,65,49,0,Math.PI*2);c.fill();paintBallPattern(c,item.id,80,65,49);}else{c.fillStyle=item.colors[1];c.fillRect(12,5,136,120);c.save();c.beginPath();c.rect(12,5,136,120);c.clip();c.translate(0,-115);paintLanePattern(c,item.id,160,240);c.restore();c.strokeStyle=item.rail;c.lineWidth=4;c.strokeRect(12,5,136,120);}}
// Fixed-step rolling and flight simulation, in lane units and seconds.
// Solid-sphere rolling resistance, a launch ramp, gravity and lossy rail impacts.
function stepPhysics(b,dt){
 b.time+=dt;
 const speed=Math.hypot(b.vx,b.vy),resistance=b.z>0?12:105;
 const factor=Math.max(0,1-resistance*dt/Math.max(speed,.001));b.vx*=factor;b.vy*=factor;
 if(b.y<560&&b.z<=0)b.vy+=170*dt;
 const previousY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
 if(!b.launched&&previousY>=560&&b.y<560&&b.vy<0){b.launched=true;b.z=1;b.vz=-b.vy*Math.sin(.43);b.vy*=Math.cos(.43);}
 if(b.z>0||b.vz>0){b.vz-=980*dt;b.z+=b.vz*dt;if(b.z<=0){b.z=0;b.vz=Math.abs(b.vz)*.22;if(b.vz<55)b.vz=0;}}
 const radius=14+12*clamp(b.y/1100,0,1),slope=112/1106,left=210-slope*(b.y-54)+radius,right=800-left;
 if(b.x<left||b.x>right){const side=b.x<left?1:-1;b.x=clamp(b.x,left,right);const len=Math.hypot(1,slope),nx=side/len,ny=slope/len,dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=(1+.62)*dot*nx;b.vy-=(1+.62)*dot*ny;}}
 if(b.y<78){b.y=78;b.vy=Math.abs(b.vy)*.45;}
 if(b.z<12&&b.vz<=55){const hole=holes.find(h=>Math.hypot(b.x-h.x,b.y-h.y)<h.r-radius*.6);if(hole){b.points=hole.p;b.finished=true;}}
 if(b.y>1140||(b.z===0&&Math.hypot(b.vx,b.vy)<22&&b.y>=560)||b.time>=9)b.finished=true;
 return b;
}
async function rollTask(from,velocity){
 const ready=tasks.filter(t=>t.status==='ready');if(rolling||!ready.length)throw Error('Add a task before rolling.');
 if(!from||!velocity||!Number.isFinite(velocity.vx)||!Number.isFinite(velocity.vy))throw Error('Swipe the ball to throw.');
 rolling=true;const daily=claimDailyThrow();save();if(daily)toast('+50 daily points');const chosen=ready[Math.floor(Math.random()*ready.length)];
 // A small release-angle variation retains the feel of a real ball without replacing physics.
 const angle=(Math.random()+Math.random()-1)*.006,c=Math.cos(angle),s=Math.sin(angle);
 flight={...from,z:0,vz:0,vx:velocity.vx*c-velocity.vy*s,vy:velocity.vx*s+velocity.vy*c,time:0,points:10,launched:false,finished:false};render();
 await new Promise(resolve=>{let last=performance.now(),accumulator=0;function frame(now){accumulator+=Math.min((now-last)/1000,.1);last=now;while(accumulator>=1/240&&!flight.finished){stepPhysics(flight,1/240);accumulator-=1/240;}draw();if(flight.finished)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 const points=flight.points;await new Promise(resolve=>setTimeout(resolve,250));flight=null;chosen.points=points;chosen.status='scored';activeId=chosen.id;rolling=false;save();render();toast(`${points} points · ${chosen.title}`);return{id:chosen.id,title:chosen.title,points};
}
function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<42;i++){const bit=el('span','confetti');bit.style.left=Math.random()*100+'%';bit.style.background=i%2?'#ff77bd':'#74dcf7';bit.style.animationDelay=Math.random()*.4+'s';$('#confetti').append(bit);setTimeout(()=>bit.remove(),2400);}}
$('#open-shop').onclick=()=>{$('#shop-dialog').showModal();renderRewards();};$('#close-shop').onclick=()=>$('#shop-dialog').close();
setInterval(()=>{if(!document.hidden)renderRewards();},60000);
render();if(document.fonts)document.fonts.ready.then(()=>draw());
if(document.modelContext?.registerTool){const tools=[{name:'list_arcade_tasks',description:'Read tasks, roll status, and points in this device-local arcade.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({tasks:tasks.map(t=>({...t}))})},{name:'add_arcade_task',description:'Create a task and add one ball to the rack on this device.',inputSchema:{type:'object',properties:{title:{type:'string',minLength:1,maxLength:160},note:{type:'string',maxLength:500}},required:['title'],additionalProperties:false},execute:input=>addTask(input.title,input.note??'')},{name:'complete_arcade_task',description:'Mark a rolled task complete and bank its points. Use only when the task has been finished.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},execute:input=>completeTask(input.id)}];for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}}
