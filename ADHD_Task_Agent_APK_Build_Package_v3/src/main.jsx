
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlarmClock, Bed, Bell, Brain, CalendarClock, CheckCircle2, Clock3, Heart, HelpCircle, ListChecks, Mic, PauseCircle, PlayCircle, Send, ShieldAlert, Sparkles, Tag, Trash2 } from 'lucide-react';
import './style.css';

const categories = ['Work','Education','Personal','Health','Home','Finance','Relationship','Other'];
const urgencies = ['Urgent','Important','Normal','Low'];
const starterTasks = [
 {id:1,title:'Plan today top 3 tasks',category:'Personal',urgency:'Important',minutes:10,status:'Open',nextStep:'Write only three tasks that matter today.',reminder:'',notes:'Daily planning'},
 {id:2,title:'Talk with wife / family connection time',category:'Relationship',urgency:'Important',minutes:20,status:'Open',nextStep:'Send a message or choose a calm time to talk.',reminder:'',notes:'Relationship time matters too.'}
];
const starterDistractions = [
 {id:101,title:'Scrolling social media',active:true,notes:'Only allowed during planned break'},
 {id:102,title:'Random YouTube/videos',active:true,notes:'Avoid during focus blocks'},
 {id:103,title:'Unplanned browsing',active:true,notes:'Capture it as a later task if needed'}
];
const tips = [
 'One task at a time. Your job is only the next tiny action.',
 'If you are off-track, no shame. Notice it, name it, return gently.',
 'Your memory should not carry the system. Let the app hold it.',
 'Planned rest is allowed. Unplanned distraction should be captured.'
];
function load(key, fallback){ try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback} }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function safeDateInput(d){ if(!d) return ''; try{return new Date(d).toISOString().slice(0,16)}catch{return ''} }
function dateInFuture(d){ return d && new Date(d).getTime() > Date.now(); }
function parseDateWords(lower){
 const now = new Date();
 if(lower.includes('tomorrow')){ const d=new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d.toISOString(); }
 if(lower.includes('today')){ const d=new Date(now); d.setHours(Math.max(now.getHours()+1,9),0,0,0); return d.toISOString(); }
 const time = lower.match(/(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
 if(time){ let h=parseInt(time[1]); const m=parseInt(time[2]||'0'); if(time[3]==='pm' && h<12) h+=12; if(time[3]==='am' && h===12) h=0; const d=new Date(now); d.setHours(h,m,0,0); if(d.getTime()<now.getTime()) d.setDate(d.getDate()+1); return d.toISOString(); }
 return '';
}
function parseTask(text){
 const raw=text.trim(); const lower=raw.toLowerCase();
 let urgency = lower.match(/urgent|asap|immediately|deadline/) ? 'Urgent' : lower.match(/important|today|wife|family/) ? 'Important' : lower.match(/less important|low priority|not urgent/) ? 'Low' : 'Normal';
 let category='Other';
 if(lower.match(/work|office|client|invoice|report|meeting|email|manager|account|tax|vat|payroll/)) category='Work';
 else if(lower.match(/study|school|college|university|exam|assignment|course|learn|education/)) category='Education';
 else if(lower.match(/doctor|medicine|medication|gym|walk|health|water|sleep/)) category='Health';
 else if(lower.match(/home|clean|laundry|kitchen|room|groceries|shopping/)) category='Home';
 else if(lower.match(/bank|bill|budget|payment|finance|money/)) category='Finance';
 else if(lower.match(/wife|husband|family|friend|call|relationship|talk/)) category='Relationship';
 else if(lower.match(/personal|birthday/)) category='Personal';
 let minutes=15; const m=lower.match(/(\d+)\s*(minutes|minute|min|mins|hours|hour|hrs|hr)/); if(m) minutes=parseInt(m[1])*(m[2].startsWith('hour')||m[2].startsWith('hr')?60:1);
 const reminder = parseDateWords(lower);
 const title=raw.replace(/\b(urgent|asap|important|less important|low priority|not urgent|today|tomorrow)\b/ig,'').replace(/\s+/g,' ').trim()||raw;
 return {title,category,urgency,minutes,status:'Open',nextStep:'What is the first action you can do in 2 minutes?',reminder,notes:'Captured by assistant'};
}
function replyFor(task){
 const qs=[]; if(task.category==='Other') qs.push('What category is this: work, education, personal, relationship, health, home, finance, or other?');
 if(!task.reminder) qs.push('When should I remind you?');
 if(!task.minutes || task.minutes===15) qs.push('How long should I block for it?');
 return qs.length ? `I captured “${task.title}”. ${qs[0]}` : `Added “${task.title}” as ${task.urgency}, ${task.category}, ${task.minutes} minutes.`;
}
async function notify(id,title,body,at){
 try{
   const mod = await import('@capacitor/local-notifications');
   const { LocalNotifications } = mod;
   await LocalNotifications.requestPermissions();
   await LocalNotifications.schedule({notifications:[{id,title,body,schedule:{at:new Date(at)},smallIcon:'ic_stat_icon_config_sample'}]});
 } catch(e){ console.log('Notifications work after Android build:', e.message); }
}
function nextCheckTime(minutes){ return new Date(Date.now()+minutes*60*1000).toISOString(); }
function App(){
 const [tasks,setTasks]=useState(()=>load('lifeTasks', starterTasks));
 const [distractions,setDistractions]=useState(()=>load('lifeDistractions', starterDistractions));
 const [messages,setMessages]=useState(()=>load('lifeMessages', [{role:'agent',text:'Hi Asad. Tell me tasks, wake alarms, sleep times, or distractions. I will check every 15 minutes unless you mark yourself sleeping.'}]));
 const [input,setInput]=useState('');
 const [currentId,setCurrentId]=useState(1);
 const [filter,setFilter]=useState('Open');
 const [checkMinutes,setCheckMinutes]=useState(()=>load('checkMinutes', 15));
 const [sleeping,setSleeping]=useState(()=>load('sleeping', false));
 const [sleepUntil,setSleepUntil]=useState(()=>load('sleepUntil', ''));
 const [nextCheck,setNextCheck]=useState(()=>load('nextCheck', nextCheckTime(15)));
 const [wakeAt,setWakeAt]=useState(()=>load('wakeAt',''));
 const [checkLog,setCheckLog]=useState(()=>load('checkLog', []));
 const [newDistraction,setNewDistraction]=useState('');
 const [focusMin,setFocusMin]=useState(25); const [seconds,setSeconds]=useState(25*60); const [running,setRunning]=useState(false);
 const endRef=useRef(null);
 useEffect(()=>save('lifeTasks', tasks),[tasks]);
 useEffect(()=>save('lifeDistractions', distractions),[distractions]);
 useEffect(()=>save('lifeMessages', messages),[messages]);
 useEffect(()=>save('checkMinutes', checkMinutes),[checkMinutes]);
 useEffect(()=>save('sleeping', sleeping),[sleeping]);
 useEffect(()=>save('sleepUntil', sleepUntil),[sleepUntil]);
 useEffect(()=>save('nextCheck', nextCheck),[nextCheck]);
 useEffect(()=>save('wakeAt', wakeAt),[wakeAt]);
 useEffect(()=>save('checkLog', checkLog),[checkLog]);
 useEffect(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),[messages]);
 useEffect(()=>{setSeconds(focusMin*60)},[focusMin]);
 useEffect(()=>{ if(!running) return; const t=setInterval(()=>setSeconds(s=>s>0?s-1:0),1000); return()=>clearInterval(t)},[running]);
 useEffect(()=>{
   const timer=setInterval(()=>{
     const now=Date.now();
     if(sleeping && sleepUntil && new Date(sleepUntil).getTime()<=now){ setSleeping(false); setMessages(m=>[...m,{role:'agent',text:'Wake/sleep time finished. I will restart check-ins.'}]); setNextCheck(nextCheckTime(checkMinutes)); }
     if(!sleeping && new Date(nextCheck).getTime()<=now){ askCheckIn('Automatic 15-minute check-in'); }
   },30000);
   return()=>clearInterval(timer);
 },[sleeping,sleepUntil,nextCheck,checkMinutes,tasks,currentId]);
 const openTasks=tasks.filter(t=>t.status!=='Done'); const current=tasks.find(t=>t.id===currentId)||openTasks[0]||tasks[0]; const done=tasks.filter(t=>t.status==='Done').length; const progress=tasks.length?Math.round(done/tasks.length*100):0;
 const visible=useMemo(()=>tasks.filter(t=>filter==='All'||t.status===filter||t.category===filter||t.urgency===filter),[tasks,filter]);
 function addTask(t){ const task={id:Date.now(),...t}; setTasks([task,...tasks]); setCurrentId(task.id); if(dateInFuture(task.reminder)) notify(task.id,'Task reminder',task.title,task.reminder); return task; }
 function send(){
   const text=input.trim(); if(!text) return; const lower=text.toLowerCase();
   let agent='';
   if(lower.includes('sleep')){
     const until=parseDateWords(lower); setSleeping(true); setSleepUntil(until); if(until){ setWakeAt(until); notify(Date.now()%100000,'Wake up','Wake up and restart your plan.',until); agent=`Okay. I marked you as sleeping until ${new Date(until).toLocaleString()}. Check-ins paused and wake alarm set.`; } else agent='Okay. I marked you as sleeping. Check-ins are paused until you turn sleeping mode off.';
   } else if(lower.includes('wake') || lower.includes('alarm')){
     const at=parseDateWords(lower); if(at){ setWakeAt(at); notify(Date.now()%100000,'Wake up','Wake up and restart your plan.',at); agent=`Wake alarm set for ${new Date(at).toLocaleString()}.`; } else agent='What time should I set the wake alarm for? Example: wake me at 7:00 am.';
   } else if(lower.includes('distraction') || lower.includes('should not') || lower.includes('avoid')){
     const item={id:Date.now(),title:text.replace(/distraction|should not|avoid|i should not be doing/ig,'').trim()||text,active:true,notes:'Marked as a distraction'}; setDistractions([item,...distractions]); agent=`Added “${item.title}” to your distraction list. I will ask about it during check-ins.`;
   } else {
     const task=addTask(parseTask(text)); agent=replyFor(task);
   }
   setMessages([...messages,{role:'user',text},{role:'agent',text:agent}]); setInput('');
 }
 function askCheckIn(reason='Check-in'){
   const text = current ? `${reason}: What are you doing right now? Are you doing “${current.title}” or are you off-track?` : `${reason}: What are you doing right now?`;
   setMessages(m=>[...m,{role:'agent',text}]); setNextCheck(nextCheckTime(checkMinutes)); notify(Date.now()%100000,'What are you doing?', current?`Are you doing: ${current.title}?`:'Quick check-in', new Date(Date.now()+checkMinutes*60*1000).toISOString());
 }
 function answerCheck(status){
   const entry={id:Date.now(),time:new Date().toISOString(),status,task:current?.title||'',sleeping}; setCheckLog([entry,...checkLog].slice(0,50)); setNextCheck(nextCheckTime(checkMinutes));
   const responses={on:'Good. Keep going with the next tiny action.',off:'No shame. Close the distraction and return to the current task for 2 minutes.',sleep:'Sleeping mode on. I will stop check-ins until you wake up.',break:'Okay. Planned break logged. I will ask again later.'};
   if(status==='sleep'){setSleeping(true)}
   setMessages(m=>[...m,{role:'user',text:status==='on'?'I am doing the assigned task':status==='off'?'I am distracted/off-track':status==='sleep'?'I am sleeping':'I am on a planned break'},{role:'agent',text:responses[status]}]);
 }
 function updateTask(id,patch){setTasks(tasks.map(t=>t.id===id?{...t,...patch}:t));}
 function markDone(id){updateTask(id,{status:'Done'}); setMessages(m=>[...m,{role:'agent',text:'Nice. Task marked done. Pick the next one tiny step.'}]);}
 function addDistraction(){ if(!newDistraction.trim()) return; setDistractions([{id:Date.now(),title:newDistraction.trim(),active:true,notes:'Avoid during focus'},...distractions]); setNewDistraction(''); }
 function voice(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){alert('Voice input is not supported here. Type instead.');return} const r=new SR(); r.lang='en-GB'; r.onresult=e=>setInput(e.results[0][0].transcript); r.start(); }
 return <main className="app"><header className="hero"><span><Brain/> ADHD Life Agent</span><h1>What am I doing right now?</h1><p>A task assistant that talks with you, reminds you every {checkMinutes} minutes, pauses while sleeping, sets wake alarms, and helps you avoid distractions.</p></header>
 <section className="stats"><div><b>{progress}%</b><small>completed</small></div><div><b>{openTasks.length}</b><small>open tasks</small></div><div><b>{sleeping?'Sleeping mode':'Check-ins active'}</b><small>{sleeping?'paused':'next: '+new Date(nextCheck).toLocaleTimeString()}</small></div><div><b>{tips[done%tips.length]}</b><small>gentle cue</small></div></section>
 <section className="layout"><div className="card chat"><h2><Sparkles/> Talk to the assistant</h2><div className="messages">{messages.map((m,i)=><p key={i} className={m.role}>{m.text}</p>)}<div ref={endRef}/></div><div className="composer"><button className="mic" onClick={voice}><Mic/></button><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')send()}} placeholder="Task, alarm, sleep, distraction..."/><button onClick={send}><Send/></button></div><div className="chips"><button onClick={()=>setInput('Wake me at 7:00 am')}>Wake alarm</button><button onClick={()=>setInput('I am sleeping until 7:00 am')}>Sleeping</button><button onClick={()=>setInput('Avoid social media as a distraction')}>Avoid distraction</button><button onClick={()=>setInput('Talk with my wife today for 20 minutes')}>Wife/family time</button></div></div>
 <div className="card focus"><h2><ListChecks/> Current focus</h2>{current?<><h3>{current.title}</h3><p>{current.notes}</p><div className="tags"><em>{current.urgency}</em><em>{current.category}</em><em>{current.minutes} min</em></div><div className="next"><b>Next tiny action</b><p>{current.nextStep}</p></div><div className="timer"><Clock3/><b>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</b></div><select value={focusMin} onChange={e=>setFocusMin(Number(e.target.value))}><option value="5">5 minute restart</option><option value="10">10 minute focus</option><option value="25">25 minute focus</option></select><button onClick={()=>setRunning(!running)}>{running?<PauseCircle/>:<PlayCircle/>}{running?'Pause':'Start focus'}</button><button className="secondary" onClick={()=>markDone(current.id)}><CheckCircle2/> Mark done</button></>:<p>No tasks yet.</p>}</div></section>
 <section className="card check"><div className="bar"><h2><Bell/> 15-minute accountability check-ins</h2><label>Every <input type="number" min="5" max="120" value={checkMinutes} onChange={e=>{setCheckMinutes(Number(e.target.value)); setNextCheck(nextCheckTime(Number(e.target.value)))}}/> min</label></div><div className="checkBtns"><button onClick={()=>askCheckIn('Manual check-in')}>Ask me now</button><button onClick={()=>answerCheck('on')}><CheckCircle2/> I am doing assigned task</button><button className="warning" onClick={()=>answerCheck('off')}><ShieldAlert/> I am distracted</button><button className="secondary" onClick={()=>answerCheck('break')}>Planned break</button><button className="sleep" onClick={()=>answerCheck('sleep')}><Bed/> I am sleeping</button></div><label className="toggle"><input type="checkbox" checked={sleeping} onChange={e=>setSleeping(e.target.checked)}/> Sleeping mode: pause check-ins</label><div className="log">{checkLog.slice(0,5).map(x=><small key={x.id}>{new Date(x.time).toLocaleTimeString()} — {x.status} — {x.task}</small>)}</div></section>
 <section className="grid2"><div className="card"><h2><AlarmClock/> Wake alarm</h2><input type="datetime-local" value={safeDateInput(wakeAt)} onChange={e=>setWakeAt(e.target.value?new Date(e.target.value).toISOString():'')}/><button onClick={()=>wakeAt&&notify(Date.now()%100000,'Wake up','Wake up and restart your plan.',wakeAt)}>Set wake alarm</button>{wakeAt&&<p className="hint">Alarm: {new Date(wakeAt).toLocaleString()}</p>}</div><div className="card"><h2><ShieldAlert/> Distractions to avoid</h2><div className="composer"><input value={newDistraction} onChange={e=>setNewDistraction(e.target.value)} placeholder="e.g. social media, YouTube"/><button onClick={addDistraction}>Add</button></div>{distractions.map(d=><div className="distraction" key={d.id}><label><input type="checkbox" checked={d.active} onChange={e=>setDistractions(distractions.map(x=>x.id===d.id?{...x,active:e.target.checked}:x))}/> {d.title}</label><button className="icon danger" onClick={()=>setDistractions(distractions.filter(x=>x.id!==d.id))}><Trash2/></button></div>)}</div></section>
 <section className="card"><div className="bar"><h2><CalendarClock/> Life task tracker</h2><select value={filter} onChange={e=>setFilter(e.target.value)}>{['Open','All','Done',...categories,...urgencies].map(x=><option key={x}>{x}</option>)}</select></div>{visible.map(t=><div className="task" key={t.id}><button className="select" onClick={()=>setCurrentId(t.id)}><b className={t.status==='Done'?'done':''}>{t.title}</b><small><Tag size={12}/> {t.category} • {t.urgency} • {t.minutes} min {t.reminder?'• reminder '+new Date(t.reminder).toLocaleString():''}</small></button><select value={t.category} onChange={e=>updateTask(t.id,{category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select><select value={t.urgency} onChange={e=>updateTask(t.id,{urgency:e.target.value})}>{urgencies.map(u=><option key={u}>{u}</option>)}</select><input type="datetime-local" value={safeDateInput(t.reminder)} onChange={e=>{const val=e.target.value?new Date(e.target.value).toISOString():''; updateTask(t.id,{reminder:val}); if(val) notify(t.id,'Task reminder',t.title,val)}}/><button className="icon" onClick={()=>markDone(t.id)}><CheckCircle2/></button><button className="icon danger" onClick={()=>setTasks(tasks.filter(x=>x.id!==t.id))}><Trash2/></button></div>)}</section>
 <section className="card help"><h2><HelpCircle/> How this helps</h2><ul><li>It asks what you are doing every 15 minutes so drifting is noticed early.</li><li>Sleeping mode pauses check-ins so rest is not treated as distraction.</li><li>Wake alarms help you restart your plan after sleep.</li><li>Distraction list makes “things I should not be doing” visible.</li><li>Relationship tasks are included, so talking with your wife/family is treated as important life planning, not an afterthought.</li></ul></section></main>
}
createRoot(document.getElementById('root')).render(<App/>);
