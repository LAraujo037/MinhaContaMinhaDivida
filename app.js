// ══════════════════════════════════════════════════
//  DATA STORE — gerenciado em supabase-adapter.js
//  S é populado por loadStore() que vem do adapter
// ══════════════════════════════════════════════════
function uid(){ return Math.random().toString(36).slice(2,10); }


// ── FORMATTERS ──
const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtDate = d => { if(!d) return '—'; const[y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; };
const today = () => new Date().toISOString().split('T')[0];
const curMon = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtMon = ym => { if(!ym) return ''; const[y,m]=ym.split('-'); return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+m-1]+' '+y; };

function calcStatus(c){
  if(c.status==='pago') return 'pago';
  return c.data < today() ? 'atrasado' : 'pendente';
}
function badge(s){ const m={pago:'<span class="badge bg">✓ Pago</span>',pendente:'<span class="badge bp">⏳ Pendente</span>',atrasado:'<span class="badge br">⚠ Atrasado</span>',ativo:'<span class="badge ba">● Ativo</span>',pausado:'<span class="badge bx">⏸ Pausado</span>'}; return m[s]||''; }
function toast(msg,type='b'){ const d=document.createElement('div'); d.className=`toast t${type}`; const ic={b:'ℹ',g:'✓',r:'✕'}; d.innerHTML=`<span style="font-size:1em">${ic[type]||'ℹ'}</span>${msg}`; document.getElementById('toasts').appendChild(d); setTimeout(()=>{d.classList.add('hide');setTimeout(()=>d.remove(),280)},3200); }
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
function confirm2(msg){ return confirm(msg); }

// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════
// ── ADMIN HELPERS ──
function isAdmin(email){ return (email||'').toLowerCase() === (CONFIG.ADMIN_EMAIL||'').toLowerCase(); }
function vrEnabled(){ return S.adminCfg?.vrEnabled !== false; }
function moduloVisivel(sec){ return S.adminCfg?.modulosVisiveis?.[sec] !== false; }

function applyUserTheme(){
  const hex = S.adminCfg?.accentColor || '#4f8ef7';
  document.documentElement.style.setProperty('--acc', hex);
  document.documentElement.style.setProperty('--accH', lighten(hex,20));
  document.documentElement.style.setProperty('--accD', hex+'20');
  document.documentElement.style.setProperty('--accB', hex+'50');
}
function lighten(hex, amt){
  let num=parseInt(hex.slice(1),16);
  let r=Math.min(255,(num>>16)+amt), g=Math.min(255,((num>>8)&0xff)+amt), b=Math.min(255,(num&0xff)+amt);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

async function doLogin(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  const err=document.getElementById('auth-err');
  if(!email||!pass){ err.textContent='Preencha e-mail e senha.'; err.style.display='block'; return; }
  err.style.display='none';
  const btn=document.getElementById('btn-login');
  btn.disabled=true; btn.textContent='Entrando...';
  try {
    await loginSupabase(email, pass);
    await loadStore();
    document.getElementById('auth').classList.remove('show');
    document.getElementById('app-shell').classList.add('show');
    document.getElementById('user-label').textContent=email.split('@')[0];
    const adminBtn=document.getElementById('btn-admin-nav');
    if(adminBtn) adminBtn.style.display=isAdmin(email)?'':'none';
    applyUserTheme();
    buildSidebar('overview');
    go('overview');
    setTimeout(updateSaldoBar,100);
    toast('Bem-vindo! 👋','g');
    // Oferecer digital se disponível e ainda não ativada
    const bioAvail = await isBiometricAvailable().catch(()=>false);
    if (bioAvail && !isBiometricEnabled()) {
      setTimeout(() => showBiometricOffer(), 1500);
    }
    // Realtime sync entre dispositivos
    subscribeRealtime(() => {
      applyUserTheme();
      buildSidebar(currentPage||'overview');
      const renders={overview:renderOverview,contas:renderContas,fixas:renderFixas,cartoes:renderCartoes,emprestimos:renderEmp,vr:renderVR,receitas:renderReceitas,admin:renderAdmin,orcamento:renderOrcamento,metas:renderMetas,configuracoes:renderConfiguracoes};
      if(renders[currentPage]) renders[currentPage]();
      updateSaldoBar();
    });
  } catch(e) {
    err.textContent = e.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : e.message;
    err.style.display='block';
  } finally {
    btn.disabled=false; btn.textContent='Entrar no sistema';
  }
}

async function doLogout(){
  await logoutSupabase();
  document.getElementById('app-shell').classList.remove('show');
  document.getElementById('auth').classList.add('show');
}
document.getElementById('auth-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
document.getElementById('btn-login').addEventListener('click', doLogin);
let currentPage='overview';

// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════
const META = {
  overview:    {t:'Visão Geral',s:'Resumo financeiro do mês atual'},
  contas:      {t:'Contas a Pagar',s:'Gerencie contas e vencimentos'},
  fixas:       {t:'Contas Fixas',s:'Recorrências mensais automáticas'},
  cartoes:     {t:'Cartões de Crédito',s:'Faturas, compras e limites'},
  emprestimos: {t:'Empréstimos',s:'Acompanhe parcelas e saldo devedor'},
  receitas:    {t:'Receitas',s:'Salário e outras entradas de dinheiro'},
  vr:          {t:'Vale Refeição',s:'Controle independente do saldo VR'},
  orcamento:   {t:'Orçamento',s:'Defina limites mensais por categoria'},
  metas:       {t:'Metas Financeiras',s:'Acompanhe seus objetivos e sonhos'},
  configuracoes:{t:'Configurações',s:'Perfil, backup e dados'},
  admin:       {t:'Administração',s:'Permissões e personalização do sistema'},
};
function go(page, btn){
  if(page==='admin' && !isAdmin(S.user)){ toast('Acesso restrito.','r'); return; }
  if(page==='vr' && !vrEnabled()){ toast('Vale Refeição não está habilitado.','r'); return; }
  if(!['overview','admin','configuracoes','orcamento','metas'].includes(page) && !moduloVisivel(page)){ toast('Este módulo está desabilitado.','r'); return; }
  currentPage=page;
  document.querySelectorAll('.ni').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
  else { const b=document.querySelector(`.ni[data-page="${page}"]`); if(b) b.classList.add('on'); }
  document.getElementById('page-title').textContent=META[page]?.t||page;
  document.getElementById('page-sub').textContent=META[page]?.s||'';
  closeSidebar();
  if(page!=='overview') showEyeBtn(false);
  const renders={overview:renderOverview,contas:renderContas,fixas:renderFixas,cartoes:renderCartoes,emprestimos:renderEmp,vr:renderVR,receitas:renderReceitas,admin:renderAdmin,orcamento:renderOrcamento,metas:renderMetas,configuracoes:renderConfiguracoes};
  if(renders[page]) renders[page]();
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay-mob').classList.toggle('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay-mob').classList.remove('open'); }

// ══════════════════════════════════════════════════
//  OVERVIEW
// ══════════════════════════════════════════════════
function renderOverview(){
  const ym=curMon();
  const contasMes = S.contas.filter(c=>c.data.startsWith(ym.substring(0,7)));
  const aPagar = contasMes.filter(c=>c.status!=='pago').reduce((s,c)=>s+c.valor,0);
  const pago = contasMes.filter(c=>c.status==='pago').reduce((s,c)=>s+c.valor,0);
  const atrasadas = contasMes.filter(c=>calcStatus(c)==='atrasado').length;

  // Receitas do mês
  const receitasMes = (S.receitas||[]).filter(r=>r.data.startsWith(ym.substring(0,7)));
  const totalReceitas = receitasMes.reduce((s,r)=>s+r.valor,0);

  // Parcelas cartão no mês
  let totalCartao=0;
  S.compras.forEach(cp=>{
    const vpp=cp.total/cp.parc;
    for(let i=0;i<cp.parc;i++){
      const d=new Date(cp.pparc+'T00:00:00'); d.setMonth(d.getMonth()+i);
      const dm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(dm===ym) totalCartao+=vpp;
    }
  });

  // Emprestimos pendente
  const totalEmp = S.emprestimos.reduce((s,e)=>s+(e.nparc-e.pagas)*e.vparc,0);

  // A Pagar por quinzena: contas + empréstimos "eu"
  const contasPend = contasMes.filter(c=>c.status!=='pago');
  const aPagar15c = contasPend.filter(c=>parseInt(c.data.split('-')[2])<=15).reduce((s,c)=>s+c.valor,0);
  const aPagar30c = contasPend.filter(c=>parseInt(c.data.split('-')[2])>15).reduce((s,c)=>s+c.valor,0);

  let empQ15=0, empQ30=0;
  const [ymYear,ymMonth]=ym.split('-').map(Number);
  S.emprestimos.forEach(e=>{
    if((e.dono||'eu')!=='eu') return;
    const d0=new Date(e.data+'T00:00:00');
    const idx=(ymYear-d0.getFullYear())*12+(ymMonth-1-d0.getMonth());
    if(idx>=e.pagas&&idx<e.nparc){
      const dInst=new Date(e.data+'T00:00:00'); dInst.setMonth(dInst.getMonth()+idx);
      if(dInst.getDate()<=15) empQ15+=e.vparc; else empQ30+=e.vparc;
    }
  });
  const totalQ15=aPagar15c+empQ15;
  const totalQ30=aPagar30c+empQ30;

  // Receitas por quinzena e saldo por quinzena
  const recQ15=receitasMes.filter(r=>parseInt(r.data.split('-')[2])<=15).reduce((s,r)=>s+r.valor,0);
  const recQ30=receitasMes.filter(r=>parseInt(r.data.split('-')[2])>15).reduce((s,r)=>s+r.valor,0);
  const saldo15=recQ15-totalQ15;
  const saldo30=recQ30-totalQ30;

  // Saldo do mês
  const totalDespesas = aPagar + pago + totalCartao;
  const saldoMes = totalReceitas - totalDespesas;
  const saldoColor = saldoMes >= 0 ? 'var(--grn)' : 'var(--red)';
  const saldoLabel = saldoMes >= 0 ? 'Sobra este mês' : 'Déficit este mês';

  const alertHtml = atrasadas>0
    ? `<div class="alert ar">⚠ Você tem <strong>${atrasadas} conta(s) atrasada(s)</strong>. <a href="#" onclick="go('contas');return false" style="color:var(--red);text-decoration:underline">Ver agora</a></div>` : '';

  // Saldo banner
  const saldoBanner = totalReceitas > 0 ? `
    <div style="background:${saldoMes>=0?'var(--grnD)':'var(--redD)'};border:1px solid ${saldoMes>=0?'var(--grnB)':'var(--redB)'};border-radius:var(--r);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:4px">${saldoLabel} — ${fmtMon(ym)}</div>
        <div style="font-family:'DM Serif Display',serif;font-size:1.8rem;letter-spacing:-.3px;color:${saldoColor}">${fmt(Math.abs(saldoMes))}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.72rem;color:var(--t3)">Receitas: <span style="color:var(--grn);font-weight:600">${fmt(totalReceitas)}</span></div>
        <div style="font-size:.72rem;color:var(--t3);margin-top:3px">Despesas: <span style="color:var(--red);font-weight:600">${fmt(totalDespesas)}</span></div>
        <button class="btn btn-s btn-sm" onclick="go('receitas')" style="margin-top:8px;font-size:.7rem">Ver receitas →</button>
      </div>
    </div>` : `
    <div class="alert ay" style="margin-bottom:20px;cursor:pointer" onclick="go('receitas')">
      💡 Adicione seu salário para ver o saldo disponível do mês. <span style="text-decoration:underline">Clique aqui →</span>
    </div>`;

  document.getElementById('page-content').innerHTML = `
    ${alertHtml}
    ${saldoBanner}
    <div class="sc-grid" id="overview-cards">
      <div class="sc cgrn" data-card="receitas" style="cursor:pointer" onclick="go('receitas')">
        <button class="card-eye" onclick="event.stopPropagation();toggleBlurCard('receitas')" title="Borrar/mostrar">👁</button>
        <div class="lbl">Receitas</div><div class="val">${fmt(totalReceitas)}</div><div class="sub">${fmtMon(ym)}</div>
        <div style="margin-top:8px;border-top:1px solid var(--b1);padding-top:7px;display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;font-size:.7rem"><span style="color:var(--t3)">Saldo dia 15</span><span style="font-weight:600;color:${saldo15>=0?'var(--grn)':'var(--red)'}">${fmt(saldo15)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem"><span style="color:var(--t3)">Saldo dia 30</span><span style="font-weight:600;color:${saldo30>=0?'var(--grn)':'var(--red)'}">${fmt(saldo30)}</span></div>
        </div>
      </div>
      <div class="sc cred" data-card="apagar">
        <button class="card-eye" onclick="toggleBlurCard('apagar')" title="Borrar/mostrar">👁</button>
        <div class="lbl">A Pagar</div><div class="val">${fmt(aPagar)}</div><div class="sub">${fmtMon(ym)}</div>
        <div style="margin-top:8px;border-top:1px solid var(--b1);padding-top:7px;display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;font-size:.7rem"><span style="color:var(--t3)">Dia 15</span><span style="font-weight:600">${fmt(totalQ15)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem"><span style="color:var(--t3)">Dia 30</span><span style="font-weight:600">${fmt(totalQ30)}</span></div>
        </div>
      </div>
      <div class="sc" data-card="pago" style="border-left:3px solid var(--grn)">
        <button class="card-eye" onclick="toggleBlurCard('pago')" title="Borrar/mostrar">👁</button>
        <div class="lbl">Pago</div><div class="val" style="color:var(--grn)">${fmt(pago)}</div><div class="sub">${fmtMon(ym)}</div>
      </div>
      <div class="sc cblu" data-card="cartoes">
        <button class="card-eye" onclick="toggleBlurCard('cartoes')" title="Borrar/mostrar">👁</button>
        <div class="lbl">Em Cartões</div><div class="val">${fmt(totalCartao)}</div><div class="sub">Parcelas do mês</div>
      </div>
      <div class="sc cyel" data-card="emprestimos">
        <button class="card-eye" onclick="toggleBlurCard('emprestimos')" title="Borrar/mostrar">👁</button>
        <div class="lbl">Empréstimos</div><div class="val">${fmt(totalEmp)}</div><div class="sub">Saldo total</div>
      </div>
      <div class="sc" data-card="vr" style="border-left:3px solid var(--pur)">
        <button class="card-eye" onclick="toggleBlurCard('vr')" title="Borrar/mostrar">👁</button>
        <div class="lbl">Saldo VR</div><div class="val" style="color:var(--pur)">${fmt(S.vr.saldo)}</div><div class="sub">Vale Refeição</div>
      </div>
    </div>
    <div class="card">
      <div class="card-hdr"><span class="card-title">📊 Resumo — ${fmtMon(ym)}</span></div>
      <div class="card-body">
        ${totalReceitas>0?rbar('Receitas do mês',totalReceitas,Math.max(totalReceitas,totalDespesas)*1.1,'pg'):''}
        ${rbar('Despesas pagas',pago+totalCartao,Math.max(totalReceitas,totalDespesas)*1.1,'pr')}
        ${rbar('A pagar ainda',aPagar,Math.max(totalReceitas,aPagar)*1.2,'py')}
        ${rbar('Empréstimos pendentes',totalEmp,totalEmp*1.3,'pb')}
      </div>
    </div>
  `;
  updateBadge();
  updateSaldoBar();
  applyCardVisibility();
  updateEyeAllBtn();
  showEyeBtn(true);
}
function rbar(lbl,val,total,cls){
  const p=total>0?Math.min(100,val/total*100):0;
  return `<div style="margin-bottom:18px"><div class="flex-between mb3" style="margin-bottom:7px"><span style="font-size:.8rem;color:var(--t2)">${lbl}</span><span class="fw6">${fmt(val)}</span></div><div class="pbar"><div class="pfill ${cls}" style="width:${p}%"></div></div></div>`;
}
function updateBadge(){
  const n=S.contas.filter(c=>calcStatus(c)==='atrasado').length;
  const b=document.getElementById('badge-at');
  if(b){ b.textContent=n; b.style.display=n>0?'':'none'; }
}

function updateSaldoBar(){
  const ym=curMon();
  const recMes=(S.receitas||[]).filter(r=>r.data.startsWith(ym));
  const totalRec=recMes.reduce((s,r)=>s+r.valor,0);
  const contasMes=S.contas.filter(c=>c.data.startsWith(ym));
  const totalContas=contasMes.reduce((s,c)=>s+c.valor,0);
  let totalCartao=0;
  S.compras.forEach(cp=>{
    const vpp=cp.total/cp.parc;
    for(let i=0;i<cp.parc;i++){
      const d=new Date(cp.pparc+'T00:00:00');d.setMonth(d.getMonth()+i);
      const dm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(dm===ym) totalCartao+=vpp;
    }
  });
  const totalDesp=totalContas+totalCartao;
  const saldo=totalRec-totalDesp;
  const pos=saldo>=0;

  const elRec=document.getElementById('sb-rec');
  const elDesp=document.getElementById('sb-desp');
  const elVal=document.getElementById('sb-val');
  const elMain=document.getElementById('sb-main');
  const elMes=document.getElementById('sb-mes');
  if(!elRec) return;
  elRec.textContent=fmt(totalRec);
  elDesp.textContent=fmt(totalDesp);
  elVal.textContent=(pos?'':'−')+fmt(Math.abs(saldo));
  elVal.style.color=pos?'var(--grn)':'var(--red)';
  elMain.className='sb-main '+(pos?'pos':'neg');
  elMain.style.color=pos?'var(--grn)':'var(--red)';
  if(elMes) elMes.textContent=fmtMon(ym);
}

// ══════════════════════════════════════════════════
//  SIDEBAR DRAG-DROP
// ══════════════════════════════════════════════════
const DEFAULT_NAV = [
  {type:'label',text:'Geral'},
  {type:'item',page:'overview',ic:'🏠',label:'Visão Geral'},
  {type:'label',text:'Financeiro'},
  {type:'item',page:'contas',ic:'📋',label:'Contas a Pagar',badge:'badge-at',section:'contas'},
  {type:'item',page:'fixas',ic:'🔄',label:'Contas Fixas',section:'fixas'},
  {type:'item',page:'cartoes',ic:'💳',label:'Cartões',section:'cartoes'},
  {type:'item',page:'emprestimos',ic:'🏦',label:'Empréstimos',section:'emprestimos'},
  {type:'item',page:'receitas',ic:'💵',label:'Receitas',section:'receitas'},
  {type:'label',text:'Benefícios'},
  {type:'item',page:'vr',ic:'🍽️',label:'Vale Refeição',section:'vr'},
  {type:'label',text:'Planejamento'},
  {type:'item',page:'orcamento',ic:'🎯',label:'Orçamento'},
  {type:'item',page:'metas',ic:'🚀',label:'Metas'},
  {type:'label',text:'Sistema'},
  {type:'item',page:'configuracoes',ic:'⚙️',label:'Configurações'},
];

function getNavOrder(){
  try{
    const saved=JSON.parse(localStorage.getItem('fp_nav_order'));
    if(saved&&saved.length) return saved;
  }catch(e){}
  return DEFAULT_NAV;
}
function saveNavOrder(order){ localStorage.setItem('fp_nav_order',JSON.stringify(order)); }

let dragSrc=null;

function buildSidebar(activePage='overview'){
  const order=getNavOrder();
  const nav=document.getElementById('s-nav-list');
  nav.innerHTML='';
  order.forEach((entry,idx)=>{
    if(entry.type==='label'){
      const d=document.createElement('div');
      d.className='nlbl'; d.textContent=entry.text;
      nav.appendChild(d);
    } else {
      // Hide VR if disabled
      if(entry.section==='vr' && !vrEnabled()) return;
      // Hide disabled modules
      if(entry.section && !moduloVisivel(entry.section)) return;
      const btn=document.createElement('button');
      btn.className='ni'+(entry.page===activePage?' on':'');
      btn.dataset.page=entry.page;
      btn.dataset.idx=idx;
      btn.draggable=isAdmin(S.user); // only admins can reorder
      btn.innerHTML=`${isAdmin(S.user)?'<span class="drag-handle" title="Arrastar">⠿</span>':''}<span class="ic">${entry.ic}</span>${entry.label}${entry.badge?`<span class="nbadge" id="${entry.badge}" style="display:none">0</span>`:''}`;
      btn.addEventListener('click',function(){ go(entry.page,this); });
      if(isAdmin(S.user)){
        btn.addEventListener('dragstart',e=>{ dragSrc=btn; btn.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
        btn.addEventListener('dragend',()=>{ btn.classList.remove('dragging'); nav.querySelectorAll('.ni').forEach(b=>b.classList.remove('drag-over')); });
        btn.addEventListener('dragover',e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; btn.classList.add('drag-over'); });
        btn.addEventListener('dragleave',()=>btn.classList.remove('drag-over'));
        btn.addEventListener('drop',e=>{
          e.preventDefault();
          if(!dragSrc||dragSrc===btn) return;
          btn.classList.remove('drag-over');
          const srcIdx=+dragSrc.dataset.idx;
          const dstIdx=+btn.dataset.idx;
          const newOrder=[...order];
          const [moved]=newOrder.splice(srcIdx,1);
          const newDst=newOrder.findIndex((_,i)=>i===dstIdx-1)||dstIdx;
          newOrder.splice(newOrder.indexOf(order[dstIdx]),0,moved);
          saveNavOrder(newOrder);
          buildSidebar(activePage);
          updateBadge();
          toast('Menu reorganizado!','b');
        });
      }
      nav.appendChild(btn);
    }
  });
}

// ══════════════════════════════════════════════════
//  CARDS EYE TOGGLE (Visão Geral)
// ══════════════════════════════════════════════════
const CARD_DEFS=[
  {key:'receitas',label:'Receitas'},
  {key:'apagar',label:'A Pagar'},
  {key:'pago',label:'Pago'},
  {key:'cartoes',label:'Em Cartões'},
  {key:'emprestimos',label:'Empréstimos'},
  {key:'vr',label:'Saldo VR'},
];
function getHiddenCards(){
  try{ return JSON.parse(localStorage.getItem('fp_hidden_cards'))||[]; }catch(e){ return []; }
}
function saveHiddenCards(h){ localStorage.setItem('fp_hidden_cards',JSON.stringify(h)); }

function getBlurredCards(){
  try{ return JSON.parse(localStorage.getItem('fp_blurred_cards'))||[]; }catch(e){ return []; }
}
function saveBlurredCards(b){ localStorage.setItem('fp_blurred_cards',JSON.stringify(b)); }

function getBlurred(){
  return localStorage.getItem('fp_blurred')==='1';
}

function toggleBlurCard(key){
  let b=getBlurredCards();
  if(b.includes(key)) b=b.filter(x=>x!==key);
  else b.push(key);
  saveBlurredCards(b);
  applyCardVisibility();
}

function toggleCard(key){
  let h=getHiddenCards();
  if(h.includes(key)) h=h.filter(x=>x!==key);
  else h.push(key);
  saveHiddenCards(h);
  applyCardVisibility();
  renderConfigRows();
  updateEyeAllBtn();
}

function applyCardVisibility(){
  const h=getHiddenCards();
  const blurAll=getBlurred();
  const blurCards=getBlurredCards();
  document.querySelectorAll('.sc[data-card]').forEach(el=>{
    const k=el.dataset.card;
    // Disabled via config panel = remove from layout
    el.style.display=h.includes(k)?'none':'';
    // Blurred = via global eye OR per-card eye
    const isBlurred = blurAll || blurCards.includes(k);
    el.classList.toggle('hidden-card', isBlurred);
    // Update per-card eye icon
    const eye=el.querySelector('.card-eye');
    if(eye) eye.textContent=blurCards.includes(k)?'🙈':'👁';
  });
}

function toggleCardsConfig(e){
  e.stopPropagation();
  const panel=document.getElementById('cards-config');
  panel.classList.toggle('open');
  if(panel.classList.contains('open')) renderConfigRows();
}

function renderConfigRows(){
  const h=getHiddenCards();
  const div=document.getElementById('cfg-rows');
  if(!div) return;
  div.innerHTML=CARD_DEFS.map(c=>{
    const on=!h.includes(c.key);
    return `<div class="cfg-row" onclick="toggleCard('${c.key}')">
      <span>${c.label}</span>
      <button class="toggle-sw ${on?'on':'off'}" onclick="event.stopPropagation();toggleCard('${c.key}')"></button>
    </div>`;
  }).join('');
  const allHidden=CARD_DEFS.every(c=>h.includes(c.key));
  const allTxt=document.getElementById('cfg-all-txt');
  if(allTxt) allTxt.textContent=allHidden?'✓ Mostrar todos':'✕ Ocultar todos';
}

function toggleAllCards(){
  const h=getHiddenCards();
  const allKeys=CARD_DEFS.map(c=>c.key);
  const allHidden=allKeys.every(k=>h.includes(k));
  saveHiddenCards(allHidden?[]:allKeys);
  applyCardVisibility();
  renderConfigRows();
  updateEyeAllBtn();
}

function toggleBlurAll(){
  const blurred=getBlurred();
  localStorage.setItem('fp_blurred', blurred?'0':'1');
  // when showing all, also clear per-card blurs
  if(blurred) saveBlurredCards([]);
  applyCardVisibility();
  updateEyeAllBtn();
}

function updateEyeAllBtn(){
  const blurred=getBlurred();
  const ic=document.getElementById('eye-all-ic');
  const btn=document.getElementById('btn-eye-all');
  if(ic) ic.textContent=blurred?'🙈':'👁';
  if(btn) btn.classList.toggle('all-hidden', blurred);
}

function showEyeBtn(show){
  const b1=document.getElementById('btn-eye-all');
  const b2=document.getElementById('btn-cfg-cards');
  if(b1) b1.style.display=show?'flex':'none';
  if(b2) b2.style.display=show?'flex':'none';
  if(!show){
    const panel=document.getElementById('cards-config');
    if(panel) panel.classList.remove('open');
  }
}

// Close config panel when clicking outside
document.addEventListener('click',e=>{
  const panel=document.getElementById('cards-config');
  if(panel&&!panel.contains(e.target)&&e.target.id!=='btn-cfg-cards'){
    panel.classList.remove('open');
  }
});

// ══════════════════════════════════════════════════
//  CONTAS A PAGAR
// ══════════════════════════════════════════════════
let filtMes=curMon(), filtStatus='todos';
function renderContas(){
  const opts=['todos','pendente','pago','atrasado'];
  const optLabels={'todos':'Todos','pendente':'Pendente','pago':'Pago','atrasado':'Atrasado'};
  document.getElementById('page-content').innerHTML = `
    <div class="flex-between mb3" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="fbar">
        <select class="fsel" id="f-mes" onchange="filtMes=this.value;renderContas()">${monOpts(filtMes)}</select>
        <select class="fsel" id="f-status" onchange="filtStatus=this.value;renderContas()">
          ${opts.map(o=>`<option value="${o}"${o===filtStatus?' selected':''}>${optLabels[o]}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-s btn-sm" onclick="exportContasCSV()">⬇ CSV</button>
        <button class="btn btn-p" onclick="openModalConta()">+ Nova Conta</button>
      </div>
    </div>
    <div class="card">
      <div class="tw"><table>
        <thead><tr><th>Nome</th><th>Vencimento</th><th>Valor</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody id="tbody-contas"></tbody>
      </table></div>
    </div>
  `;
  loadContasTable();
}
function loadContasTable(){
  let cs=S.contas.filter(c=>c.data.substring(0,7)===filtMes);
  if(filtStatus==='atrasado') cs=cs.filter(c=>calcStatus(c)==='atrasado');
  else if(filtStatus==='pendente') cs=cs.filter(c=>calcStatus(c)==='pendente');
  else if(filtStatus==='pago') cs=cs.filter(c=>c.status==='pago');
  cs.sort((a,b)=>a.data.localeCompare(b.data));
  const tb=document.getElementById('tbody-contas');
  if(!cs.length){ tb.innerHTML='<tr class="empty"><td colspan="6">Nenhuma conta encontrada.</td></tr>'; return; }
  tb.innerHTML=cs.map(c=>{
    const st=calcStatus(c);
    return `<tr>
      <td class="s">${c.nome}${c.fixa?` <span style="font-size:.6rem;color:var(--t3)">[FIXA]</span>`:''}</td>
      <td>${fmtDate(c.data)}</td>
      <td class="fw6 ${st==='atrasado'?'tred':''}">${fmt(c.valor)}</td>
      <td>${c.cat}</td>
      <td>${badge(st)}</td>
      <td><div style="display:flex;gap:3px">
        ${st!=='pago'?`<button class="btn btn-g btn-ic btn-sm" title="Pagar" onclick="pagarConta('${c.id}')">✓</button>`:''}
        <button class="btn btn-s btn-ic btn-sm" title="Editar" onclick="editConta('${c.id}')">✎</button>
        <button class="btn btn-d btn-ic btn-sm" title="Excluir" onclick="delConta('${c.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}
function monOpts(sel){
  const d=new Date(); let h='';
  for(let i=-2;i<=10;i++){const dt=new Date(d.getFullYear(),d.getMonth()+i,1);const v=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;h+=`<option value="${v}"${v===sel?' selected':''}>${fmtMon(v)}</option>`;}
  return h;
}
function openModalConta(id=null){
  const c=id?S.contas.find(x=>x.id===id):null;
  document.getElementById('m-conta-title').textContent=c?'Editar Conta':'Nova Conta';
  document.getElementById('fc-id').value=c?.id||'';
  document.getElementById('fc-nome').value=c?.nome||'';
  document.getElementById('fc-valor').value=c?.valor||'';
  document.getElementById('fc-data').value=c?.data||filtMes+'-01';
  document.getElementById('fc-cat').value=c?.cat||'Moradia';
  document.getElementById('fc-status').value=c?.status||'pendente';
  document.getElementById('fc-obs').value=c?.obs||'';
  openModal('m-conta');
}
function editConta(id){ openModalConta(id); }
function saveConta(){
  const id=document.getElementById('fc-id').value;
  const nome=document.getElementById('fc-nome').value.trim();
  const valor=parseFloat(document.getElementById('fc-valor').value);
  const data=document.getElementById('fc-data').value;
  if(!nome||!valor||!data){ toast('Preencha os campos obrigatórios.','r'); return; }
  if(id){
    const c=S.contas.find(x=>x.id===id);
    Object.assign(c,{nome,valor,data,cat:document.getElementById('fc-cat').value,status:document.getElementById('fc-status').value,obs:document.getElementById('fc-obs').value});
    toast('Conta atualizada!','g');
  } else {
    S.contas.push({id:uid(),nome,valor,data,cat:document.getElementById('fc-cat').value,status:document.getElementById('fc-status').value,obs:document.getElementById('fc-obs').value});
    toast('Conta criada!','g');
  }
  saveStore(); closeModal('m-conta'); loadContasTable(); updateBadge(); updateSaldoBar();
}
function pagarConta(id){
  if(!confirm2('Marcar como pago?')) return;
  const c=S.contas.find(x=>x.id===id); c.status='pago';
  saveStore(); loadContasTable(); updateBadge(); updateSaldoBar(); toast('Marcado como pago!','g');
}
function delConta(id){
  if(!confirm2('Excluir esta conta?')) return;
  S.contas=S.contas.filter(x=>x.id!==id);
  saveStore(); loadContasTable(); updateBadge(); toast('Conta excluída.','b');
}
function exportContasCSV(){
  const cs=S.contas.filter(c=>c.data.substring(0,7)===filtMes);
  let csv='Nome,Valor,Vencimento,Categoria,Status\n'+cs.map(c=>`"${c.nome}",${c.valor},"${fmtDate(c.data)}","${c.cat}","${c.status}"`).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURI(csv); a.download=`contas_${filtMes}.csv`; a.click();
  toast('Exportado!','g');
}

// ══════════════════════════════════════════════════
//  CONTAS FIXAS
// ══════════════════════════════════════════════════
function renderFixas(){
  document.getElementById('page-content').innerHTML=`
    <div class="flex-between mb3" style="margin-bottom:14px">
      <p style="font-size:.78rem;color:var(--t2)">Geram lançamentos mensais automaticamente.</p>
      <button class="btn btn-p" onclick="openModalFixa()">+ Nova Conta Fixa</button>
    </div>
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Nome</th><th>Valor</th><th>Dia venc.</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody id="tbody-fixas"></tbody>
    </table></div></div>
  `;
  loadFixasTable();
}
function loadFixasTable(){
  const tb=document.getElementById('tbody-fixas');
  if(!S.fixas.length){ tb.innerHTML='<tr class="empty"><td colspan="6">Nenhuma conta fixa.</td></tr>'; return; }
  tb.innerHTML=S.fixas.map(f=>`<tr>
    <td class="s">${f.nome}</td><td class="fw6">${fmt(f.valor)}</td><td>Dia ${f.dia}</td><td>${f.cat}</td>
    <td>${badge(f.ativa?'ativo':'pausado')}</td>
    <td><div style="display:flex;gap:3px">
      <button class="btn btn-s btn-ic btn-sm" title="${f.ativa?'Pausar':'Ativar'}" onclick="toggleFixa('${f.id}')">${f.ativa?'⏸':'▶'}</button>
      <button class="btn btn-s btn-ic btn-sm" title="Editar" onclick="editFixa('${f.id}')">✎</button>
      <button class="btn btn-d btn-ic btn-sm" title="Excluir" onclick="delFixa('${f.id}')">✕</button>
    </div></td>
  </tr>`).join('');
}
function openModalFixa(id=null){
  const f=id?S.fixas.find(x=>x.id===id):null;
  document.getElementById('m-fixa-title').textContent=f?'Editar Conta Fixa':'Nova Conta Fixa';
  document.getElementById('ff-id').value=f?.id||'';
  document.getElementById('ff-nome').value=f?.nome||'';
  document.getElementById('ff-valor').value=f?.valor||'';
  document.getElementById('ff-dia').value=f?.dia||'';
  document.getElementById('ff-cat').value=f?.cat||'Moradia';
  document.getElementById('ff-obs').value=f?.obs||'';
  openModal('m-fixa');
}
function editFixa(id){ openModalFixa(id); }
function saveFixa(){
  const id=document.getElementById('ff-id').value;
  const nome=document.getElementById('ff-nome').value.trim();
  const valor=parseFloat(document.getElementById('ff-valor').value);
  const dia=parseInt(document.getElementById('ff-dia').value);
  if(!nome||!valor||!dia){ toast('Preencha os campos obrigatórios.','r'); return; }
  if(id){ const f=S.fixas.find(x=>x.id===id); Object.assign(f,{nome,valor,dia,cat:document.getElementById('ff-cat').value,obs:document.getElementById('ff-obs').value}); toast('Atualizado!','g'); }
  else { S.fixas.push({id:uid(),nome,valor,dia,cat:document.getElementById('ff-cat').value,obs:document.getElementById('ff-obs').value,ativa:true}); toast('Conta fixa criada!','g'); }
  saveStore(); closeModal('m-fixa'); loadFixasTable();
}
function toggleFixa(id){ const f=S.fixas.find(x=>x.id===id); f.ativa=!f.ativa; saveStore(); loadFixasTable(); toast(f.ativa?'Ativado!':'Pausado.','b'); }
function delFixa(id){ if(!confirm2('Excluir?')) return; S.fixas=S.fixas.filter(x=>x.id!==id); saveStore(); loadFixasTable(); toast('Removido.','b'); }

// ══════════════════════════════════════════════════
//  CARTÕES
// ══════════════════════════════════════════════════
let ccTab='list', ccFatura={cartao:null,mes:curMon()};
function renderCartoes(){
  document.getElementById('page-content').innerHTML=`
    <div class="tabs">
      <button class="tab${ccTab==='list'?' on':''}" onclick="switchCC('list',this)">💳 Meus Cartões</button>
      <button class="tab${ccTab==='fat'?' on':''}" onclick="switchCC('fat',this)">📄 Faturas</button>
      <button class="tab${ccTab==='buy'?' on':''}" onclick="switchCC('buy',this)">🛒 Compras</button>
    </div>
    <div id="cc-panel"></div>
  `;
  loadCCPanel();
}
function switchCC(tab,btn){ ccTab=tab; document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); loadCCPanel(); }
function loadCCPanel(){
  if(ccTab==='list') loadCCList();
  else if(ccTab==='fat') loadCCFatura();
  else loadCCBuy();
}
function loadCCList(){
  const panel=document.getElementById('cc-panel');
  panel.innerHTML=`<div style="text-align:right;margin-bottom:14px"><button class="btn btn-p" onclick="openModalCartao()">+ Novo Cartão</button></div>
  <div class="cc-wrap">${S.cartoes.map(k=>ccVisual(k)).join('')}</div>`;
}
function ccVisual(k){
  const palettes=[
    'linear-gradient(135deg,#1e3a8a,#2563eb,#1d4ed8)',
    'linear-gradient(135deg,#14532d,#166534,#15803d)',
    'linear-gradient(135deg,#3b0764,#7c3aed,#6d28d9)',
    'linear-gradient(135deg,#7c2d12,#c2410c,#ea580c)',
    'linear-gradient(135deg,#0c4a6e,#0891b2,#0e7490)',
  ];
  const bg=palettes[k.nome.charCodeAt(0)%palettes.length];
  // calc total do cartão no mês atual
  let used=0;
  const ym=curMon();
  S.compras.filter(c=>c.cartao===k.id).forEach(cp=>{
    const vpp=cp.total/cp.parc;
    for(let i=0;i<cp.parc;i++){
      const d=new Date(cp.pparc+'T00:00:00'); d.setMonth(d.getMonth()+i);
      const dm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(dm===ym) used+=vpp;
    }
  });
  const pct=Math.min(100,used/k.limite*100);
  const color=pct>80?'#f75f5f':pct>60?'#f7c948':'rgba(255,255,255,.85)';
  return `<div>
    <div class="cc" style="background:${bg}">
      <div class="cc-actions">
        <button class="cc-btn" onclick="editCartao('${k.id}')">✎</button>
        <button class="cc-btn" onclick="delCartao('${k.id}')">✕</button>
      </div>
      <div class="cc-name">${k.nome}</div>
      <div class="cc-lbl">LIMITE DISPONÍVEL</div>
      <div class="cc-val">${fmt(k.limite-used)}</div>
      <div class="cc-dates"><div>Fecha dia <strong>${k.fech}</strong></div><div>Vence dia <strong>${k.venc}</strong></div></div>
      <div class="cc-bar"><div class="cc-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="cc-info"><span>${pct.toFixed(0)}% do limite usado</span><span>${fmt(used)} / ${fmt(k.limite)}</span></div>
    </div>
  </div>`;
}
function openModalCartao(id=null){
  const k=id?S.cartoes.find(x=>x.id===id):null;
  document.getElementById('fk-id').value=k?.id||'';
  document.getElementById('fk-nome').value=k?.nome||'';
  document.getElementById('fk-limite').value=k?.limite||'';
  document.getElementById('fk-fech').value=k?.fech||'';
  document.getElementById('fk-venc').value=k?.venc||'';
  openModal('m-cartao');
}
function editCartao(id){ openModalCartao(id); }
function saveCartao(){
  const id=document.getElementById('fk-id').value;
  const nome=document.getElementById('fk-nome').value.trim();
  const limite=parseFloat(document.getElementById('fk-limite').value);
  const fech=parseInt(document.getElementById('fk-fech').value);
  const venc=parseInt(document.getElementById('fk-venc').value);
  if(!nome||!limite||!fech||!venc){ toast('Preencha todos os campos.','r'); return; }
  if(id){ const k=S.cartoes.find(x=>x.id===id); Object.assign(k,{nome,limite,fech,venc}); toast('Cartão atualizado!','g'); }
  else { S.cartoes.push({id:uid(),nome,limite,fech,venc}); toast('Cartão adicionado!','g'); }
  saveStore(); closeModal('m-cartao'); loadCCList();
}
function delCartao(id){ if(!confirm2('Excluir cartão e compras?')) return; S.cartoes=S.cartoes.filter(x=>x.id!==id); S.compras=S.compras.filter(x=>x.cartao!==id); saveStore(); loadCCList(); toast('Removido.','b'); }

function loadCCFatura(){
  const panel=document.getElementById('cc-panel');
  if(!ccFatura.cartao && S.cartoes.length) ccFatura.cartao=S.cartoes[0].id;
  panel.innerHTML=`
    <div class="fbar" style="margin-bottom:16px">
      <select class="fsel" onchange="ccFatura.cartao=this.value;loadCCFatura()">${S.cartoes.map(k=>`<option value="${k.id}"${k.id===ccFatura.cartao?' selected':''}>${k.nome}</option>`).join('')}</select>
      <select class="fsel" onchange="ccFatura.mes=this.value;loadCCFatura()">${monOpts(ccFatura.mes)}</select>
    </div>
    <div id="fat-content"></div>
  `;
  if(!S.cartoes.length){ document.getElementById('fat-content').innerHTML='<p style="color:var(--t3)">Nenhum cartão.</p>'; return; }
  const parcelas=[];
  S.compras.filter(c=>c.cartao===ccFatura.cartao).forEach(cp=>{
    const vpp=cp.total/cp.parc;
    for(let i=0;i<cp.parc;i++){
      const d=new Date(cp.pparc+'T00:00:00'); d.setMonth(d.getMonth()+i);
      const dm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(dm===ccFatura.mes) parcelas.push({desc:cp.desc,num:i+1,total:cp.parc,val:vpp,data:d.toISOString().split('T')[0]});
    }
  });
  const total=parcelas.reduce((s,p)=>s+p.val,0);
  const fc=document.getElementById('fat-content');
  if(!parcelas.length){ fc.innerHTML='<div style="text-align:center;padding:36px;color:var(--t3)">Sem lançamentos neste mês.</div>'; return; }
  fc.innerHTML=`
    <div style="background:var(--accD);border:1px solid var(--accB);border-radius:var(--rs);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
      <span style="color:var(--t2);font-size:.8rem">Total da fatura:</span>
      <strong style="font-size:1.2rem;color:var(--acc)">${fmt(total)}</strong>
    </div>
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Descrição</th><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
      <tbody>${parcelas.map(p=>`<tr><td class="s">${p.desc}</td><td>${p.num}/${p.total}</td><td>${fmtDate(p.data)}</td><td class="fw6">${fmt(p.val)}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
}

function loadCCBuy(){
  const panel=document.getElementById('cc-panel');
  panel.innerHTML=`
    <div style="text-align:right;margin-bottom:14px"><button class="btn btn-p" onclick="openModalCompra()">+ Lançar Compra</button></div>
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Cartão</th><th>Descrição</th><th>Total</th><th>Parcelamento</th><th>Data</th><th></th></tr></thead>
      <tbody>${!S.compras.length?'<tr class="empty"><td colspan="6">Nenhuma compra.</td></tr>':S.compras.map(cp=>{
        const k=S.cartoes.find(x=>x.id===cp.cartao);
        return `<tr><td>${k?.nome||'—'}</td><td class="s">${cp.desc}</td><td class="fw6">${fmt(cp.total)}</td><td>${cp.parc}x de ${fmt(cp.total/cp.parc)}</td><td>${fmtDate(cp.data)}</td><td><button class="btn btn-d btn-ic btn-sm" onclick="delCompra('${cp.id}')">✕</button></td></tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
}
function openModalCompra(){
  const sel=document.getElementById('fcp-cartao');
  sel.innerHTML=S.cartoes.map(k=>`<option value="${k.id}">${k.nome}</option>`).join('');
  document.getElementById('fcp-data').value=today();
  document.getElementById('fcp-parc1').value=today();
  document.getElementById('fcp-desc').value='';
  document.getElementById('fcp-valor').value='';
  document.getElementById('fcp-parc').value='1';
  openModal('m-compra');
}
function saveCompra(){
  const cartao=document.getElementById('fcp-cartao').value;
  const desc=document.getElementById('fcp-desc').value.trim();
  const total=parseFloat(document.getElementById('fcp-valor').value);
  const parc=parseInt(document.getElementById('fcp-parc').value)||1;
  const data=document.getElementById('fcp-data').value;
  const pparc=document.getElementById('fcp-parc1').value;
  if(!cartao||!desc||!total||!data||!pparc){ toast('Preencha os campos.','r'); return; }
  S.compras.push({id:uid(),cartao,desc,total,parc,data,pparc});
  saveStore(); closeModal('m-compra'); loadCCBuy(); toast('Compra lançada!','g');
}
function delCompra(id){ if(!confirm2('Excluir esta compra?')) return; S.compras=S.compras.filter(x=>x.id!==id); saveStore(); loadCCBuy(); toast('Removido.','b'); }

// ══════════════════════════════════════════════════
//  EMPRÉSTIMOS
// ══════════════════════════════════════════════════
let filtEmpDono='todos';

function renderEmp(){
  document.getElementById('page-content').innerHTML=`
    <div class="flex-between" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="fbar">
        <select class="fsel" onchange="filtEmpDono=this.value;loadEmpList()">
          <option value="todos">Todos</option>
          <option value="eu">👤 Meus</option>
          <option value="outro">👥 De outras pessoas</option>
        </select>
      </div>
      <button class="btn btn-p" onclick="openModalEmp()">+ Novo Empréstimo</button>
    </div>
    <div id="emp-list"></div>
  `;
  loadEmpList();
}

function donoBadge(e){
  if((e.dono||'eu')==='eu')
    return `<span style="font-size:.65rem;font-weight:600;background:var(--accD);color:var(--acc);border:1px solid var(--accB);border-radius:20px;padding:2px 8px">👤 Meu</span>`;
  const nome=e.donoNome||'Outro';
  return `<span style="font-size:.65rem;font-weight:600;background:var(--purD);color:var(--pur);border:1px solid rgba(167,139,250,.3);border-radius:20px;padding:2px 8px">👥 ${nome}</span>`;
}

function loadEmpList(){
  const div=document.getElementById('emp-list');
  let emps=S.emprestimos;
  if(filtEmpDono==='eu') emps=emps.filter(e=>(e.dono||'eu')==='eu');
  if(filtEmpDono==='outro') emps=emps.filter(e=>(e.dono||'eu')==='outro');
  if(!emps.length){ div.innerHTML='<div style="text-align:center;padding:48px;color:var(--t3)">Nenhum empréstimo encontrado.</div>'; return; }
  div.innerHTML=emps.map(e=>{
    const pend=e.nparc-e.pagas;
    const saldo=pend*e.vparc;
    const pct=e.nparc>0?e.pagas/e.nparc*100:0;
    const cls=pct===100?'pg':pct>70?'pb':'py';
    return `<div class="card" style="margin-bottom:14px">
      <div class="card-hdr">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="card-title">${e.nome}</span>
            ${donoBadge(e)}
          </div>
          <div style="font-size:.72rem;color:var(--t3);margin-top:3px">${e.nparc} parcelas de ${fmt(e.vparc)}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-s btn-sm" onclick="verParcelas('${e.id}')">Ver parcelas</button>
          <button class="btn btn-s btn-ic btn-sm" onclick="openModalEmp('${e.id}')">✎</button>
          <button class="btn btn-d btn-ic btn-sm" onclick="delEmp('${e.id}')">✕</button>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px">
          <div><div style="font-size:.63rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Pagas</div><div class="fw6 tgrn" style="font-size:1rem;margin-top:3px">${e.pagas}</div></div>
          <div><div style="font-size:.63rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Pendentes</div><div class="fw6 tyel" style="font-size:1rem;margin-top:3px">${pend}</div></div>
          <div><div style="font-size:.63rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Saldo</div><div class="fw6 tred" style="font-size:1rem;margin-top:3px">${fmt(saldo)}</div></div>
        </div>
        <div class="pbar"><div class="pfill ${cls}" style="width:${pct}%"></div></div>
        <div style="font-size:.65rem;color:var(--t3);margin-top:5px">${pct.toFixed(0)}% quitado${pct===100?' — 🎉 Concluído!':''}</div>
      </div>
    </div>`;
  }).join('');
}

function updateDonoStyle(){
  const isEu=document.getElementById('fe-dono-eu').checked;
  const lblEu=document.getElementById('lbl-eu');
  const lblOut=document.getElementById('lbl-outro');
  const nomeInput=document.getElementById('fe-dono-nome');

  lblEu.style.background=isEu?'var(--accD)':'var(--bg3)';
  lblEu.style.borderColor=isEu?'var(--accB)':'var(--b1)';
  lblEu.style.color=isEu?'var(--acc)':'var(--t2)';

  lblOut.style.background=!isEu?'var(--accD)':'var(--bg3)';
  lblOut.style.borderColor=!isEu?'var(--accB)':'var(--b1)';
  lblOut.style.color=!isEu?'var(--acc)':'var(--t2)';

  nomeInput.style.display=isEu?'none':'block';
  if(!isEu) setTimeout(()=>nomeInput.focus(),50);
}

function openModalEmp(id=null){
  const e=id?S.emprestimos.find(x=>x.id===id):null;
  document.getElementById('m-emp-title').textContent=e?'Editar Empréstimo':'Novo Empréstimo';
  document.getElementById('fe-id').value=e?.id||'';
  document.getElementById('fe-nome').value=e?.nome||'';
  document.getElementById('fe-nparc').value=e?.nparc||'';
  document.getElementById('fe-vparc').value=e?.vparc||'';
  document.getElementById('fe-pagas').value=e?.pagas||0;
  document.getElementById('fe-data').value=e?.data||today();
  document.getElementById('fe-obs').value=e?.obs||'';
  const dono=e?.dono||'eu';
  document.getElementById('fe-dono-eu').checked=(dono==='eu');
  document.getElementById('fe-dono-outro').checked=(dono==='outro');
  document.getElementById('fe-dono-nome').value=e?.donoNome||'';
  updateDonoStyle();
  openModal('m-emp');
}

function saveEmp(){
  const id=document.getElementById('fe-id').value;
  const nome=document.getElementById('fe-nome').value.trim();
  const nparc=parseInt(document.getElementById('fe-nparc').value);
  const vparc=parseFloat(document.getElementById('fe-vparc').value);
  const pagas=parseInt(document.getElementById('fe-pagas').value)||0;
  const data=document.getElementById('fe-data').value;
  const obs=document.getElementById('fe-obs').value;
  const dono=document.getElementById('fe-dono-outro').checked?'outro':'eu';
  const donoNome=dono==='outro'?document.getElementById('fe-dono-nome').value.trim():'';
  if(!nome||!nparc||!vparc||!data){ toast('Preencha os campos obrigatórios.','r'); return; }
  if(dono==='outro'&&!donoNome){ toast('Digite o nome da pessoa.','r'); document.getElementById('fe-dono-nome').focus(); return; }
  if(id){
    const e=S.emprestimos.find(x=>x.id===id);
    Object.assign(e,{nome,nparc,vparc,pagas,data,obs,dono,donoNome});
    toast('Empréstimo atualizado!','g');
  } else {
    S.emprestimos.push({id:uid(),nome,nparc,vparc,pagas,data,obs,dono,donoNome});
    toast('Empréstimo cadastrado!','g');
  }
  saveStore(); closeModal('m-emp'); loadEmpList();
}
function delEmp(id){ if(!confirm2('Excluir empréstimo?')) return; S.emprestimos=S.emprestimos.filter(x=>x.id!==id); saveStore(); loadEmpList(); toast('Removido.','b'); }
function verParcelas(id){
  const e=S.emprestimos.find(x=>x.id===id);
  document.getElementById('m-parc-title').textContent=`Parcelas — ${e.nome}`;
  let rows='';
  for(let i=1;i<=e.nparc;i++){
    const paga=i<=e.pagas;
    const d=new Date(e.data+'T00:00:00'); d.setMonth(d.getMonth()+(i-1));
    rows+=`<tr>
      <td>${i}</td><td>${fmtDate(d.toISOString().split('T')[0])}</td>
      <td class="fw6">${fmt(e.vparc)}</td>
      <td>${paga?'<span class="badge bg">✓ Paga</span>':'<span class="badge bp">⏳ Pendente</span>'}</td>
      <td><button class="btn btn-sm ${paga?'btn-s':'btn-g'}" onclick="toggleParc('${id}',${i})">${paga?'Desfazer':'Marcar paga'}</button></td>
    </tr>`;
  }
  document.getElementById('m-parc-body').innerHTML=`<div class="tw"><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  openModal('m-parcelas');
}
function toggleParc(id,num){
  const e=S.emprestimos.find(x=>x.id===id);
  e.pagas=(num<=e.pagas)?num-1:num;
  saveStore(); verParcelas(id); loadEmpList();
}

// ══════════════════════════════════════════════════
//  VR
// ══════════════════════════════════════════════════
function renderVR(){
  document.getElementById('page-content').innerHTML=`
    <div class="vr-hero">
      <div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--t3);margin-bottom:5px">SALDO VALE REFEIÇÃO</div>
      <div class="vr-saldo" id="vr-saldo-val">${fmt(S.vr.saldo)}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
        <button class="btn btn-g" onclick="openVR('credito')">+ Adicionar crédito</button>
        <button class="btn btn-d" onclick="openVR('debito')">− Registrar gasto</button>
      </div>
    </div>
    <div class="card">
      <div class="card-hdr"><span class="card-title">Histórico de movimentações</span>
        <button class="btn btn-s btn-sm" onclick="exportVR()">⬇ CSV</button>
      </div>
      <div class="tw"><table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Saldo após</th></tr></thead>
        <tbody>${!S.vrTrans.length?'<tr class="empty"><td colspan="5">Sem movimentações.</td></tr>':
          S.vrTrans.map(t=>`<tr>
            <td>${fmtDate(t.data)}</td>
            <td>${t.tipo==='credito'?'<span class="badge bg">↑ Crédito</span>':'<span class="badge br">↓ Débito</span>'}</td>
            <td>${t.desc||'—'}</td>
            <td class="fw6 ${t.tipo==='credito'?'tgrn':'tred'}">${t.tipo==='credito'?'+':'-'}${fmt(t.valor)}</td>
            <td>${fmt(t.saldo)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `;
}
function openVR(tipo){
  document.getElementById('fvr-tipo').value=tipo;
  document.getElementById('m-vr-title').textContent=tipo==='credito'?'+ Adicionar Crédito VR':'− Registrar Gasto VR';
  document.getElementById('fvr-valor').value='';
  document.getElementById('fvr-desc').value='';
  openModal('m-vr');
}
function saveVR(){
  const tipo=document.getElementById('fvr-tipo').value;
  const valor=parseFloat(document.getElementById('fvr-valor').value);
  const desc=document.getElementById('fvr-desc').value.trim();
  if(!valor||valor<=0){ toast('Informe um valor válido.','r'); return; }
  const novoSaldo=tipo==='credito'?S.vr.saldo+valor:S.vr.saldo-valor;
  S.vr.saldo=Math.round(novoSaldo*100)/100;
  S.vrTrans.unshift({id:uid(),tipo,valor,desc,saldo:S.vr.saldo,data:today()});
  saveStore(); closeModal('m-vr'); renderVR(); toast('Movimentação registrada!','g');
}
function exportVR(){
  let csv='Data,Tipo,Descrição,Valor,Saldo após\n'+S.vrTrans.map(t=>`"${fmtDate(t.data)}","${t.tipo}","${t.desc}",${t.valor},${t.saldo}`).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURI(csv); a.download='vr_historico.csv'; a.click();
  toast('Exportado!','g');
}

// ══════════════════════════════════════════════════
//  RECEITAS
// ══════════════════════════════════════════════════
let filtMesRec = curMon();
const CAT_ICON={'Salário':'💼','Adiantamento':'💼','Pensão/Benefício':'👶','Loja Enjoei':'🛍️','Freelance':'💻','Investimentos':'📈','Outros':'📦'};

function renderReceitas(){
  const ym=filtMesRec;
  const recMes=(S.receitas||[]).filter(r=>r.data.startsWith(ym.substring(0,7)));
  const totalMes=recMes.reduce((s,r)=>s+r.valor,0);
  const contasMes=S.contas.filter(c=>c.data.startsWith(ym.substring(0,7)));
  const totalContas=contasMes.reduce((s,c)=>s+c.valor,0);
  let totalCartao=0;
  S.compras.forEach(cp=>{
    const vpp=cp.total/cp.parc;
    for(let i=0;i<cp.parc;i++){
      const d=new Date(cp.pparc+'T00:00:00');d.setMonth(d.getMonth()+i);
      const dm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(dm===ym.substring(0,7)) totalCartao+=vpp;
    }
  });
  const totalDesp=totalContas+totalCartao;
  const saldo=totalMes-totalDesp;
  const sPos=saldo>=0;
  const enjoei=recMes.filter(r=>r.cat==='Loja Enjoei');
  const totalEnjoei=enjoei.reduce((s,r)=>s+r.valor,0);
  const fixasUnicas=[...new Map((S.receitas||[]).filter(r=>r.recorrente&&r.diaFixo).map(r=>[r.cat+'_'+r.diaFixo,r])).values()];

  document.getElementById('page-content').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
      <div class="sc cgrn"><div class="lbl">Receitas</div><div class="val">${fmt(totalMes)}</div><div class="sub">${fmtMon(ym)}</div></div>
      <div class="sc cred"><div class="lbl">Despesas</div><div class="val">${fmt(totalDesp)}</div><div class="sub">${fmtMon(ym)}</div></div>
      <div class="sc" style="border-left:3px solid ${sPos?'var(--grn)':'var(--red)'}">
        <div class="lbl">Saldo do Mês</div>
        <div class="val" style="color:${sPos?'var(--grn)':'var(--red)'}">${fmt(Math.abs(saldo))}</div>
        <div class="sub">${sPos?'✓ Sobra':'⚠ Déficit'}</div>
      </div>
      ${totalEnjoei>0?`<div class="sc" style="border-left:3px solid var(--pur)"><div class="lbl">Loja Enjoei</div><div class="val" style="color:var(--pur)">${fmt(totalEnjoei)}</div><div class="sub">${enjoei.length} venda(s)</div></div>`:''}
    </div>

    <div class="flex-between" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="fbar"><select class="fsel" id="f-mes-rec" onchange="filtMesRec=this.value;renderReceitas()">${monOpts(filtMesRec)}</select></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-s btn-sm" onclick="exportReceitasCSV()">⬇ CSV</button>
        <button class="btn btn-p" onclick="openModalReceita()">+ Lançar Receita</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-hdr"><span class="card-title">🔁 Receitas fixas mensais</span><span style="font-size:.72rem;color:var(--t3)">Chegam todo mês nos dias configurados</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
        ${fixasUnicas.length?fixasUnicas.map(r=>{
          const receb=recMes.find(x=>x.cat===r.cat&&x.recorrente);
          return `<div style="padding:16px 18px;border-right:1px solid var(--b1);border-bottom:1px solid var(--b1)">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
              <span style="font-size:1rem">${CAT_ICON[r.cat]||'📦'}</span>
              <span style="font-weight:600;font-size:.83rem">${r.cat}</span>
              ${receb?'<span class="badge bg" style="margin-left:auto;font-size:.6rem">✓ Recebido</span>':'<span class="badge bp" style="margin-left:auto;font-size:.6rem">⏳ Aguardando</span>'}
            </div>
            <div style="font-family:\'DM Serif Display\',serif;font-size:1.2rem;color:var(--grn)">${fmt(r.valor)}</div>
            <div style="font-size:.67rem;color:var(--t3);margin-top:3px">Todo dia ${r.diaFixo}${r.obs?' • '+r.obs:''}</div>
          </div>`;
        }).join(''):'<div style="padding:20px;color:var(--t3);font-size:.8rem;grid-column:1/-1">Nenhuma receita fixa configurada ainda.</div>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-hdr">
        <span class="card-title">🛍️ Loja Enjoei — ${fmtMon(ym)}</span>
        <button class="btn btn-p btn-sm" onclick="openModalReceitaCat('Loja Enjoei')">+ Registrar venda</button>
      </div>
      ${enjoei.length?`
        <div class="tw"><table>
          <thead><tr><th>Descrição</th><th>Data</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            ${enjoei.map(r=>`<tr><td class="s">${r.nome}</td><td>${fmtDate(r.data)}</td><td class="fw6 tgrn">${fmt(r.valor)}</td>
              <td><div style="display:flex;gap:3px"><button class="btn btn-s btn-ic btn-sm" onclick="editReceita('${r.id}')">✎</button><button class="btn btn-d btn-ic btn-sm" onclick="delReceita('${r.id}')">✕</button></div></td></tr>`).join('')}
            <tr style="background:var(--bg3)"><td colspan="2" style="font-weight:600;color:var(--t1)">Total do mês</td><td class="fw6 tgrn">${fmt(totalEnjoei)}</td><td></td></tr>
          </tbody>
        </table></div>`
      :`<div style="padding:28px;text-align:center;color:var(--t3);font-size:.82rem">Nenhuma venda este mês. <button class="btn btn-g btn-sm" onclick="openModalReceitaCat('Loja Enjoei')" style="margin-left:8px">+ Registrar venda</button></div>`}
    </div>

    <div class="card">
      <div class="card-hdr"><span class="card-title">📋 Todas as receitas — ${fmtMon(ym)}</span></div>
      <div class="tw"><table>
        <thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th><th>Valor</th><th>Ações</th></tr></thead>
        <tbody id="tbody-receitas"></tbody>
      </table></div>
    </div>
  `;
  loadReceitasTable();
}

function loadReceitasTable(){
  const ym=filtMesRec;
  const tb=document.getElementById('tbody-receitas');
  if(!tb) return;
  const recs=(S.receitas||[]).filter(r=>r.data.startsWith(ym.substring(0,7)));
  recs.sort((a,b)=>a.data.localeCompare(b.data));
  if(!recs.length){
    tb.innerHTML='<tr class="empty"><td colspan="5">Nenhuma receita neste mês.</td></tr>';
    return;
  }
  tb.innerHTML=recs.map(r=>`<tr>
    <td><span style="font-size:.95rem">${CAT_ICON[r.cat]||'📦'}</span> ${r.cat}</td>
    <td class="s">${r.nome}</td>
    <td>${fmtDate(r.data)}</td>
    <td class="fw6 tgrn">${fmt(r.valor)}</td>
    <td><div style="display:flex;gap:3px">
      <button class="btn btn-s btn-ic btn-sm" onclick="editReceita('${r.id}')">✎</button>
      <button class="btn btn-d btn-ic btn-sm" onclick="delReceita('${r.id}')">✕</button>
    </div></td>
  </tr>`).join('');
}

function openModalReceitaCat(cat){
  openModalReceita();
  setTimeout(()=>{ document.getElementById('fr-cat').value=cat; toggleDiaFixo(); },50);
}

function toggleDiaFixo(){
  const cat=document.getElementById('fr-cat').value;
  const fixas=['Salário','Adiantamento','Pensão/Benefício'];
  const isFixed=fixas.includes(cat);
  document.getElementById('fg-diaFixo').style.display=isFixed?'':'none';
  if(!document.getElementById('fr-id').value){ // só pré-preenche em criação
    document.getElementById('fr-rec').checked=isFixed;
    if(isFixed&&!document.getElementById('fr-diaFixo').value){
      const dias={'Salário':30,'Adiantamento':15,'Pensão/Benefício':10};
      document.getElementById('fr-diaFixo').value=dias[cat]||'';
    }
  }
}

function openModalReceita(id=null){
  const r=id?(S.receitas||[]).find(x=>x.id===id):null;
  document.getElementById('m-rec-title').textContent=r?'Editar Receita':'Nova Receita';
  document.getElementById('fr-id').value=r?.id||'';
  document.getElementById('fr-nome').value=r?.nome||'';
  document.getElementById('fr-valor').value=r?.valor||'';
  document.getElementById('fr-data').value=r?.data||filtMesRec+'-01';
  document.getElementById('fr-cat').value=r?.cat||'Salário';
  document.getElementById('fr-rec').checked=r?.recorrente||false;
  document.getElementById('fr-diaFixo').value=r?.diaFixo||'';
  document.getElementById('fr-obs').value=r?.obs||'';
  toggleDiaFixo();
  openModal('m-receita');
}
function editReceita(id){ openModalReceita(id); }
function saveReceita(){
  const id=document.getElementById('fr-id').value;
  const nome=document.getElementById('fr-nome').value.trim();
  const valor=parseFloat(document.getElementById('fr-valor').value);
  const data=document.getElementById('fr-data').value;
  const cat=document.getElementById('fr-cat').value;
  const recorrente=document.getElementById('fr-rec').checked;
  const diaFixo=parseInt(document.getElementById('fr-diaFixo').value)||null;
  const obs=document.getElementById('fr-obs').value;
  if(!nome||!valor||!data){ toast('Preencha os campos obrigatórios.','r'); return; }
  if(!S.receitas) S.receitas=[];
  if(id){ const r=S.receitas.find(x=>x.id===id); Object.assign(r,{nome,valor,data,cat,recorrente,diaFixo,obs}); toast('Receita atualizada!','g'); }
  else { S.receitas.push({id:uid(),nome,valor,data,cat,recorrente,diaFixo,obs}); toast('Receita adicionada!','g'); }
  saveStore(); closeModal('m-receita'); renderReceitas(); updateSaldoBar();
}
function delReceita(id){
  if(!confirm2('Excluir esta receita?')) return;
  S.receitas=(S.receitas||[]).filter(x=>x.id!==id);
  saveStore(); renderReceitas(); updateSaldoBar(); toast('Removida.','b');
}
function exportReceitasCSV(){
  const recs=(S.receitas||[]).filter(r=>r.data.startsWith(filtMesRec.substring(0,7)));
  if(!recs.length){ toast('Nenhuma receita no mês.','r'); return; }
  let csv='Categoria,Descrição,Valor,Data,Recorrente\n'+recs.map(r=>`"${r.cat}","${r.nome}",${r.valor},"${fmtDate(r.data)}","${r.recorrente?'Sim':'Não'}"`).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURI(csv); a.download=`receitas_${filtMesRec}.csv`; a.click();
  toast('Exportado!','g');
}

// ══════════════════════════════════════════════════
//  ADMIN PANEL
// ══════════════════════════════════════════════════
const ACCENT_COLORS=[
  {name:'Azul (padrão)',hex:'#4f8ef7'},{name:'Verde',hex:'#3ecf8e'},
  {name:'Roxo',hex:'#a78bfa'},{name:'Rosa',hex:'#f472b6'},
  {name:'Laranja',hex:'#fb923c'},{name:'Vermelho',hex:'#f75f5f'},
  {name:'Turquesa',hex:'#22d3ee'},{name:'Amarelo',hex:'#f7c948'},
  {name:'Índigo',hex:'#818cf8'},{name:'Lima',hex:'#84cc16'},
];
const MODULOS=[
  {key:'contas',ic:'📋',label:'Contas a Pagar',desc:'Gestão de contas e vencimentos'},
  {key:'fixas',ic:'🔄',label:'Contas Fixas',desc:'Recorrências mensais automáticas'},
  {key:'cartoes',ic:'💳',label:'Cartões de Crédito',desc:'Faturas e compras parceladas'},
  {key:'emprestimos',ic:'🏦',label:'Empréstimos',desc:'Financiamentos e parcelas'},
  {key:'receitas',ic:'💵',label:'Receitas',desc:'Salário, renda e entradas'},
  {key:'vr',ic:'🍽️',label:'Vale Refeição',desc:'Saldo VR independente'},
  {key:'categorias',ic:'🏷️',label:'Categorias',desc:'Organização por categoria'},
  {key:'orcamento',ic:'🎯',label:'Orçamento',desc:'Limites mensais de gasto'},
  {key:'metas',ic:'🚀',label:'Metas Financeiras',desc:'Objetivos e sonhos'},
];

function renderAdmin(){
  if(!isAdmin(S.user)){
    document.getElementById('page-content').innerHTML='<div class="alert ar">⛔ Acesso restrito ao administrador.</div>';
    return;
  }
  const cfg=S.adminCfg||{};
  const curColor=cfg.accentColor||'#4f8ef7';

  document.getElementById('page-content').innerHTML=`

    <!-- COR DE DESTAQUE -->
    <div class="admin-section">
      <div class="admin-section-hdr">
        <span class="ic">🎨</span>
        <div><h3>Cor de Destaque do Sistema</h3><p>Afeta botões, links e elementos ativos em toda a interface</p></div>
      </div>
      <div class="admin-section-body">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          ${ACCENT_COLORS.map(c=>`
            <button class="swatch${curColor===c.hex?' active':''}" style="background:${c.hex};width:36px;height:36px"
              title="${c.name}" onclick="setAccentColor('${c.hex}')"></button>
          `).join('')}
          <div style="display:flex;align-items:center;gap:8px;margin-left:8px;padding-left:12px;border-left:1px solid var(--b1)">
            <span style="font-size:.75rem;color:var(--t3)">Personalizada:</span>
            <input type="color" value="${curColor}"
              style="width:36px;height:36px;border-radius:50%;border:3px solid var(--b1);cursor:pointer;padding:2px;background:none"
              oninput="setAccentColor(this.value)">
          </div>
        </div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px">
          <span style="font-size:.75rem;color:var(--t3)">Prévia:</span>
          <button class="btn btn-p" style="font-size:.78rem;pointer-events:none">Botão de ação</button>
          <span id="admin-color-name" style="font-size:.75rem;color:var(--acc);font-weight:600">${ACCENT_COLORS.find(c=>c.hex===curColor)?.name||'Personalizada'}</span>
        </div>
      </div>
    </div>

    <!-- MÓDULOS -->
    <div class="admin-section">
      <div class="admin-section-hdr">
        <span class="ic">🧩</span>
        <div><h3>Módulos Visíveis</h3><p>Controle quais seções aparecem no menu para todos os usuários</p></div>
      </div>
      <div class="admin-section-body">
        ${MODULOS.map(m=>{
          const on=cfg.modulosVisiveis?.[m.key]!==false;
          return `<div class="admin-row">
            <div class="admin-row-info">
              <div class="title">${m.ic} ${m.label}</div>
              <div class="desc">${m.desc}</div>
            </div>
            <button class="toggle-sw ${on?'on':'off'}" id="sw-mod-${m.key}" onclick="toggleModulo('${m.key}')"></button>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- DANGER ZONE -->
    <div class="admin-section" style="border-color:var(--redB)">
      <div class="admin-section-hdr" style="background:var(--redD)">
        <span class="ic">⚠️</span>
        <div><h3 style="color:var(--red)">Zona de Risco</h3><p>Ações irreversíveis</p></div>
      </div>
      <div class="admin-section-body">
        <div class="admin-row">
          <div class="admin-row-info">
            <div class="title">Redefinir ordem do menu</div>
            <div class="desc">Restaura a ordem original dos itens da sidebar</div>
          </div>
          <button class="btn btn-d btn-sm" onclick="resetNavOrder()">Resetar</button>
        </div>
        <div class="admin-row">
          <div class="admin-row-info">
            <div class="title">Resetar cor de destaque</div>
            <div class="desc">Volta para o azul padrão do sistema</div>
          </div>
          <button class="btn btn-d btn-sm" onclick="setAccentColor('#4f8ef7')">Resetar cor</button>
        </div>
      </div>
    </div>
  `;
}

function setAccentColor(hex){
  if(!S.adminCfg) S.adminCfg={};
  S.adminCfg.accentColor=hex;
  saveStore();
  applyUserTheme();
  // Atualiza swatches ativos
  document.querySelectorAll('.swatch').forEach(s=>{
    s.classList.toggle('active', s.style.background===hex || s.style.backgroundColor===hex);
  });
  const nameEl=document.getElementById('admin-color-name');
  if(nameEl) nameEl.textContent=ACCENT_COLORS.find(c=>c.hex===hex)?.name||'Personalizada';
}

function toggleModulo(key){
  if(!S.adminCfg.modulosVisiveis) S.adminCfg.modulosVisiveis={};
  const cur=S.adminCfg.modulosVisiveis[key]!==false;
  S.adminCfg.modulosVisiveis[key]=!cur;
  // VR sync
  if(key==='vr') S.adminCfg.vrEnabled=!cur;
  saveStore();
  const sw=document.getElementById(`sw-mod-${key}`);
  if(sw) sw.className='toggle-sw '+(!cur?'on':'off');
  buildSidebar('admin');
  toast(`${MODULOS.find(m=>m.key===key)?.label} ${!cur?'ativado':'desativado'}!`,'g');
}

function resetNavOrder(){
  localStorage.removeItem('fp_nav_order');
  buildSidebar('admin');
  toast('Menu restaurado!','g');
}

// ══════════════════════════════════════════════════
//  CATEGORIAS
// ══════════════════════════════════════════════════
let _catTipo='despesa', _catCor='#4f8ef7', _metaCor='#3ecf8e';

function renderCategorias(){
  if(!S.categorias) S.categorias=[];
  const desp=S.categorias.filter(c=>c.tipo==='despesa');
  const rec=S.categorias.filter(c=>c.tipo==='receita');
  document.getElementById('page-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">📤 Despesas <span style="font-size:.72rem;color:var(--t3)">${desp.length} categorias</span></span>
          <button class="btn btn-p btn-sm" onclick="openModalCat('despesa')">+ Nova</button>
        </div>
        <div id="cat-desp-list">${renderCatList(desp)}</div>
      </div>
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">📥 Receitas <span style="font-size:.72rem;color:var(--t3)">${rec.length} categorias</span></span>
          <button class="btn btn-p btn-sm" onclick="openModalCat('receita')">+ Nova</button>
        </div>
        <div id="cat-rec-list">${renderCatList(rec)}</div>
      </div>
    </div>
  `;
}

function renderCatList(cats){
  if(!cats.length) return '<div style="padding:24px;text-align:center;color:var(--t3);font-size:.82rem">Nenhuma categoria.</div>';
  return cats.map(c=>`
    <div class="cat-item">
      <div class="cat-icon-circle" style="background:${c.cor}22;color:${c.cor}">${c.emoji||'●'}</div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:.85rem">${c.nome}</div>
        <div style="font-size:.68rem;color:var(--t3);margin-top:2px">${c.tipo==='despesa'?'Despesa':'Receita'}</div>
      </div>
      <div style="display:flex;gap:3px">
        <button class="btn btn-s btn-ic btn-sm" onclick="editCat('${c.id}')">✎</button>
        <button class="btn btn-d btn-ic btn-sm" onclick="delCat('${c.id}')">✕</button>
      </div>
    </div>`).join('');
}

function openModalCat(tipo='despesa', id=null){
  const c=id?(S.categorias||[]).find(x=>x.id===id):null;
  _catTipo=c?.tipo||tipo;
  _catCor=c?.cor||'#4f8ef7';
  document.getElementById('m-cat-title').textContent=c?'Editar Categoria':'Nova Categoria';
  document.getElementById('fcat-id').value=c?.id||'';
  document.getElementById('fcat-nome').value=c?.nome||'';
  document.getElementById('fcat-emoji').value=c?.emoji||'';
  setCatTipo(_catTipo);
  // Highlight active color
  setTimeout(()=>{
    document.querySelectorAll('#fcat-colors .csw').forEach(b=>b.classList.toggle('on',b.dataset.color===_catCor));
  },10);
  openModal('m-cat');
}
function editCat(id){ openModalCat(null,id); }
function setCatTipo(tipo){
  _catTipo=tipo;
  const bd=document.getElementById('fcat-despesa');
  const br=document.getElementById('fcat-receita');
  if(bd){ bd.className=tipo==='despesa'?'btn btn-p btn-sm':'btn btn-s btn-sm'; bd.style.flex='1'; }
  if(br){ br.className=tipo==='receita'?'btn btn-p btn-sm':'btn btn-s btn-sm'; br.style.flex='1'; }
}
function setCatColor(hex){
  _catCor=hex;
  document.querySelectorAll('#fcat-colors .csw').forEach(b=>b.classList.toggle('on',b.dataset.color===hex));
}
function saveCat(){
  const id=document.getElementById('fcat-id').value;
  const nome=document.getElementById('fcat-nome').value.trim();
  if(!nome){ toast('Preencha o nome.','r'); return; }
  if(!S.categorias) S.categorias=[];
  const data={id:id||uid(),nome,tipo:_catTipo,cor:_catCor,emoji:document.getElementById('fcat-emoji').value||'●'};
  if(id){ const i=S.categorias.findIndex(x=>x.id===id); S.categorias[i]=data; toast('Atualizado!','g'); }
  else { S.categorias.push(data); toast('Categoria criada!','g'); }
  saveStore(); closeModal('m-cat'); renderCategorias();
}
function delCat(id){
  if(!confirm2('Excluir esta categoria?')) return;
  S.categorias=(S.categorias||[]).filter(x=>x.id!==id);
  saveStore(); renderCategorias(); toast('Removida.','b');
}

// ══════════════════════════════════════════════════
//  ORÇAMENTO
// ══════════════════════════════════════════════════
let filtOrcMes=curMon();

// ══════════════════════════════════════════════════
//  ORÇAMENTO
// ══════════════════════════════════════════════════
const CATEGORIAS_PADRAO = [
  {nome:'Moradia',ic:'🏠',cor:'#22d3ee'},
  {nome:'Alimentação',ic:'🍽️',cor:'#34d399'},
  {nome:'Transporte',ic:'🚗',cor:'#a855f7'},
  {nome:'Saúde',ic:'❤️',cor:'#f472b6'},
  {nome:'Educação',ic:'📚',cor:'#60a5fa'},
  {nome:'Lazer',ic:'🎮',cor:'#fbbf24'},
  {nome:'Vestuário',ic:'👕',cor:'#f87171'},
  {nome:'Serviços',ic:'🔌',cor:'#fb923c'},
  {nome:'Financeiro',ic:'💰',cor:'#84cc16'},
  {nome:'Outros',ic:'📦',cor:'#94a3b8'},
];

function renderOrcamento(){
  if(!S.budgets) S.budgets={};
  const ym=filtOrcMes;
  const orcMes=S.budgets[ym]||{};

  // Calcula gastos por categoria das contas
  const gastos={};
  S.contas.filter(c=>c.data.startsWith(ym.substring(0,7))&&c.status==='pago').forEach(c=>{
    gastos[c.cat]=(gastos[c.cat]||0)+c.valor;
  });

  const totalLimite=CATEGORIAS_PADRAO.reduce((s,c)=>s+(orcMes[c.nome]||0),0);
  const totalGasto=CATEGORIAS_PADRAO.reduce((s,c)=>s+(gastos[c.nome]||0),0);
  const saldo=totalLimite-totalGasto;

  document.getElementById('page-content').innerHTML=`
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px;flex-wrap:wrap">
      <select class="fsel" onchange="filtOrcMes=this.value;renderOrcamento()">${monOpts(ym)}</select>
      <div style="display:flex;gap:18px;align-items:center;font-size:.82rem;color:var(--t2);flex-wrap:wrap">
        <span>Orçado: <strong style="color:var(--acc)">${fmt(totalLimite)}</strong></span>
        <span>Gasto: <strong style="color:var(--red)">${fmt(totalGasto)}</strong></span>
        <span>Disponível: <strong style="color:${saldo>=0?'var(--grn)':'var(--red)'}">${fmt(saldo)}</strong></span>
      </div>
    </div>
    <div class="card" style="overflow:visible">
      <div class="card-hdr">
        <span class="card-title">🎯 Limites por categoria — ${fmtMon(ym)}</span>
        <span style="font-size:.72rem;color:var(--t3)">Edite o valor ao lado para definir um limite</span>
      </div>
      <div style="padding:14px 18px">
        ${CATEGORIAS_PADRAO.map(c=>{
          const limite=orcMes[c.nome]||0;
          const gasto=gastos[c.nome]||0;
          const pct=limite>0?Math.min(100,gasto/limite*100):0;
          const over=limite>0&&gasto>limite;
          const barColor=over?'linear-gradient(90deg,#f87171,#fb923c)':pct>75?'linear-gradient(90deg,#fbbf24,#f87171)':c.cor;
          return `<div class="budget-card" style="background:transparent;border:1px solid var(--b1);margin-bottom:10px">
            <div class="budget-row">
              <div class="budget-name">
                <div class="budget-icon" style="background:${c.cor}22;color:${c.cor}">${c.ic}</div>
                ${c.nome}
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="budget-vals"><strong>${fmt(gasto)}</strong> de</span>
                <input type="number" class="budget-input" value="${limite}" min="0" step="50"
                  onchange="setOrcamento('${ym}','${c.nome}',this.value)" placeholder="Sem limite">
              </div>
            </div>
            <div class="budget-bar"><div class="budget-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <div class="budget-status ${over?'over':''}">
              ${limite>0?(over?`⚠ Acima do limite em ${fmt(gasto-limite)}`:`Restam ${fmt(limite-gasto)} • ${pct.toFixed(0)}% utilizado`):'Sem limite definido'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
function setOrcamento(ym, cat, val){
  if(!S.budgets) S.budgets={};
  if(!S.budgets[ym]) S.budgets[ym]={};
  S.budgets[ym][cat]=parseFloat(val)||0;
  saveStore();
  toast('Limite atualizado!','g');
}

// ══════════════════════════════════════════════════
//  METAS
// ══════════════════════════════════════════════════
function renderMetas(){
  if(!S.metas) S.metas=[];
  document.getElementById('page-content').innerHTML=`
    <div style="text-align:right;margin-bottom:14px">
      <button class="btn btn-p" onclick="openModalMeta()">+ Nova Meta</button>
    </div>
    <div class="goal-card-grid" id="metas-grid">
      ${!S.metas.length?'<div style="padding:48px;text-align:center;color:var(--t3);grid-column:1/-1">Nenhuma meta. Defina seus sonhos e objetivos!</div>':
        S.metas.map(m=>{
          const pct=m.alvo>0?Math.min(100,(m.atual/m.alvo)*100):0;
          const restante=Math.max(0,m.alvo-m.atual);
          const prazoStr=m.prazo?fmtDate(m.prazo):'Sem prazo';
          const diasRestantes=m.prazo?Math.ceil((new Date(m.prazo)-new Date())/86400000):null;
          const concluida=pct>=100;
          return `<div class="goal-card" style="border-top:3px solid ${m.cor||'var(--acc)'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="font-size:1.6rem">${m.emoji||'🎯'}</div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-s btn-ic btn-sm" onclick="openModalMeta('${m.id}')">✎</button>
                <button class="btn btn-d btn-ic btn-sm" onclick="delMeta('${m.id}')">✕</button>
              </div>
            </div>
            <div style="font-weight:600;font-size:.9rem;margin-top:10px">${m.nome}</div>
            <div style="font-size:.72rem;color:var(--t3);margin-top:2px">Prazo: ${prazoStr}${diasRestantes!==null?` • ${diasRestantes>0?diasRestantes+' dias':'⚠ Vencida'}`:''}</div>
            <div style="margin-top:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-family:'DM Serif Display',serif;font-size:1.3rem;color:${m.cor||'var(--acc)'}">${fmt(m.atual)}</span>
                <span style="font-size:.78rem;color:var(--t3)">${fmt(m.alvo)}</span>
              </div>
              <div class="pbar" style="height:7px"><div class="pfill" style="width:${pct}%;background:${m.cor||'var(--acc)'};height:7px;border-radius:4px;transition:width .5s"></div></div>
              <div style="display:flex;justify-content:space-between;margin-top:5px">
                <span style="font-size:.7rem;color:var(--t3)">${pct.toFixed(0)}% concluído</span>
                ${!concluida?`<span style="font-size:.7rem;color:var(--t3)">Faltam ${fmt(restante)}</span>`:'<span style="font-size:.7rem;color:var(--grn);font-weight:600">🎉 Concluída!</span>'}
              </div>
            </div>
            ${!concluida?`<button class="btn btn-g btn-sm btn-fw" style="margin-top:12px;width:100%;justify-content:center" onclick="openContrib('${m.id}')">+ Contribuir</button>`:''}
          </div>`;
        }).join('')}
    </div>`;
}
function openModalMeta(id=null){
  const m=id?(S.metas||[]).find(x=>x.id===id):null;
  _metaCor=m?.cor||'#3ecf8e';
  document.getElementById('m-meta-title').textContent=m?'Editar Meta':'Nova Meta';
  document.getElementById('fmeta-id').value=m?.id||'';
  document.getElementById('fmeta-nome').value=m?.nome||'';
  document.getElementById('fmeta-emoji').value=m?.emoji||'';
  document.getElementById('fmeta-alvo').value=m?.alvo||'';
  document.getElementById('fmeta-atual').value=m?.atual||0;
  document.getElementById('fmeta-prazo').value=m?.prazo||'';
  setTimeout(()=>document.querySelectorAll('#fmeta-colors .csw').forEach(b=>b.classList.toggle('on',b.dataset.color===_metaCor)),10);
  openModal('m-meta');
}
function setMetaColor(hex){
  _metaCor=hex;
  document.querySelectorAll('#fmeta-colors .csw').forEach(b=>b.classList.toggle('on',b.dataset.color===hex));
}
function saveMeta(){
  const id=document.getElementById('fmeta-id').value;
  const nome=document.getElementById('fmeta-nome').value.trim();
  const alvo=parseFloat(document.getElementById('fmeta-alvo').value);
  if(!nome||!alvo){ toast('Preencha nome e valor alvo.','r'); return; }
  if(!S.metas) S.metas=[];
  const data={id:id||uid(),nome,emoji:document.getElementById('fmeta-emoji').value||'🎯',alvo,atual:parseFloat(document.getElementById('fmeta-atual').value)||0,prazo:document.getElementById('fmeta-prazo').value,cor:_metaCor};
  if(id){ const i=S.metas.findIndex(x=>x.id===id); S.metas[i]=data; toast('Meta atualizada!','g'); }
  else { S.metas.push(data); toast('Meta criada!','g'); }
  saveStore(); closeModal('m-meta'); renderMetas();
}
function delMeta(id){
  if(!confirm2('Excluir esta meta?')) return;
  S.metas=(S.metas||[]).filter(x=>x.id!==id);
  saveStore(); renderMetas(); toast('Meta removida.','b');
}
function openContrib(id){
  document.getElementById('fcontrib-id').value=id;
  document.getElementById('fcontrib-valor').value='';
  openModal('m-contrib');
}
function saveContrib(){
  const id=document.getElementById('fcontrib-id').value;
  const val=parseFloat(document.getElementById('fcontrib-valor').value);
  if(!val||val<=0){ toast('Informe um valor válido.','r'); return; }
  const m=(S.metas||[]).find(x=>x.id===id);
  if(!m) return;
  m.atual=Math.min(m.alvo, m.atual+val);
  saveStore(); closeModal('m-contrib'); renderMetas();
  if(m.atual>=m.alvo) toast('🎉 Meta concluída! Parabéns!','g');
  else toast(`${fmt(val)} adicionado à meta!`,'g');
}

// ══════════════════════════════════════════════════
//  CONFIGURAÇÕES
// ══════════════════════════════════════════════════
function renderConfiguracoes(){
  document.getElementById('page-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- Backup & Dados -->
      <div class="admin-section">
        <div class="admin-section-hdr"><span class="ic">💾</span><div><h3>Backup & Dados</h3><p>Exporte e restaure seus dados</p></div></div>
        <div class="admin-section-body" style="padding:0">
          <div class="srow">
            <div class="srow-info"><div class="stitle">Exportar backup</div><div class="sdesc">Salva todos os dados em arquivo JSON</div></div>
            <button class="btn btn-s btn-sm" onclick="exportarBackup()">⬇ Exportar</button>
          </div>
          <div class="srow">
            <div class="srow-info"><div class="stitle">Importar backup</div><div class="sdesc">Restaura a partir de arquivo JSON</div></div>
            <button class="btn btn-s btn-sm" onclick="document.getElementById('import-file').click()">⬆ Importar</button>
            <input type="file" id="import-file" accept=".json" style="display:none" onchange="importarBackup(event)">
          </div>
          <div class="srow">
            <div class="srow-info"><div class="stitle">Exportar CSV</div><div class="sdesc">Contas a pagar em planilha</div></div>
            <button class="btn btn-s btn-sm" onclick="exportarCSVGeral()">📊 CSV</button>
          </div>
        </div>
      </div>

      <!-- Perfil -->
      <div class="admin-section">
        <div class="admin-section-hdr"><span class="ic">👤</span><div><h3>Perfil</h3><p>Informações de exibição</p></div></div>
        <div class="admin-section-body">
          <div class="fg" style="margin-bottom:14px"><label>Nome de exibição</label><input id="cfg-nome" value="${(S.user||'demo').split('@')[0]}" placeholder="Seu nome"></div>
          <button class="btn btn-p btn-sm" onclick="salvarPerfil()">Salvar nome</button>
        </div>
      </div>
    </div>

    <!-- Segurança -->
    <div class="admin-section" style="margin-bottom:16px">
      <div class="admin-section-hdr"><span class="ic">🔐</span><div><h3>Segurança</h3><p>Desbloqueio biométrico</p></div></div>
      <div class="admin-section-body" style="padding:0" id="bio-cfg-body">
        ${isBiometricEnabled()
          ? `<div class="srow"><div class="srow-info"><div class="stitle">Digital ativada ✅</div><div class="sdesc">O app pede sua digital ao abrir</div></div><button class="btn btn-d btn-sm" onclick="disableBiometric()">Desativar</button></div>`
          : `<div class="srow"><div class="srow-info"><div class="stitle">Desbloqueio por digital</div><div class="sdesc">Ative para não precisar digitar senha</div></div><button class="btn btn-p btn-sm" id="btn-ativar-bio" onclick="ativarBiometricCfg()">Ativar</button></div>`
        }
      </div>
    </div>

    <!-- Zona de risco -->
    <div class="admin-section" style="border-color:var(--redB)">
      <div class="admin-section-hdr" style="background:var(--redD)">
        <span class="ic">⚠️</span><div><h3 style="color:var(--red)">Zona de Risco</h3><p>Ações irreversíveis</p></div>
      </div>
      <div class="admin-section-body" style="padding:0">
        <div class="srow">
          <div class="srow-info"><div class="stitle">Resetar dados de demonstração</div><div class="sdesc">Volta os dados para o estado inicial do demo</div></div>
          <button class="btn btn-d btn-sm" onclick="resetarDadosDemo()">🔄 Resetar demo</button>
        </div>
        <div class="srow">
          <div class="srow-info"><div class="stitle" style="color:var(--red)">Apagar todos os dados</div><div class="sdesc">Remove permanentemente tudo do sistema</div></div>
          <button class="btn btn-d btn-sm" onclick="apagarTudo()">🗑 Apagar tudo</button>
        </div>
      </div>
    </div>

    <!-- Sobre -->
    <div class="admin-section">
      <div class="admin-section-hdr"><span class="ic">ℹ️</span><div><h3>Sobre</h3></div></div>
      <div class="admin-section-body" style="font-size:.82rem;color:var(--t2);line-height:1.7">
        <p><strong style="color:var(--t1)">FinançasPro</strong> — Sistema de gestão financeira pessoal.</p>
        <p>Todos os dados ficam <strong style="color:var(--t1)">armazenados localmente</strong> no seu navegador (localStorage). Faça backups regulares.</p>
        <p style="margin-top:8px;font-size:.72rem;color:var(--t3)">No sistema real, os dados estarão no Supabase e sincronizados entre dispositivos.</p>
      </div>
    </div>
  `;
}

function exportarBackup(){
  const json=JSON.stringify(S, null, 2);
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(json);
  a.download=`financaspro_backup_${today()}.json`;
  a.click();
  toast('Backup exportado!','g');
}
function importarBackup(e){
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!confirm2('Importar dados? Isso substituirá os dados atuais.')) return;
      Object.assign(S,data); S.user=null; saveStore();
      toast('Dados importados! Faça login novamente.','g');
      doLogout();
    }catch(err){ toast('Arquivo inválido.','r'); }
  };
  r.readAsText(file);
  e.target.value='';
}
function exportarCSVGeral(){
  const rows=[['Nome','Valor','Vencimento','Categoria','Status']];
  S.contas.forEach(c=>rows.push([c.nome,c.valor,c.data,c.cat||'',c.status]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURI(csv);
  a.download=`contas_${today()}.csv`; a.click();
  toast('CSV exportado!','g');
}
function salvarPerfil(){
  const nome=document.getElementById('cfg-nome').value.trim();
  if(nome){ document.getElementById('user-label').textContent=nome; toast('Nome salvo!','g'); }
}
function resetarDadosDemo(){
  if(!confirm2('Resetar todos os dados para o estado inicial do demo?')) return;
  localStorage.removeItem(STORE_KEY);
  loadStore(); toast('Dados resetados!','b'); go('overview');
}
function apagarTudo(){
  if(!confirm2('⚠ ATENÇÃO: apagar TODOS os dados permanentemente. Tem certeza?')) return;
  if(!confirm2('Última confirmação: isso não pode ser desfeito!')) return;
  localStorage.removeItem(STORE_KEY);
  loadStore(); toast('Dados apagados.','b'); go('overview');
}

// ══════════════════════════════════════════════════
//  BIOMETRIC AUTH (WebAuthn)
// ══════════════════════════════════════════════════
async function isBiometricAvailable() {
  return !!(window.PublicKeyCredential &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>false));
}

function isBiometricEnabled() {
  return localStorage.getItem('bio_enabled')==='1' && !!localStorage.getItem('bio_cred_id');
}

async function enableBiometric(email) {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Minha Conta Minha Dívida', id: location.hostname },
        user: { id: new TextEncoder().encode(email), name: email, displayName: email.split('@')[0] },
        pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
        timeout: 60000
      }
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem('bio_cred_id', credId);
    localStorage.setItem('bio_email', email);
    localStorage.setItem('bio_enabled', '1');
    return true;
  } catch(e) { return false; }
}

async function verifyBiometric() {
  const credIdStr = localStorage.getItem('bio_cred_id');
  if (!credIdStr) return false;
  try {
    const credId = Uint8Array.from(atob(credIdStr), c=>c.charCodeAt(0));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type:'public-key', id:credId }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;
  } catch(e) { return false; }
}

function showLoginForm() {
  document.getElementById('bio-lock-screen').style.display = 'none';
  document.getElementById('auth-login-form').style.display = 'block';
}

async function doBiometricUnlock() {
  const btn = document.getElementById('btn-bio-unlock');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Verificando...'; }
  try {
    const passed = await verifyBiometric();
    if (!passed) throw new Error('cancelada');
    const { data:{ user } } = await sb.auth.getUser();
    if (!user) throw new Error('expired');
    await loadStore();
    document.getElementById('auth').classList.remove('show');
    document.getElementById('app-shell').classList.add('show');
    document.getElementById('user-label').textContent = user.email.split('@')[0];
    const adminBtn = document.getElementById('btn-admin-nav');
    if (adminBtn) adminBtn.style.display = isAdmin(user.email) ? '' : 'none';
    applyUserTheme();
    buildSidebar('overview');
    go('overview');
    setTimeout(updateSaldoBar, 100);
    toast('Desbloqueado 🔓', 'g');
    subscribeRealtime(() => {
      applyUserTheme();
      buildSidebar(currentPage||'overview');
      const renders={overview:renderOverview,contas:renderContas,fixas:renderFixas,cartoes:renderCartoes,emprestimos:renderEmp,vr:renderVR,receitas:renderReceitas,admin:renderAdmin,orcamento:renderOrcamento,metas:renderMetas,configuracoes:renderConfiguracoes};
      if(renders[currentPage]) renders[currentPage]();
      updateSaldoBar();
    });
  } catch(e) {
    if (btn) { btn.disabled=false; btn.textContent='👆 Desbloquear com digital'; }
    if (e.message==='expired') {
      showLoginForm();
      toast('Sessão expirada. Faça login com sua senha.', 'r');
    } else {
      toast('Biometria cancelada. Tente de novo ou use a senha.', 'r');
    }
  }
}

// ══════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════
let darkMode=true;
function toggleTheme(){
  darkMode=!darkMode;
  document.documentElement.setAttribute('data-theme',darkMode?'dark':'light');
  document.getElementById('theme-btn').textContent=darkMode?'☀':'🌙';
  localStorage.setItem('fp_theme',darkMode?'dark':'light');
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
const savedTheme=localStorage.getItem('fp_theme')||'dark';
darkMode=savedTheme==='dark';
document.documentElement.setAttribute('data-theme',savedTheme);
document.getElementById('theme-btn').textContent=darkMode?'☀':'🌙';

(async function init(){
  const user = await checkAuth();
  if(user) {
    if (isBiometricEnabled()) {
      // Mostra tela de bloqueio com digital
      S = { ...STATE_TEMPLATE };
      document.getElementById('bio-lock-screen').style.display = 'block';
      document.getElementById('auth-login-form').style.display = 'none';
      const nameEl = document.getElementById('bio-lock-name');
      if (nameEl) nameEl.textContent = user.email.split('@')[0];
      document.getElementById('auth').classList.add('show');
      setTimeout(() => doBiometricUnlock(), 600);
    } else {
      await loadStore();
      document.getElementById('app-shell').classList.add('show');
      document.getElementById('user-label').textContent=user.email.split('@')[0];
      const adminBtn=document.getElementById('btn-admin-nav');
      if(adminBtn) adminBtn.style.display=isAdmin(user.email)?'':'none';
      applyUserTheme();
      buildSidebar('overview');
      go('overview');
      setTimeout(updateSaldoBar,100);
      subscribeRealtime(() => {
        applyUserTheme();
        buildSidebar(currentPage||'overview');
        const renders={overview:renderOverview,contas:renderContas,fixas:renderFixas,cartoes:renderCartoes,emprestimos:renderEmp,vr:renderVR,receitas:renderReceitas,admin:renderAdmin,orcamento:renderOrcamento,metas:renderMetas,configuracoes:renderConfiguracoes};
        if(renders[currentPage]) renders[currentPage]();
        updateSaldoBar();
      });
    }
  } else {
    S = { ...STATE_TEMPLATE };
    document.getElementById('auth').classList.add('show');
  }
})();
