(function(){
"use strict";

var STORE_KEY = "masar_v1";
var MONTH_NAMES = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
var SVGNS = "http://www.w3.org/2000/svg";

function pad(n){ return n<10 ? "0"+n : ""+n; }
function dateKey(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function addDays(d,n){ var r=new Date(d); r.setDate(r.getDate()+n); return r; }
function todayDate(){ var t=new Date(); t.setHours(0,0,0,0); return t; }
function fmtShort(d){ return d.getDate()+" "+MONTH_NAMES[d.getMonth()]; }
function fmtDM(d){ return d.getDate()+"/"+(d.getMonth()+1); }

function weekDatesFor(d){
  var dow = d.getDay();
  var offsetFromSat = (dow + 1) % 7;
  var sat = addDays(d, -offsetFromSat);
  var arr = [];
  for(var i=0;i<7;i++) arr.push(addDays(sat,i));
  return arr;
}

function loadData(){
  try{
    var raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    var parsed = JSON.parse(raw);
    if(!parsed.habits || !parsed.entries) return null;
    return parsed;
  }catch(e){ return null; }
}

var data = loadData();

function svg(tag, attrs){
  var e = document.createElementNS(SVGNS, tag);
  for(var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

if(!data || !data.habits.length){
  document.querySelector('.app').innerHTML =
    '<div class="topbar"><div class="topbar-inner"><div class="brand"><h1>الرسوم البيانية</h1>' +
    '<a class="chart-link" href="index.html">←</a></div></div></div>' +
    '<section><div class="chart-card">لا توجد بيانات بعد — افتح <a href="index.html">صفحة العادات</a> وابدأ التسجيل أولًا.</div></section>';
  return;
}

var readHabit = data.habits.filter(function(h){ return h.type==="count"; })[0];
var gymHabit = data.habits.filter(function(h){ return h.type==="state"; })[0];

var start = new Date(data.startDate+"T00:00:00");
var today = todayDate();
document.getElementById('rangeLabel').textContent = fmtShort(start) + " – " + fmtShort(today);

/* ---------------- rings ---------------- */
function ring(pct, color, valueLabel, title, sub){
  var r = 42, sw = 9, c = 2*Math.PI*r;
  var offset = c * (1 - Math.min(100,pct)/100);
  var wrap = document.createElement('div');
  wrap.className = 'ring-card';
  var s = svg('svg',{width:104,height:104,viewBox:'0 0 104 104'});
  var track = svg('circle',{cx:52,cy:52,r:r,fill:'none',stroke:'var(--border-soft)','stroke-width':sw});
  var arc = svg('circle',{cx:52,cy:52,r:r,fill:'none',stroke:color,'stroke-width':sw,
    'stroke-linecap':'round','stroke-dasharray':c,'stroke-dashoffset':offset,
    transform:'rotate(-90 52 52)'});
  var text = svg('text',{x:52,y:57,'text-anchor':'middle',fill:'var(--ink)',
    'font-family':'Cairo, sans-serif','font-weight':'800','font-size':'19'});
  text.textContent = valueLabel;
  s.appendChild(track); s.appendChild(arc); s.appendChild(text);
  wrap.appendChild(s);
  var t = document.createElement('div'); t.className='ring-title'; t.textContent = title;
  var sb = document.createElement('div'); sb.className='ring-sub'; sb.textContent = sub;
  wrap.appendChild(t); wrap.appendChild(sb);
  return wrap;
}

var totalDays = Math.round((today - start)/86400000) + 1;

if(readHabit){
  var metDays = 0;
  var cursor = new Date(start);
  while(cursor <= today){
    var v = (data.entries[readHabit.id]||{})[dateKey(cursor)] || 0;
    if(v >= readHabit.dailyTarget) metDays++;
    cursor = addDays(cursor,1);
  }
  var pct1 = Math.round((metDays/totalDays)*100);
  document.getElementById('ringsRow').appendChild(
    ring(pct1, 'var(--accent-read)', pct1+'٪', 'الالتزام بالقراءة', metDays+' من '+totalDays+' يوم حققت فيهم الهدف')
  );
}
if(gymHabit){
  var attended = 0;
  var cursor2 = new Date(start);
  while(cursor2 <= today){
    var v2 = (data.entries[gymHabit.id]||{})[dateKey(cursor2)];
    if(v2 === gymHabit.states[0].key) attended++;
    cursor2 = addDays(cursor2,1);
  }
  var pct2 = Math.round((attended/totalDays)*100);
  document.getElementById('ringsRow').appendChild(
    ring(pct2, 'var(--accent-gym)', pct2+'٪', 'حضور الجيم', attended+' يوم حضور من '+totalDays+' يوم')
  );
}

/* ---------------- shared tooltip ---------------- */
function makeTooltipHandler(tooltipEl, scrollEl){
  return function(evt, label){
    var rect = scrollEl.getBoundingClientRect();
    var targetRect = evt.currentTarget.getBoundingClientRect();
    tooltipEl.textContent = label;
    tooltipEl.style.left = (targetRect.left - rect.left + targetRect.width/2 + scrollEl.scrollLeft) + 'px';
    tooltipEl.style.top = (targetRect.top - rect.top) + 'px';
    tooltipEl.classList.add('show');
    clearTimeout(tooltipEl._t);
    tooltipEl._t = setTimeout(function(){ tooltipEl.classList.remove('show'); }, 1800);
  };
}

/* ---------------- daily reading bar chart ---------------- */
if(readHabit){
  var days = [];
  var c = new Date(start);
  while(c <= today){ days.push(new Date(c)); c = addDays(c,1); }

  var target = readHabit.dailyTarget || 10;
  var values = days.map(function(d){ return (data.entries[readHabit.id]||{})[dateKey(d)] || 0; });
  var maxVal = Math.max(target*1.5, Math.max.apply(null, values.concat([1])));
  maxVal = Math.ceil(maxVal/5)*5;

  var barW = 16, gap = 8, padTop = 14, padBottom = 22, chartH = 130;
  var w = days.length*(barW+gap)+gap;
  var h = chartH + padTop + padBottom;
  var baseline = padTop + chartH;

  var s = document.getElementById('readChart');
  s.setAttribute('width', w); s.setAttribute('height', h);
  s.setAttribute('viewBox', '0 0 '+w+' '+h);

  [0, target, maxVal].forEach(function(gv){
    var y = baseline - (gv/maxVal)*chartH;
    s.appendChild(svg('line',{x1:0,x2:w,y1:y,y2:y,class: gv===target?'target-line':'grid-line'}));
    var lbl = svg('text',{x:2,y:y-3,class:'axis-label'});
    lbl.textContent = gv;
    s.appendChild(lbl);
  });

  var tooltip = document.getElementById('readTooltip');
  var scrollEl = tooltip.closest('.chart-wrap').querySelector('.chart-scroll');
  var handler = makeTooltipHandler(tooltip, scrollEl);

  days.forEach(function(d,i){
    var val = values[i];
    var bh = Math.max(2, (val/maxVal)*chartH);
    var x = gap + i*(barW+gap);
    var y = baseline - bh;
    var rect = svg('rect',{x:x,y:y,width:barW,height:bh,rx:4,ry:4,
      fill:'var(--accent-read)', opacity: val>=target ? 1 : .4, cursor:'pointer'});
    rect.addEventListener('click', function(evt){ handler(evt, fmtShort(d)+': '+val+' '+(readHabit.unit||'')); });
    s.appendChild(rect);
    if(i % Math.max(1, Math.floor(days.length/12)) === 0 || i===days.length-1){
      var dl = svg('text',{x:x+barW/2,y:h-6,class:'axis-label','text-anchor':'middle'});
      dl.textContent = d.getDate();
      s.appendChild(dl);
    }
  });

  document.getElementById('readChartSub').textContent = 'الهدف: '+target+' '+(readHabit.unit||'')+' يوميًا';
}

/* ---------------- weekly gym bar chart ---------------- */
if(gymHabit){
  var weeks = [];
  var wc = weekDatesFor(start)[0];
  var lastWeekStart = weekDatesFor(today)[0];
  while(wc <= lastWeekStart){ weeks.push(new Date(wc)); wc = addDays(wc,7); }

  var goalMin = gymHabit.weeklyGoalMin || gymHabit.weeklyGoal || 2;
  var goalMax = gymHabit.weeklyGoalMax || goalMin;
  var counts = weeks.map(function(ws){
    var wd = weekDatesFor(ws);
    var n = 0;
    wd.forEach(function(d){
      if(d > today) return;
      var v = (data.entries[gymHabit.id]||{})[dateKey(d)];
      if(v === gymHabit.states[0].key) n++;
    });
    return n;
  });
  var maxC = Math.max(goalMax+1, Math.max.apply(null, counts.concat([1])));

  var barW2 = 30, gap2 = 16, padTop2 = 14, padBottom2 = 22, chartH2 = 110;
  var w2 = weeks.length*(barW2+gap2)+gap2;
  var h2 = chartH2 + padTop2 + padBottom2;
  var baseline2 = padTop2 + chartH2;

  var s2 = document.getElementById('gymChart');
  s2.setAttribute('width', w2); s2.setAttribute('height', h2);
  s2.setAttribute('viewBox', '0 0 '+w2+' '+h2);

  var yMin = baseline2 - (goalMin/maxC)*chartH2;
  var yMax = baseline2 - (goalMax/maxC)*chartH2;
  if(goalMax > goalMin){
    s2.appendChild(svg('rect',{x:0,y:yMax,width:w2,height:(yMin-yMax),fill:'var(--accent-milestone)',opacity:.12}));
  }
  [0, goalMin, goalMax, maxC].forEach(function(gv){
    if(gv===goalMin && goalMax===goalMin){} // fallthrough, still draw
    var y = baseline2 - (gv/maxC)*chartH2;
    var isGoalLine = (gv===goalMin || gv===goalMax) && gv!==0 && gv!==maxC;
    s2.appendChild(svg('line',{x1:0,x2:w2,y1:y,y2:y,class: isGoalLine?'target-line':'grid-line'}));
    var lbl = svg('text',{x:2,y:y-3,class:'axis-label'});
    lbl.textContent = gv;
    s2.appendChild(lbl);
  });

  var tooltip2 = document.getElementById('gymTooltip');
  var scrollEl2 = tooltip2.closest('.chart-wrap').querySelector('.chart-scroll');
  var handler2 = makeTooltipHandler(tooltip2, scrollEl2);

  weeks.forEach(function(ws,i){
    var val = counts[i];
    var bh = Math.max(2, (val/maxC)*chartH2);
    var x = gap2 + i*(barW2+gap2);
    var y = baseline2 - bh;
    var rect = svg('rect',{x:x,y:y,width:barW2,height:bh,rx:5,ry:5,
      fill:'var(--accent-gym)', opacity: val>=goalMin ? 1 : .4, cursor:'pointer'});
    var we = addDays(ws,6);
    rect.addEventListener('click', function(evt){ handler2(evt, fmtDM(ws)+' - '+fmtDM(we)+': '+val+' أيام'); });
    s2.appendChild(rect);
    var dl = svg('text',{x:x+barW2/2,y:h2-6,class:'axis-label','text-anchor':'middle'});
    dl.textContent = fmtDM(ws);
    s2.appendChild(dl);
  });

  document.getElementById('gymChartSub').textContent = 'الهدف: '+(goalMax>goalMin ? goalMin+'-'+goalMax : goalMin)+' أيام/أسبوع';
}

})();
