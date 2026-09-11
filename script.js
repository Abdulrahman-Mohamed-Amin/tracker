(function(){
"use strict";

var STORE_KEY = "masar_v1";
var DOW_SHORT = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"]; // JS getDay index 0..6
var DOW_FULL = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
var MONTH_NAMES = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function defaultData(){
  return {
    startDate: "2026-08-23",
    habits: [
      { id:"gym", name:"الجيم", icon:"🏋️", type:"state", weeklyGoal:4, weeklyGoalMin:4, weeklyGoalMax:5,
        states:[
          {key:"gym", label:"جيم", color:"var(--accent-gym)"},
          {key:"rest", label:"راحة", color:"var(--accent-rest)"}
        ] },
      { id:"read", name:"القراءة", icon:"📖", type:"count", unit:"صفحة", dailyTarget:10, color:"var(--accent-read)" }
    ],
    entries: { gym:{}, read:{} }
  };
}

var CYCLE_COLORS = ["var(--accent-gym)","var(--accent-rest)","var(--accent-read)","var(--accent-success)"];
var CYCLE_SOFT = ["var(--accent-gym-soft)","var(--accent-rest-soft)","var(--accent-read-soft)","var(--accent-success-soft)"];

function seedHistory(d){
  var start = new Date(d.startDate+"T00:00:00");
  var today = new Date(); today.setHours(0,0,0,0);
  var cursor = new Date(start);
  var gymCycle = ["gym","gym","rest"]; // يومين حضور ويوم راحة بالتبادل
  var i = 0;
  while(cursor.getTime() <= today.getTime()){
    var k = cursor.getFullYear()+"-"+(cursor.getMonth()+1<10?"0":"")+(cursor.getMonth()+1)+"-"+(cursor.getDate()<10?"0":"")+cursor.getDate();
    d.entries.gym[k] = gymCycle[i % gymCycle.length];
    d.entries.read[k] = 10;
    i++;
    cursor.setDate(cursor.getDate()+1);
  }
}

function load(){
  try{
    var raw = localStorage.getItem(STORE_KEY);
    if(!raw){
      var d = defaultData();
      seedHistory(d);
      save(d);
      return d;
    }
    var parsed = JSON.parse(raw);
    if(!parsed.habits || !parsed.entries) { var d2 = defaultData(); seedHistory(d2); save(d2); return d2; }
    var gymEmpty = !parsed.entries.gym || Object.keys(parsed.entries.gym).length===0;
    var readEmpty = !parsed.entries.read || Object.keys(parsed.entries.read).length===0;
    if(gymEmpty && readEmpty){
      seedHistory(parsed);
      save(parsed);
    }
    return parsed;
  }catch(e){ return defaultData(); }
}
function save(d){ localStorage.setItem(STORE_KEY, JSON.stringify(d)); }

var data = load();

/* ---------- date helpers ---------- */
function pad(n){ return n<10 ? "0"+n : ""+n; }
function dateKey(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayDate(){ var t=new Date(); t.setHours(0,0,0,0); return t; }
function addDays(d,n){ var r=new Date(d); r.setDate(r.getDate()+n); return r; }
function isFriday(d){ return d.getDay()===5; }
function isFutureDate(d){ return d.getTime() > todayDate().getTime(); }
function isBeforeStart(d){ return dateKey(d) < data.startDate; }

// week starting Saturday containing d
function weekDatesFor(d){
  var dow = d.getDay(); // 0=Sun..6=Sat
  var offsetFromSat = (dow + 1) % 7; // Sat->0, Sun->1 ... Fri->6
  var sat = addDays(d, -offsetFromSat);
  var arr = [];
  for(var i=0;i<7;i++) arr.push(addDays(sat,i));
  return arr;
}

function fmtArabicDate(d){
  return d.toLocaleDateString('ar-SA-u-nu-latn', { weekday:'long', day:'numeric', month:'long' });
}
function fmtShort(d){
  return d.getDate()+" "+MONTH_NAMES[d.getMonth()];
}

/* ---------- entry access ---------- */
function getEntry(habitId, dkey){
  var h = data.entries[habitId];
  return h ? h[dkey] : undefined;
}
function setEntry(habitId, dkey, value){
  if(!data.entries[habitId]) data.entries[habitId] = {};
  if(value === undefined || value === null || value === 0 || value === ""){
    delete data.entries[habitId][dkey];
  } else {
    data.entries[habitId][dkey] = value;
  }
  save(data);
}

function cycleState(habit, dkey){
  var cur = getEntry(habit.id, dkey);
  var keys = habit.states.map(function(s){return s.key;});
  var next;
  if(cur === undefined) next = keys[0];
  else {
    var i = keys.indexOf(cur);
    next = (i+1 < keys.length) ? keys[i+1] : undefined;
  }
  setEntry(habit.id, dkey, next);
}

function weeklyGoalText(h){ return h.weeklyGoalMin ? (h.weeklyGoalMin+"-"+h.weeklyGoalMax) : h.weeklyGoal; }
function weeklyGoalThreshold(h){ return h.weeklyGoalMin || h.weeklyGoal; }

function habitColor(h, idx){ return h.color || CYCLE_COLORS[idx % CYCLE_COLORS.length]; }
function habitSoft(h, idx){ return h.type==="count" ? "var(--accent-read-soft)" : CYCLE_SOFT[idx % CYCLE_SOFT.length]; }

/* ---------- computations ---------- */
function readingStreak(habit){
  var target = habit.dailyTarget || 1;
  var cursor = todayDate();
  var key = dateKey(cursor);
  if(getEntry(habit.id, key) === undefined) cursor = addDays(cursor,-1);
  var streak = 0;
  while(true){
    var k = dateKey(cursor);
    var v = getEntry(habit.id, k) || 0;
    if(v >= target){ streak++; cursor = addDays(cursor,-1); }
    else break;
  }
  return streak;
}

function weekStateCount(habit, weekDates, stateKey){
  var c = 0;
  weekDates.forEach(function(d){
    if(d.getTime() > todayDate().getTime()) return;
    if(getEntry(habit.id, dateKey(d)) === stateKey) c++;
  });
  return c;
}
function weekCountSum(habit, weekDates){
  var s = 0;
  weekDates.forEach(function(d){ s += (getEntry(habit.id, dateKey(d)) || 0); });
  return s;
}

/* ---------- rendering ---------- */
function el(tag, cls, html){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html !== undefined) e.innerHTML = html;
  return e;
}

function renderHeader(){
  document.getElementById('todayDate').textContent = fmtArabicDate(new Date());
  document.getElementById('todayLabel').textContent = fmtArabicDate(new Date());

  var glance = document.getElementById('glanceRow');
  glance.innerHTML = "";
  var wd = weekDatesFor(todayDate());
  data.habits.forEach(function(h, idx){
    var chip = el('div','glance-chip');
    var dot = el('span','glance-dot'); dot.style.background = habitColor(h, idx);
    var txt;
    if(h.type === "state"){
      var done = weekStateCount(h, wd, h.states[0].key);
      txt = document.createTextNode(h.name+"  ");
      chip.appendChild(dot); chip.appendChild(txt);
      chip.appendChild(el('b',null,done+" / "+weeklyGoalText(h)));
    } else {
      var sum = weekCountSum(h, wd);
      var goal = (h.dailyTarget||0)*7;
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(h.name+"  "));
      chip.appendChild(el('b',null,sum+"/"+goal));
    }
    glance.appendChild(chip);
  });
}

function renderTodayCards(){
  var grid = document.getElementById('todayGrid');
  grid.innerHTML = "";
  var today = todayDate();
  var tkey = dateKey(today);

  data.habits.forEach(function(h, idx){
    var card = el('div','today-card');
    var head = el('div','today-card-head');
    var icon = el('div','today-icon', h.icon || "•");
    icon.style.background = habitSoft(h, idx);
    head.appendChild(icon);
    var title = el('div','today-title', h.name + (h.type==="state" ? '<span class="hint">سجّل يومك بضغطة</span>' : '<span class="hint">هدفك '+h.dailyTarget+' '+(h.unit||'')+' يوميًا</span>'));
    head.appendChild(title);
    card.appendChild(head);

    if(h.type === "state"){
      var row = el('div','state-row');
      var current = getEntry(h.id, tkey);
      h.states.forEach(function(st){
        var btn = el('button','state-btn', '<span class="ic">'+(st.key===h.states[0].key?'💪':'😌')+'</span><span>'+st.label+'</span>');
        if(current === st.key){ btn.classList.add('active'); btn.style.background = st.color; }
        btn.addEventListener('click', function(){
          var next = (getEntry(h.id, tkey) === st.key) ? undefined : st.key;
          setEntry(h.id, tkey, next);
          renderAll();
        });
        row.appendChild(btn);
      });
      card.appendChild(row);
    } else {
      var val = getEntry(h.id, tkey) || 0;
      var countRow = el('div','count-row');
      var stepper = el('div','stepper');
      var minus = el('button',null,'−');
      var display = el('div','val mono', val);
      var plus = el('button',null,'+');
      minus.addEventListener('click', function(){ var v=Math.max(0,(getEntry(h.id,tkey)||0)-1); setEntry(h.id,tkey,v); renderAll(); });
      plus.addEventListener('click', function(){ var v=(getEntry(h.id,tkey)||0)+1; setEntry(h.id,tkey,v); renderAll(); });
      stepper.appendChild(minus); stepper.appendChild(display); stepper.appendChild(plus);
      countRow.appendChild(stepper);
      countRow.appendChild(el('div',null,'<span style="font-size:12px;color:var(--ink-faint);font-weight:600">'+(h.unit||'')+' اليوم</span>'));
      card.appendChild(countRow);

      var quick = el('div','quick-row');
      [5,10,15,20].forEach(function(n){
        var qb = el('button','quick-btn','+'+n);
        qb.addEventListener('click', function(){ var v=(getEntry(h.id,tkey)||0)+n; setEntry(h.id,tkey,v); renderAll(); });
        quick.appendChild(qb);
      });
      card.appendChild(quick);

      var pct = Math.min(100, Math.round((val / (h.dailyTarget||1))*100));
      var track = el('div','progress-track');
      var fill = el('div','progress-fill'); fill.style.width = pct+"%"; fill.style.background = habitColor(h, idx);
      track.appendChild(fill);
      card.appendChild(track);
      card.appendChild(el('div','progress-label','<span>'+val+' / '+h.dailyTarget+' '+(h.unit||'')+'</span><span>'+pct+'٪</span>'));
    }
    grid.appendChild(card);
  });
}

var editCtx = null; // {habitId, dkey}

function renderWeekStrips(){
  var wrap = document.getElementById('weekStrips');
  wrap.innerHTML = "";
  var wd = weekDatesFor(todayDate());
  document.getElementById('weekRangeLabel').textContent = fmtShort(wd[0]) + " – " + fmtShort(wd[6]);

  data.habits.forEach(function(h, idx){
    var card = el('div','week-card');
    var head = el('div','week-card-head');
    var title = el('div','week-card-title','<span class="ic">'+(h.icon||'')+'</span><span>'+h.name+'</span>');
    head.appendChild(title);
    if(h.type==="state"){
      head.appendChild(el('div','week-goal', weekStateCount(h,wd,h.states[0].key)+' / '+weeklyGoalText(h)+' هذا الأسبوع'));
    } else {
      head.appendChild(el('div','week-goal', weekCountSum(h,wd)+' / '+(h.dailyTarget*7)+' '+(h.unit||'')));
    }
    card.appendChild(head);

    var strip = el('div','week-strip');
    wd.forEach(function(d){
      var dkey = dateKey(d);
      var cell = el('div','day-cell');
      if(isFriday(d)) cell.classList.add('weekend');
      if(dkey === dateKey(todayDate())) cell.classList.add('today');
      var future = isFutureDate(d) || isBeforeStart(d);
      if(future) cell.classList.add('future');

      cell.appendChild(el('div','dname', DOW_SHORT[d.getDay()]));
      cell.appendChild(el('div','dnum mono', d.getDate()));

      if(h.type === "state"){
        var v = getEntry(h.id, dkey);
        if(v){
          var st = h.states.filter(function(s){return s.key===v;})[0];
          if(st){ cell.classList.add('filled'); cell.style.background = st.color; }
        }
        if(!future){
          cell.addEventListener('click', function(){
            cycleState(h, dkey);
            renderAll();
          });
        }
      } else {
        var pages = getEntry(h.id, dkey) || 0;
        if(pages > 0){
          var ratio = Math.min(1, pages/(h.dailyTarget||1));
          cell.classList.add('filled');
          cell.style.background = habitColor(h, idx);
          cell.style.opacity = future ? .35 : (0.35 + ratio*0.65);
          cell.appendChild(el('div','pages-tag mono', pages));
        }
        if(!future){
          cell.addEventListener('click', function(){ openEditSheet(h, dkey, d); });
        }
      }
      strip.appendChild(cell);
    });
    card.appendChild(strip);
    wrap.appendChild(card);
  });
}

function renderStats(){
  var row = document.getElementById('statsRow');
  row.innerHTML = "";
  var wd = weekDatesFor(todayDate());
  var readHabit = data.habits.filter(function(h){return h.type==="count";})[0];
  var gymHabit = data.habits.filter(function(h){return h.type==="state";})[0];

  var tiles = [];
  if(readHabit){
    tiles.push({num: readingStreak(readHabit), label:"يوم تتابع "+readHabit.name, color: habitColor(readHabit,2)});
    tiles.push({num: weekCountSum(readHabit,wd), label:readHabit.name+" هذا الأسبوع", color: habitColor(readHabit,2)});
  }
  if(gymHabit){
    tiles.push({num: weekStateCount(gymHabit,wd,gymHabit.states[0].key)+"/"+weeklyGoalText(gymHabit), label:gymHabit.name+" هذا الأسبوع", color: habitColor(gymHabit,0)});
  }
  tiles.slice(0,3).forEach(function(t){
    var tile = el('div','stat-tile');
    var num = el('div','stat-num mono', t.num); num.style.color = t.color;
    tile.appendChild(num);
    tile.appendChild(el('div','stat-label', t.label));
    row.appendChild(tile);
  });
}

/* ---------- month view ---------- */
var monthState = { habitIdx: 0, year: todayDate().getFullYear(), month: todayDate().getMonth() };

function renderMonthTabs(){
  var tabs = document.getElementById('monthTabs');
  tabs.innerHTML = "";
  data.habits.forEach(function(h, idx){
    var b = el('button','tab-btn', (h.icon||'')+' '+h.name);
    if(idx === monthState.habitIdx){ b.classList.add('active'); b.style.background = habitColor(h, idx); }
    b.addEventListener('click', function(){ monthState.habitIdx = idx; renderMonth(); });
    tabs.appendChild(b);
  });
}

function renderMonth(){
  renderMonthTabs();
  var h = data.habits[monthState.habitIdx];
  if(!h) return;
  var idx = monthState.habitIdx;
  var y = monthState.year, m = monthState.month;
  document.getElementById('monthLabel').textContent = MONTH_NAMES[m] + " " + y;

  var start = new Date(data.startDate+"T00:00:00");
  var startYM = start.getFullYear()*12+start.getMonth();
  var curYM = y*12+m;
  var todayYM = todayDate().getFullYear()*12+todayDate().getMonth();
  document.getElementById('prevMonth').disabled = curYM <= startYM;
  document.getElementById('nextMonth').disabled = curYM >= todayYM;

  var grid = document.getElementById('monthGrid');
  grid.innerHTML = "";
  var dowOrder = [6,0,1,2,3,4,5]; // Sat..Fri using JS getDay indices
  dowOrder.forEach(function(dow){
    var d = el('div','month-dow', DOW_SHORT[dow]);
    if(dow===5) d.classList.add('weekend');
    grid.appendChild(d);
  });

  var firstOfMonth = new Date(y, m, 1);
  var firstDow = firstOfMonth.getDay();
  var leading = (firstDow + 1) % 7; // days before Sat-aligned start
  for(var i=0;i<leading;i++) grid.appendChild(el('div','month-cell empty'));

  var daysInMonth = new Date(y, m+1, 0).getDate();
  for(var day=1; day<=daysInMonth; day++){
    let d = new Date(y,m,day);
    let dkey = dateKey(d);
    var cell = el('div','month-cell', day);
    if(dkey === dateKey(todayDate())) cell.classList.add('today');
    if(day === daysInMonth) cell.classList.add('monthend');

    var future = d.getTime() > todayDate().getTime() || isBeforeStart(d);
    if(!future){
      if(h.type === "state"){
        var v = getEntry(h.id, dkey);
        var st = v ? h.states.filter(function(s){return s.key===v;})[0] : null;
        if(st){ cell.style.background = st.color; cell.style.color = "#fff"; cell.style.borderColor="transparent"; }
        cell.style.cursor = "pointer";
        cell.addEventListener('click', function(){ cycleState(h, dkey); renderAll(); });
      } else {
        var pages = getEntry(h.id, dkey) || 0;
        if(pages>0){
          var ratio = Math.min(1, pages/(h.dailyTarget||1));
          cell.style.background = habitColor(h, idx);
          cell.style.opacity = (0.3 + ratio*0.7);
          cell.style.color = "#fff";
          cell.style.borderColor = "transparent";
        }
        cell.style.cursor = "pointer";
        cell.addEventListener('click', function(){ openEditSheet(h, dkey, d); });
      }
    } else {
      cell.style.opacity = .3;
    }
    grid.appendChild(cell);
  }

  var legend = document.getElementById('monthLegend');
  legend.innerHTML = "";
  if(h.type === "state"){
    h.states.forEach(function(st){
      var li = el('div','legend-item');
      var sw = el('span','legend-sw'); sw.style.background = st.color;
      li.appendChild(sw); li.appendChild(document.createTextNode(st.label));
      legend.appendChild(li);
    });
  } else {
    var li = el('div','legend-item');
    var sw = el('span','legend-sw'); sw.style.background = habitColor(h, idx);
    li.appendChild(sw); li.appendChild(document.createTextNode('كثافة اللون = نسبة الإنجاز من الهدف'));
    legend.appendChild(li);
  }
  var m2 = el('div','legend-item');
  m2.innerHTML = '<span style="font-size:11px">🏆</span> آخر يوم بالشهر';
  legend.appendChild(m2);
}

document.getElementById('prevMonth').addEventListener('click', function(){
  monthState.month--; if(monthState.month<0){monthState.month=11; monthState.year--;}
  renderMonth();
});
document.getElementById('nextMonth').addEventListener('click', function(){
  monthState.month++; if(monthState.month>11){monthState.month=0; monthState.year++;}
  renderMonth();
});

/* ---------- manage habits ---------- */
function renderHabitList(){
  var list = document.getElementById('habitList');
  list.innerHTML = "";
  data.habits.forEach(function(h, idx){
    var chip = el('div','habit-chip');
    var ic = el('div','ic', h.icon||'•'); ic.style.background = habitSoft(h, idx);
    chip.appendChild(ic);
    var info = el('div','info');
    info.innerHTML = '<b>'+h.name+'</b><span>'+(h.type==="state" ? 'حضور/راحة · هدف '+weeklyGoalText(h)+' أيام/أسبوع' : 'عدّاد يومي · هدف '+h.dailyTarget+' '+(h.unit||'') )+'</span>';
    chip.appendChild(info);
    var del = el('button','del','✕');
    del.addEventListener('click', function(){
      if(confirm('حذف "'+h.name+'" وكل سجلاتها؟')){
        data.habits.splice(idx,1);
        delete data.entries[h.id];
        save(data);
        if(monthState.habitIdx >= data.habits.length) monthState.habitIdx = 0;
        renderAll();
      }
    });
    chip.appendChild(del);
    list.appendChild(chip);
  });
}

/* ---------- add habit sheet ---------- */
var addOverlay = document.getElementById('addOverlay');
var newType = "check";
function openAdd(){
  document.getElementById('newName').value = "";
  document.getElementById('newIcon').value = "";
  document.getElementById('newGoal').value = "3";
  document.getElementById('newTarget').value = "10";
  document.getElementById('newUnit').value = "";
  newType = "check";
  document.getElementById('typeCheck').classList.add('active');
  document.getElementById('typeCount').classList.remove('active');
  document.getElementById('goalField').style.display = "";
  document.getElementById('targetField').style.display = "none";
  document.getElementById('unitField').style.display = "none";
  addOverlay.classList.add('open');
}
function closeAdd(){ addOverlay.classList.remove('open'); }
document.getElementById('openAddHabit').addEventListener('click', openAdd);
document.getElementById('fabAdd').addEventListener('click', openAdd);
document.getElementById('cancelAdd').addEventListener('click', closeAdd);
addOverlay.addEventListener('click', function(e){ if(e.target===addOverlay) closeAdd(); });

document.getElementById('typeCheck').addEventListener('click', function(){
  newType = "check";
  this.classList.add('active');
  document.getElementById('typeCount').classList.remove('active');
  document.getElementById('goalField').style.display = "";
  document.getElementById('targetField').style.display = "none";
  document.getElementById('unitField').style.display = "none";
});
document.getElementById('typeCount').addEventListener('click', function(){
  newType = "count";
  this.classList.add('active');
  document.getElementById('typeCheck').classList.remove('active');
  document.getElementById('goalField').style.display = "none";
  document.getElementById('targetField').style.display = "";
  document.getElementById('unitField').style.display = "";
});

document.getElementById('saveAdd').addEventListener('click', function(){
  var name = document.getElementById('newName').value.trim();
  if(!name){ alert('اكتب اسم العادة أولًا'); return; }
  var icon = document.getElementById('newIcon').value.trim() || "✅";
  var id = "h" + Date.now();
  if(newType === "check"){
    var goal = parseInt(document.getElementById('newGoal').value,10) || 3;
    data.habits.push({ id:id, name:name, icon:icon, type:"state", weeklyGoal:goal,
      states:[ {key:"done", label:"تم", color: CYCLE_COLORS[data.habits.length % CYCLE_COLORS.length]},
               {key:"skip", label:"تخطي", color: "var(--ink-faint)"} ] });
  } else {
    var target = parseInt(document.getElementById('newTarget').value,10) || 1;
    var unit = document.getElementById('newUnit').value.trim() || "مرة";
    data.habits.push({ id:id, name:name, icon:icon, type:"count", dailyTarget:target, unit:unit,
      color: CYCLE_COLORS[data.habits.length % CYCLE_COLORS.length] });
  }
  data.entries[id] = {};
  save(data);
  closeAdd();
  renderAll();
});

/* ---------- edit day sheet (count habits) ---------- */
var editOverlay = document.getElementById('editOverlay');
function openEditSheet(habit, dkey, dateObj){
  editCtx = { habit:habit, dkey:dkey };
  document.getElementById('editTitle').textContent = habit.name + " · " + fmtShort(dateObj);
  document.getElementById('editVal').textContent = getEntry(habit.id, dkey) || 0;
  editOverlay.classList.add('open');
}
function closeEdit(){ editOverlay.classList.remove('open'); editCtx=null; }
document.getElementById('cancelEdit').addEventListener('click', closeEdit);
editOverlay.addEventListener('click', function(e){ if(e.target===editOverlay) closeEdit(); });
document.getElementById('editMinus').addEventListener('click', function(){
  var v = document.getElementById('editVal');
  v.textContent = Math.max(0, parseInt(v.textContent,10)-1);
});
document.getElementById('editPlus').addEventListener('click', function(){
  var v = document.getElementById('editVal');
  v.textContent = parseInt(v.textContent,10)+1;
});
document.getElementById('saveEdit').addEventListener('click', function(){
  if(!editCtx) return;
  var val = parseInt(document.getElementById('editVal').textContent,10) || 0;
  setEntry(editCtx.habit.id, editCtx.dkey, val);
  closeEdit();
  renderAll();
});

/* ---------- init ---------- */
function renderAll(){
  renderHeader();
  renderTodayCards();
  renderWeekStrips();
  renderStats();
  renderMonth();
  renderHabitList();
}
renderAll();
})();
