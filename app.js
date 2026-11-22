// TibiaControle — app em JavaScript puro + Supabase
const SUPABASE_URL = 'https://shqwskfijvfndaocaqdv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2HU-RRrIjueYdw5mXbxdhQ_DFa0zFES';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TAXA = 0.025, TAXA_MIN = 20, TAXA_MAX = 2500000, LIMITE_GRATIS = 20;
const RASHID = ['Svargrond', 'Liberty Bay', 'Port Hope', 'Ankrahmun', 'Darashia', 'Edron', 'Carlin']; // seg..dom

const S = { user: null, perfil: null, itens: [], hunts: [], loot: new Map(), compras: [], gastos: [], historico: [], filtroNpc: 'Todos' };

// ---------- utilitários ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'));
const fmtC = (n) => { const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'kk'; if (a >= 1e3) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'; return fmt(n); };
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtData = (iso) => iso ? iso.split('-').reverse().join('/') : '';

// "150k" "1.5kk" "1,5kk" "150.000" "150000" -> número
function gold(v) {
  if (v == null) return null;
  let s = String(v).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  let mult = 1;
  if (s.endsWith('kk')) { mult = 1e6; s = s.slice(0, -2); } else if (s.endsWith('k')) { mult = 1e3; s = s.slice(0, -1); }
  if (mult > 1) s = s.replace(',', '.'); else s = s.replace(/[.,]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * mult);
}
function minutos(v) { // "2:30" ou "2" (horas) -> minutos
  if (!v) return null; const s = String(v).trim();
  if (s.includes(':')) { const [h, m] = s.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); }
  const h = parseFloat(s.replace(',', '.')); return isNaN(h) ? null : Math.round(h * 60);
}
const fmtDur = (m) => m == null ? '—' : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const taxa = (total) => Math.min(Math.max(Math.floor(total * TAXA), TAXA_MIN), TAXA_MAX);
const premium = () => S.perfil?.plano === 'premium' && (!S.perfil.premium_ate || new Date(S.perfil.premium_ate) > new Date());
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3500); }
function erro(e) { console.error(e); toast(e?.message || 'Algo deu errado. Tente de novo.'); }
function melhorPreco(nome) {
  const n = nome.trim().toLowerCase(); let best = null;
  for (const it of S.itens) if (it.item.toLowerCase() === n && (!best || it.preco > best.preco)) best = it;
  return best;
}
// ---------- TibiaData (dados públicos do Tibia.com) ----------
const TIBIADATA = 'https://api.tibiadata.com/v4';
async function tdFetch(path, ms = 8000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(TIBIADATA + path, { signal: ctl.signal }); if (!r.ok) throw new Error('TibiaData ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
// retorna {name, level, vocation, world}, null se não existe, ou lança erro se a API estiver fora
async function buscarPersonagem(nome) {
  const j = await tdFetch('/character/' + encodeURIComponent(nome.trim()));
  const c = j?.character?.character;
  if (!c?.name) return null;
  return { name: c.name, level: c.level, vocation: c.vocation, world: c.world };
}
async function hojeNoTibia() {
  try { const c = JSON.parse(sessionStorage.getItem('tc_hoje2') || 'null'); if (c && c.dia === hojeISO()) return c; } catch {}
  const [cr, bo] = await Promise.allSettled([tdFetch('/creatures'), tdFetch('/boostablebosses')]);
  const bc = cr.value?.creatures?.boosted, bb = bo.value?.boostable_bosses?.boosted;
  const d = { dia: hojeISO(), criatura: bc?.name || null, criaturaImg: bc?.image_url || null, boss: bb?.name || null, bossImg: bb?.image_url || null };
  if (d.criatura || d.boss) try { sessionStorage.setItem('tc_hoje2', JSON.stringify(d)); } catch {}
  return d;
}

function rashidHoje() { const d = new Date(Date.now() - 6 * 3600e3); return RASHID[(d.getDay() + 6) % 7]; } // muda no server save (~6h)

// ---------- autenticação ----------
let modoAuth = 'entrar';
$$('.tab-auth').forEach((b) => b.onclick = () => {
  modoAuth = b.dataset.modo;
  $$('.tab-auth').forEach((x) => x.classList.toggle('ativo', x === b));
  $$('.so-cadastro').forEach((el) => el.classList.toggle('hidden', modoAuth !== 'cadastrar'));
  $('#btn-auth').textContent = modoAuth === 'entrar' ? 'Entrar' : 'Criar conta';
  $('#msg-auth').textContent = '';
});
let charCadastro = null; // resultado da busca no Tibia.com
async function checarPersonagem() {
  const inp = $('#form-auth [name=personagem]'), st = $('#status-char'), nome = inp.value.trim();
  charCadastro = null; st.className = 'status-char';
  if (!nome) { st.textContent = ''; return; }
  st.textContent = 'Buscando no Tibia.com...';
  try {
    const c = await buscarPersonagem(nome);
    if (inp.value.trim() !== nome) return;
    if (!c) { st.textContent = 'Personagem não encontrado no Tibia.com. Confira o nome.'; st.classList.add('erro'); return; }
    charCadastro = c; inp.value = c.name;
    st.textContent = `✔ ${c.name} · ${c.vocation} level ${c.level} · ${c.world}`; st.classList.add('ok');
  } catch { st.textContent = 'Não deu para consultar o Tibia.com agora. Você pode continuar; tentamos de novo depois.'; }
}
$('#form-auth [name=personagem]').addEventListener('change', checarPersonagem);

$('#form-auth').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), email = f.get('email'), password = f.get('senha'), msg = $('#msg-auth');
  msg.textContent = 'Aguarde...';
  if (modoAuth === 'entrar') {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    msg.textContent = error ? 'E-mail ou senha incorretos (ou e-mail ainda não confirmado).' : '';
  } else {
    const primeiro = (f.get('primeiro_nome') || '').trim(), pers = (f.get('personagem') || '').trim();
    if (!primeiro || !pers) return (msg.textContent = 'Preencha seu primeiro nome e o nome do personagem.');
    if (password.length < 8) return (msg.textContent = 'A senha precisa ter pelo menos 8 caracteres.');
    const low = password.toLowerCase();
    if ([primeiro, pers, ...pers.split(/\s+/)].some((p) => p.length >= 3 && low.includes(p.toLowerCase())))
      return (msg.textContent = 'Por segurança, não use seu nome nem o nome do personagem na senha.');
    if (!f.get('termos')) return (msg.textContent = 'Para criar a conta, aceite a Política de Privacidade.');
    if (!charCadastro || charCadastro.name.toLowerCase() !== pers.toLowerCase()) await checarPersonagem();
    const c = charCadastro;
    const meta = { primeiro_nome: primeiro, personagem: c?.name || pers, aceitou_termos: 'true' };
    if (c) Object.assign(meta, { level: String(c.level), vocacao: c.vocation, mundo: c.world });
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin } });
    if (error) msg.textContent = error.message;
    else msg.textContent = data.session ? '' : 'Conta criada! Confirme pelo link que enviamos para o seu e-mail.';
  }
};
$('#btn-esqueci').onclick = async () => {
  const email = $('#form-auth [name=email]').value;
  if (!email) return ($('#msg-auth').textContent = 'Digite seu e-mail acima primeiro.');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  $('#msg-auth').textContent = error ? error.message : 'Enviamos um link para redefinir sua senha.';
};
$('#btn-sair').onclick = () => sb.auth.signOut();

// (setTimeout evita travar o cliente ao chamar o Supabase dentro do evento de login)
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') setTimeout(async () => {
    const nova = prompt('Digite a nova senha (mínimo 6 caracteres):');
    if (nova) { const { error } = await sb.auth.updateUser({ password: nova }); toast(error ? error.message : 'Senha alterada!'); }
  }, 0);
  if (session?.user && S.user?.id !== session.user.id) { S.user = session.user; setTimeout(iniciar, 0); }
  if (!session) { S.user = null; $('#tela-app').classList.add('hidden'); $('#tela-auth').classList.remove('hidden'); }
});

// ---------- carga de dados ----------
async function iniciar() {
  $('#tela-auth').classList.add('hidden'); $('#tela-app').classList.remove('hidden');
  try {
    const [p, it, h, l, c] = await Promise.all([
      sb.from('profiles').select('*').eq('id', S.user.id).single(),
      sb.from('npc_itens').select('*').order('item'),
      sb.from('hunts').select('*').order('data', { ascending: false }).order('id', { ascending: false }),
      sb.from('loot_guardado').select('item_id,qtd,preco_market,qtd_market'),
      sb.from('compras_market').select('*').order('id', { ascending: false }),
    ]);
    for (const r of [p, it, h, l, c]) if (r.error) throw r.error;
    S.perfil = p.data; S.itens = it.data; S.hunts = h.data; S.compras = c.data;
    S.loot = new Map(l.data.map((x) => [x.item_id, { qtd: x.qtd || 0, pm: x.preco_market, qm: x.qtd_market }]));
    if (premium()) await carregarPremium();
    $('#lista-itens').innerHTML = [...new Set(S.itens.map((i) => i.item))].map((n) => `<option value="${esc(n)}">`).join('');
    $$('form [type=date]').forEach((i) => (i.value = hojeISO()));
    renderTudo();
    atualizarPersonagem(false);
    hojeNoTibia().then(renderHoje).catch(() => renderHoje(null));
  } catch (e) { erro(e); }
}
// busca level/vocação/mundo no Tibia.com e salva se mudou
async function atualizarPersonagem(avisar) {
  const p = S.perfil; if (!p?.personagem) return;
  try {
    const c = await buscarPersonagem(p.personagem);
    if (!c) { if (avisar) toast('Personagem não encontrado no Tibia.com. Confira o nome.'); return; }
    const upd = { personagem: c.name, level: c.level, vocacao: c.vocation, mundo: c.world };
    if (Object.keys(upd).some((k) => upd[k] !== p[k])) {
      const { data, error } = await sb.from('profiles').update(upd).eq('id', S.user.id).select().single();
      if (!error) S.perfil = data;
    }
    renderPersonagem(); renderConta(); if (avisar) toast('Personagem atualizado!');
  } catch { if (avisar) toast('Não deu para consultar o Tibia.com agora. Tente mais tarde.'); }
}
function renderPersonagem() {
  const p = S.perfil, el = $('#card-char');
  if (!p.personagem) { el.innerHTML = `<h2>Seu personagem</h2><p class="muted">Informe seu personagem na página Conta.</p>`; return; }
  el.innerHTML = `<h2>${p.primeiro_nome ? 'Olá, ' + esc(p.primeiro_nome) + '!' : 'Seu personagem'}</h2><div class="char-nome">${esc(p.personagem)}</div>` +
    `<div class="char-info">${[p.vocacao, p.mundo].filter(Boolean).map(esc).join(' · ') || 'level e mundo aparecem quando o Tibia.com responder'}</div>` +
    (p.level ? `<span class="char-lvl">Level ${fmt(p.level)}</span>` : '');
}
const imgSegura = (u) => (typeof u === 'string' && /^https:\/\/static\.tibia\.com\//.test(u) ? u : '');
function renderHoje(d) {
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const tile = (rot, nome, img, extra = '') => `<div class="hoje-tile"><div class="hoje-img">${imgSegura(img) ? `<img src="${esc(imgSegura(img))}" alt="${esc(nome || '')}" loading="lazy">` : '<span class="hoje-vazio">?</span>'}</div><div><div class="hoje-rot">${rot}</div><div class="hoje-nome">${esc(nome || (d ? '—' : 'carregando...'))}</div>${extra}</div></div>`;
  $('#card-hoje').innerHTML = `<h2>Hoje no Tibia</h2><div class="hoje-grid">` +
    tile('Criatura em boost', d?.criatura, d?.criaturaImg, '<small class="muted">mais XP e loot hoje</small>') +
    tile('Boss em boost', d?.boss, d?.bossImg, '<small class="muted">mais chance de loot hoje</small>') +
    `<div class="hoje-tile"><div class="hoje-img hoje-cidade">🏪</div><div><div class="hoje-rot">Rashid está em</div><div class="hoje-nome">${rashidHoje()}</div><small class="muted">${dias[new Date(Date.now() - 6 * 3600e3).getDay()]} · muda no server save</small></div></div></div>`;
}
async function carregarPremium() {
  const [g, hp] = await Promise.all([
    sb.from('gastos_extras').select('*').order('data', { ascending: false }),
    sb.from('historico_precos').select('*').order('data', { ascending: false }),
  ]);
  S.gastos = g.data || []; S.historico = hp.data || [];
}
function renderTudo() { renderPersonagem(); renderHoje(null); renderPainel(); renderHunts(); renderRanking(); renderNpc(); renderMarket(); renderGastos(); renderHistorico(); renderConta(); }

// ---------- navegação ----------
$$('#menu button').forEach((b) => b.onclick = () => {
  $$('#menu button').forEach((x) => x.classList.toggle('ativo', x === b));
  $$('.pag').forEach((p) => p.classList.toggle('hidden', p.id !== 'pag-' + b.dataset.pag));
  window.scrollTo(0, 0);
});

// ---------- painel ----------
function somaDesde(iso) { return S.hunts.filter((h) => h.data >= iso).reduce((a, h) => a + h.profit, 0); }
function renderPainel() {
  const p = S.perfil, hoje = hojeISO();
  const d = new Date(hoje + 'T12:00'); const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const iniSemana = seg.toISOString().slice(0, 10), iniMes = hoje.slice(0, 8) + '01';
  const pHoje = S.hunts.filter((h) => h.data === hoje).reduce((a, h) => a + h.profit, 0);
  const pSem = somaDesde(iniSemana), pMes = somaDesde(iniMes);
  const total = S.hunts.reduce((a, h) => a + h.profit, 0);
  const comDur = S.hunts.filter((h) => h.duracao_min > 0);
  const porHora = comDur.length ? comDur.reduce((a, h) => a + h.profit, 0) / (comDur.reduce((a, h) => a + h.duracao_min, 0) / 60) : null;
  const xp = S.hunts.reduce((a, h) => a + (h.xp || 0), 0);
  const lootNpc = valorLootTotal();
  const gastosMes = S.gastos.filter((g) => g.data >= iniMes).reduce((a, g) => a + g.valor, 0);
  const k = (rot, val, c = '') => `<div class="kpi ${c}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
  $('#kpis').innerHTML =
    k('Saldo no banco', fmt(p.banco) + ' gp', 'ouro') +
    k('Profit de hoje', `<span class="${cls(pHoje)}">${fmt(pHoje)}</span>`) +
    k('Profit do mês', `<span class="${cls(pMes)}">${fmt(pMes)}</span>`) +
    k('Profit total', `<span class="${cls(total)}">${fmt(total)}</span>`) +
    k('Profit por hora', porHora == null ? '—' : fmt(porHora)) +
    k('Hunts registradas', S.hunts.length) +
    k('XP total', fmtC(xp)) +
    k('Loot guardado (NPC)', fmt(lootNpc)) +
    (premium() ? k('Gastos extras no mês', `<span class="neg">${fmt(gastosMes)}</span>`) : '');
  const meta = (rot, atual, alvo) => {
    const pct = alvo > 0 ? Math.min(100, Math.max(0, (atual / alvo) * 100)) : 0;
    const txt = !alvo ? 'defina a meta' : atual >= alvo ? '✅ batida!' : `faltam ${fmt(alvo - atual)}`;
    return `<div class="meta"><div class="topo-meta"><span>${rot}: <b>${fmt(atual)}</b> / ${fmt(alvo)}</span><span class="muted">${txt}</span></div><div class="barra"><div class="${atual >= alvo && alvo ? 'ok' : ''}" style="width:${pct}%"></div></div></div>`;
  };
  $('#metas').innerHTML = meta('Hoje', pHoje, p.meta_diaria) + meta('Semana', pSem, p.meta_semanal) + meta('Mês', pMes, p.meta_mensal);
  const f = $('#form-metas');
  for (const n of ['banco', 'meta_diaria', 'meta_semanal', 'meta_mensal']) if (document.activeElement !== f[n]) f[n].value = p[n] ? fmt(p[n]) : '';
  renderGrafico();
}
$('#form-metas').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target, upd = {};
  for (const n of ['banco', 'meta_diaria', 'meta_semanal', 'meta_mensal']) upd[n] = gold(f[n].value) ?? 0;
  const { data, error } = await sb.from('profiles').update(upd).eq('id', S.user.id).select().single();
  if (error) return erro(error);
  S.perfil = data; renderPainel(); toast('Salvo!');
};
function renderGrafico() {
  const dias = [], hoje = new Date(hojeISO() + 'T12:00');
  for (let i = 29; i >= 0; i--) { const d = new Date(hoje); d.setDate(d.getDate() - i); dias.push(d.toISOString().slice(0, 10)); }
  const por = new Map(dias.map((d) => [d, 0]));
  for (const h of S.hunts) if (por.has(h.data)) por.set(h.data, por.get(h.data) + h.profit);
  const vals = dias.map((d) => por.get(d)), meta = S.perfil.meta_diaria || 0;
  const W = 900, H = 260, L = 60, T = 20, B = 30, max = Math.max(meta, ...vals, 1), min = Math.min(0, ...vals);
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1)), bw = (W - L - 10) / dias.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Profit por dia">`;
  for (let i = 0; i <= 4; i++) { const v = min + ((max - min) * i) / 4; s += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="#2f2a21"/><text x="${L - 6}" y="${y(v) + 4}" fill="#a59a86" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
  vals.forEach((v, i) => {
    const x = L + i * bw + bw * 0.15, top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
    s += `<rect x="${x}" y="${top}" width="${bw * 0.7}" height="${Math.max(h, v ? 1 : 0)}" rx="2" fill="${v < 0 ? '#e0605a' : meta && v >= meta ? '#6cc070' : '#e0b24c'}"><title>${fmtData(dias[i])}: ${fmt(v)} gp</title></rect>`;
    if (i % 5 === 4 || i === 29) s += `<text x="${x + bw * 0.35}" y="${H - 10}" fill="#a59a86" font-size="11" text-anchor="middle">${dias[i].slice(8)}/${dias[i].slice(5, 7)}</text>`;
  });
  if (meta) s += `<line x1="${L}" x2="${W - 10}" y1="${y(meta)}" y2="${y(meta)}" stroke="#6cc070" stroke-width="2"/><text x="${W - 12}" y="${y(meta) - 6}" fill="#6cc070" font-size="12" text-anchor="end">meta ${fmtC(meta)}</text>`;
  $('#grafico').innerHTML = s + '</svg>';
}

// ---------- hunts ----------
function renderHunts() {
  $('#limite-hunts').textContent = premium() ? 'Premium: hunts ilimitadas' : `Plano grátis: ${S.hunts.length}/${LIMITE_GRATIS} hunts`;
  $('#locais').innerHTML = [...new Set(S.hunts.map((h) => h.local))].map((n) => `<option value="${esc(n)}">`).join('');
  const t = $('#tabela-hunts');
  if (!S.hunts.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhuma hunt ainda. Registre a primeira acima.</td></tr>');
  const meta = S.perfil.meta_diaria || 0, porDia = new Map();
  for (const h of S.hunts) porDia.set(h.data, (porDia.get(h.data) || 0) + h.profit);
  t.innerHTML = `<tr><th>Data</th><th>Hunt</th><th class="num">Loot</th><th class="num">Supplies</th><th class="num">Profit</th><th class="num">Duração</th><th class="num">Profit/h</th><th class="num">XP</th><th>Meta do dia</th><th>Obs.</th><th></th></tr>` +
    S.hunts.map((h) => `<tr><td>${fmtData(h.data)}</td><td>${esc(h.local)}</td><td class="num">${fmt(h.loot)}</td><td class="num">${fmt(h.gasto)}</td><td class="num ${cls(h.profit)}"><b>${fmt(h.profit)}</b></td><td class="num">${fmtDur(h.duracao_min)}</td><td class="num">${h.duracao_min ? fmt(h.profit / (h.duracao_min / 60)) : '—'}</td><td class="num">${h.xp ? fmtC(h.xp) : '—'}</td><td>${meta ? (porDia.get(h.data) >= meta ? '✅' : '❌') : ''}</td><td class="muted">${esc(h.obs)}</td><td><button class="del" data-id="${h.id}" title="Apagar">✕</button></td></tr>`).join('');
  $$('.del', t).forEach((b) => b.onclick = async () => {
    if (!confirm('Apagar esta hunt?')) return;
    const { error } = await sb.from('hunts').delete().eq('id', b.dataset.id);
    if (error) return erro(error);
    S.hunts = S.hunts.filter((h) => h.id != b.dataset.id); renderPainel(); renderHunts(); renderRanking();
  });
}
$('#form-hunt').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, local: f.local.value.trim(), loot: gold(f.loot.value), gasto: gold(f.gasto.value), duracao_min: minutos(f.duracao.value), xp: gold(f.xp.value), obs: f.obs.value.trim() || null };
  if (row.loot == null || row.gasto == null) return toast('Confira os valores de loot e supplies.');
  const { data, error } = await sb.from('hunts').insert(row).select().single();
  if (error) return erro(error);
  S.hunts.unshift(data); S.hunts.sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : b.id - a.id));
  f.reset(); f.data.value = hojeISO();
  renderPainel(); renderHunts(); renderRanking(); toast(`Hunt salva: profit de ${fmt(data.profit)} gp`);
};

// ---------- ranking ----------
function bloqueado(txt) { return `<div class="bloqueio">🔒 ${txt}<br><br><button class="btn" onclick="document.querySelector('[data-pag=conta]').click()">Ver o Premium</button></div>`; }
function renderRanking() {
  const el = $('#ranking');
  if (!premium()) return (el.innerHTML = bloqueado('O ranking mostra qual hunt rende mais por vez e por hora. Disponível no Premium.'));
  const g = new Map();
  for (const h of S.hunts) {
    const r = g.get(h.local) || { local: h.local, n: 0, profit: 0, min: 0, pDur: 0, xp: 0 };
    r.n++; r.profit += h.profit; r.xp += h.xp || 0; if (h.duracao_min) { r.min += h.duracao_min; r.pDur += h.profit; } g.set(h.local, r);
  }
  const rs = [...g.values()].sort((a, b) => b.profit / b.n - a.profit / a.n);
  if (!rs.length) return (el.innerHTML = '<div class="bloqueio">Registre hunts para ver o ranking.</div>');
  el.innerHTML = `<div class="tabela-wrap"><table><tr><th>#</th><th>Hunt</th><th class="num">Profit médio</th><th class="num">Profit/h</th><th class="num">Profit total</th><th class="num">Vezes</th><th class="num">XP total</th></tr>` +
    rs.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.local)}</td><td class="num ${cls(r.profit)}"><b>${fmt(r.profit / r.n)}</b></td><td class="num">${r.min ? fmt(r.pDur / (r.min / 60)) : '—'}</td><td class="num">${fmt(r.profit)}</td><td class="num">${r.n}</td><td class="num">${fmtC(r.xp)}</td></tr>`).join('') + '</table></div>';
}

// ---------- NPC / loot guardado + compra no Market ----------
const L = (id) => S.loot.get(id) || { qtd: 0, pm: null, qm: null };
const lucroItem = (it) => { const l = L(it.id); return l.pm != null && l.qm ? (it.preco - l.pm) * l.qm : null; };
function valorLootTotal() { let t = 0; for (const it of S.itens) t += L(it.id).qtd * it.preco; return t; }
function lucroMarketTotal(npc) { let t = 0; for (const it of S.itens) if (!npc || it.npc === npc) t += lucroItem(it) || 0; return t; }
function renderNpc() {
  const npcs = ['Todos', ...new Set(S.itens.map((i) => i.npc)), 'Guardados'];
  $('#chips-npc').innerHTML = npcs.map((n) => `<button class="chip ${n === S.filtroNpc ? 'ativo' : ''}" data-npc="${esc(n)}">${esc(n)}</button>`).join('');
  $$('.chip').forEach((c) => c.onclick = () => { S.filtroNpc = c.dataset.npc; renderNpc(); });
  renderNpcResumo(); tabelaNpc();
}
function tabelaNpc() {
  const q = $('#busca-item').value.trim().toLowerCase();
  const lista = S.itens.filter((i) => (S.filtroNpc === 'Todos' || i.npc === S.filtroNpc || (S.filtroNpc === 'Guardados' && (L(i.id).qtd > 0 || L(i.id).qm > 0))) && (!q || i.item.toLowerCase().includes(q)));
  $('#tabela-npc').innerHTML = `<tr><th>Item</th><th>NPC</th><th class="num">Preço NPC</th><th class="num grupo1">Qtd guardada</th><th class="num grupo1">Total</th><th class="num grupo2">Valor no Market</th><th class="num grupo2">Quantidade</th><th class="num grupo2">Lucro</th></tr>` +
    (lista.length ? lista.map((i) => { const l = L(i.id), lu = lucroItem(i);
      return `<tr data-id="${i.id}"><td>${esc(i.item)}</td><td class="muted">${esc(i.npc)}</td><td class="num">${fmt(i.preco)}</td>` +
        `<td class="num grupo1"><input class="qtd" data-campo="qtd" inputmode="numeric" value="${l.qtd || ''}"></td><td class="num grupo1 c-total"><b>${l.qtd ? fmt(l.qtd * i.preco) : ''}</b></td>` +
        `<td class="num grupo2"><input class="qtd" data-campo="pm" placeholder="ex: 16k" value="${l.pm != null ? fmt(l.pm) : ''}"></td><td class="num grupo2"><input class="qtd" data-campo="qm" inputmode="numeric" value="${l.qm || ''}"></td>` +
        `<td class="num grupo2 c-lucro ${cls(lu)}"><b>${lu == null ? '' : fmt(lu)}</b></td></tr>`; }).join('')
      : `<tr><td colspan="8" class="bloqueio">Nenhum item encontrado${q ? ` para "${esc(q)}"` : ''}.</td></tr>`);
  $$('#tabela-npc input').forEach((inp) => inp.onchange = () => salvarLoot(+inp.closest('tr').dataset.id));
}
$('#busca-item').oninput = tabelaNpc;
async function salvarLoot(id) {
  const tr = $(`#tabela-npc tr[data-id="${id}"]`), v = (c) => $(`[data-campo=${c}]`, tr).value;
  const qtd = Math.max(0, parseInt(String(v('qtd')).replace(/\D/g, '')) || 0), pm = gold(v('pm')), qm = Math.max(0, parseInt(String(v('qm')).replace(/\D/g, '')) || 0) || null;
  const vazio = !qtd && pm == null && !qm;
  const r = vazio ? await sb.from('loot_guardado').delete().eq('item_id', id)
    : await sb.from('loot_guardado').upsert({ user_id: S.user.id, item_id: id, qtd, preco_market: pm, qtd_market: qm });
  if (r.error) return erro(r.error);
  if (vazio) S.loot.delete(id); else S.loot.set(id, { qtd, pm, qm });
  const it = S.itens.find((i) => i.id === id), lu = lucroItem(it);
  $('.c-total', tr).innerHTML = qtd ? `<b>${fmt(qtd * it.preco)}</b>` : '';
  const cl = $('.c-lucro', tr); cl.className = `num grupo2 c-lucro ${cls(lu)}`; cl.innerHTML = lu == null ? '' : `<b>${fmt(lu)}</b>`;
  const pmInp = $('[data-campo=pm]', tr); if (document.activeElement !== pmInp) pmInp.value = pm != null ? fmt(pm) : '';
  renderNpcResumo(); renderPainel();
}
function renderNpcResumo() {
  const tot = new Map(); for (const it of S.itens) tot.set(it.npc, (tot.get(it.npc) || 0) + L(it.id).qtd * it.preco);
  const f = S.filtroNpc, lucro = lucroMarketTotal(['Todos', 'Guardados'].includes(f) ? null : f);
  $('#resumo-npc').innerHTML = [...tot].map(([n, v]) => `<div class="kpi ${n === f ? 'kpi-sel' : ''}"><div class="rot">${esc(n)}</div><div class="val">${fmt(v)}</div></div>`).join('') +
    `<div class="kpi ouro"><div class="rot">Total guardado (todos)</div><div class="val">${fmt(valorLootTotal())}</div></div>` +
    `<div class="kpi"><div class="rot">Lucro total comprando no Market${['Todos', 'Guardados'].includes(f) ? '' : ' · ' + esc(f)}</div><div class="val ${cls(lucro)}">${fmt(lucro)}</div></div>`;
}

// ---------- Market ----------
function calcCompra(c) {
  const sub = c.qtd * c.preco_unit, tx = c.tipo === 'criar' ? taxa(sub) : 0, total = sub + tx, npc = melhorPreco(c.item);
  return { sub, tx, total, unit: total / c.qtd, npc, lucro: npc ? npc.preco * c.qtd - total : null };
}
function previewMarket() {
  const f = $('#form-market'), c = { item: f.item.value, qtd: +f.qtd.value, preco_unit: gold(f.preco.value), tipo: f.tipo.value }, el = $('#preview-market');
  if (!c.item || !c.qtd || c.preco_unit == null) return el.classList.remove('on');
  const r = calcCompra(c); el.classList.add('on');
  el.innerHTML = `Subtotal <b>${fmt(r.sub)}</b> · Taxa <b>${fmt(r.tx)}</b> · Total pago <b>${fmt(r.total)}</b> · Custo por unidade <b>${fmt(r.unit)}</b><br>` +
    (r.npc ? `${esc(r.npc.npc)} paga <b>${fmt(r.npc.preco)}</b> cada → lucro de <b class="${cls(r.lucro)}">${fmt(r.lucro)} gp</b>` : 'Nenhum NPC da lista compra esse item.');
}
['input', 'change'].forEach((ev) => $('#form-market').addEventListener(ev, previewMarket));
$('#form-market').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { item: f.item.value.trim(), qtd: +f.qtd.value, preco_unit: gold(f.preco.value), tipo: f.tipo.value };
  if (row.preco_unit == null) return toast('Confira o preço.');
  const { data, error } = await sb.from('compras_market').insert(row).select().single();
  if (error) return erro(error);
  S.compras.unshift(data); f.reset(); previewMarket(); renderMarket(); toast('Compra salva!');
};
function renderMarket() {
  const t = $('#tabela-market');
  if (!S.compras.length) { $('#total-market').textContent = ''; return (t.innerHTML = '<tr><td class="bloqueio">Nenhuma compra planejada.</td></tr>'); }
  let gasto = 0, lucro = 0;
  t.innerHTML = `<tr><th>Item</th><th class="num">Qtd</th><th class="num">Preço unit.</th><th>Tipo</th><th class="num">Taxa</th><th class="num">Total pago</th><th class="num">Preço NPC</th><th class="num">Lucro</th><th></th></tr>` +
    S.compras.map((c) => { const r = calcCompra(c); gasto += r.total; lucro += r.lucro || 0;
      return `<tr><td>${esc(c.item)}</td><td class="num">${fmt(c.qtd)}</td><td class="num">${fmt(c.preco_unit)}</td><td class="muted">${c.tipo === 'criar' ? 'Criar oferta' : 'Aceitar oferta'}</td><td class="num">${fmt(r.tx)}</td><td class="num">${fmt(r.total)}</td><td class="num">${r.npc ? fmt(r.npc.preco) : '—'}</td><td class="num ${cls(r.lucro)}"><b>${r.lucro == null ? '—' : fmt(r.lucro)}</b></td><td><button class="del" data-id="${c.id}">✕</button></td></tr>`; }).join('');
  $('#total-market').innerHTML = `Total: <b>${fmt(gasto)}</b> · Lucro previsto: <b class="${cls(lucro)}">${fmt(lucro)}</b>`;
  $$('.del', t).forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('compras_market').delete().eq('id', b.dataset.id);
    if (error) return erro(error); S.compras = S.compras.filter((c) => c.id != b.dataset.id); renderMarket();
  });
}

// ---------- Gastos (premium) ----------
function renderGastos() {
  const f = $('#form-gasto'), t = $('#tabela-gastos');
  f.classList.toggle('hidden', !premium());
  if (!premium()) { $('#total-gastos').textContent = ''; return (t.innerHTML = `<tr><td>${bloqueado('Controle de imbuements, blessings, casa e outros gastos. Disponível no Premium.')}</td></tr>`); }
  $('#total-gastos').innerHTML = `Total: <b class="neg">${fmt(S.gastos.reduce((a, g) => a + g.valor, 0))}</b>`;
  if (!S.gastos.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhum gasto lançado.</td></tr>');
  t.innerHTML = `<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="num">Valor</th><th></th></tr>` +
    S.gastos.map((g) => `<tr><td>${fmtData(g.data)}</td><td>${esc(g.categoria)}</td><td class="muted">${esc(g.descricao)}</td><td class="num neg">${fmt(g.valor)}</td><td><button class="del" data-id="${g.id}">✕</button></td></tr>`).join('');
  $$('.del', t).forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('gastos_extras').delete().eq('id', b.dataset.id);
    if (error) return erro(error); S.gastos = S.gastos.filter((g) => g.id != b.dataset.id); renderGastos(); renderPainel();
  });
}
$('#form-gasto').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, categoria: f.categoria.value, descricao: f.descricao.value.trim() || null, valor: gold(f.valor.value) };
  if (row.valor == null) return toast('Confira o valor.');
  const { data, error } = await sb.from('gastos_extras').insert(row).select().single();
  if (error) return erro(error);
  S.gastos.unshift(data); f.reset(); f.data.value = hojeISO(); renderGastos(); renderPainel();
};

// ---------- Histórico de preços (premium) ----------
function renderHistorico() {
  const f = $('#form-historico'), t = $('#tabela-historico');
  f.classList.toggle('hidden', !premium());
  if (!premium()) return (t.innerHTML = `<tr><td>${bloqueado('Anote preços do Market e veja o lucro de revender no NPC. Disponível no Premium.')}</td></tr>`);
  if (!S.historico.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhum preço anotado.</td></tr>');
  t.innerHTML = `<tr><th>Data</th><th>Item</th><th class="num">Preço Market</th><th class="num">Preço NPC</th><th class="num">Lucro/unid.</th><th></th></tr>` +
    S.historico.map((h) => { const n = melhorPreco(h.item), l = n ? n.preco - h.preco : null;
      return `<tr><td>${fmtData(h.data)}</td><td>${esc(h.item)}</td><td class="num">${fmt(h.preco)}</td><td class="num">${n ? fmt(n.preco) : '—'}</td><td class="num ${cls(l)}">${l == null ? '—' : fmt(l)}</td><td><button class="del" data-id="${h.id}">✕</button></td></tr>`; }).join('');
  $$('.del', t).forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('historico_precos').delete().eq('id', b.dataset.id);
    if (error) return erro(error); S.historico = S.historico.filter((x) => x.id != b.dataset.id); renderHistorico();
  });
}
$('#form-historico').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, item: f.item.value.trim(), preco: gold(f.preco.value) };
  if (row.preco == null) return toast('Confira o preço.');
  const { data, error } = await sb.from('historico_precos').insert(row).select().single();
  if (error) return erro(error);
  S.historico.unshift(data); f.reset(); f.data.value = hojeISO(); renderHistorico();
};

// ---------- Conta ----------
function renderConta() {
  const p = S.perfil;
  const fp = $('#form-perfil'); if (document.activeElement?.form !== fp) { fp.primeiro_nome.value = p.primeiro_nome || ''; fp.personagem.value = p.personagem || ''; }
  $('#info-conta').innerHTML = `<p><b>${esc(p.primeiro_nome || p.nome || '')}</b> · ${esc(S.user.email)}</p><p>Plano atual: <span class="selo">${premium() ? 'Premium' : 'Grátis'}</span>${p.premium_ate ? ` <span class="muted">até ${new Date(p.premium_ate).toLocaleDateString('pt-BR')}</span>` : ''}</p>`;
  $('#btn-assinar').classList.toggle('hidden', premium());
}
$('#form-perfil').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const upd = { primeiro_nome: f.primeiro_nome.value.trim() || null, personagem: f.personagem.value.trim() || null };
  if (upd.personagem !== S.perfil.personagem) Object.assign(upd, { level: null, vocacao: null, mundo: null });
  const { data, error } = await sb.from('profiles').update(upd).eq('id', S.user.id).select().single();
  if (error) return erro(error);
  S.perfil = data; renderPersonagem(); renderConta(); toast('Salvo! Buscando no Tibia.com...');
  atualizarPersonagem(true);
};
// LGPD: portabilidade
$('#btn-exportar').onclick = async () => {
  try {
    const tabs = ['profiles', 'hunts', 'loot_guardado', 'compras_market', 'gastos_extras', 'historico_precos'];
    const res = await Promise.all(tabs.map((t) => sb.from(t).select('*')));
    const out = { exportado_em: new Date().toISOString(), email: S.user.email };
    tabs.forEach((t, i) => (out[t] = res[i].data || []));
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `tibiacontrole-meus-dados-${hojeISO()}.json` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (e) { erro(e); }
};
// LGPD: exclusão
$('#btn-excluir').onclick = async () => {
  const r = prompt('Isso apaga sua conta e TODOS os seus dados, sem volta.\nPara confirmar, digite EXCLUIR:');
  if (r?.trim().toUpperCase() !== 'EXCLUIR') return;
  const { error } = await sb.rpc('excluir_minha_conta');
  if (error) return erro(error);
  await sb.auth.signOut(); toast('Sua conta foi excluída.');
};

// modais Quem somos / Privacidade
function abrirModal(qual) {
  $$('#modal article').forEach((a) => a.classList.toggle('hidden', a.id !== 'modal-' + qual));
  $('#modal').classList.remove('hidden'); $('#modal .modal-caixa').scrollTop = 0;
}
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-modal]'); if (l) { e.preventDefault(); abrirModal(l.dataset.modal); }
});
$('#modal-fechar').onclick = () => $('#modal').classList.add('hidden');
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').classList.add('hidden'); });

$('#btn-assinar').onclick = () => toast('O pagamento do Premium chega em breve!');

// mostra a tela de login se não houver sessão
sb.auth.getSession().then(({ data }) => { if (!data.session) $('#tela-auth').classList.remove('hidden'); });
