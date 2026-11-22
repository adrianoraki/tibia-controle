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

// Valores em gold do Tibia: 900,000 / 900.000 / 900k / 1.5kk / 1,5kk / 90cc (crystal) / 50pc (platinum) / 300gp
const MOEDAS = { kk: 1e6, k: 1e3, cc: 1e4, pc: 100, gp: 1, gc: 1 };
function gold(v) {
  if (v == null) return null;
  let s = String(v).trim().toLowerCase().replace(/\s|gold/g, '');
  if (!s) return null;
  const neg = s.startsWith('-'); if (neg) s = s.slice(1);
  let mult = 1; const m = s.match(/(kk|k|cc|pc|gp|gc)$/);
  if (m) { mult = MOEDAS[m[1]]; s = s.slice(0, -m[1].length); }
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');          // 900,000 ou 1.234.567
  else s = s.replace(/[.,](?=.*[.,])/g, '').replace(',', '.');             // 1,5 ou 1.5
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * mult);
  return neg ? -n : n;
}
// 1234567 -> "123 cc · 45 pc · 67 gp"
function moedas(n) {
  n = Math.abs(Math.round(n)); const cc = Math.floor(n / 1e4), pc = Math.floor((n % 1e4) / 100), gp = n % 100;
  return [cc && `${fmt(cc)} cc`, pc && `${pc} pc`, gp && `${gp} gp`].filter(Boolean).join(' · ') || '0 gp';
}
// quantas Tibia Coins o valor compra, pelo preço da TC que o usuário informou
const emTC = (n) => { const pt = (typeof S !== 'undefined' && S.perfil?.preco_tc) || 0; return pt > 0 && n > 0 ? ` · ≈ ${fmt(Math.floor(n / pt))} TC` : ''; };
// dica ao digitar em campos de gold: "= 900.000 gp (90 cc)"
// enquanto digita: 200000 -> 200.000 (não mexe se tiver k/kk/cc/pc/gp ou decimal tipo 1,5)
function pontuar(inp, soInteiro) {
  const v = inp.value;
  if (soInteiro) { const d = v.replace(/\D/g, '').slice(0, 9); const f = d ? (+d).toLocaleString('pt-BR') : ''; if (f !== v) inp.value = f; return; }
  if (!/^-?[\d.,]+$/.test(v)) return;
  const partes = v.replace('-', '').split(/[.,]/);
  if (partes.length > 1 && partes[partes.length - 1].length < 3) return;   // pode ser decimal (1,5kk) ainda sendo digitado
  const d = v.replace(/\D/g, '').slice(0, 13); if (d.length < 4 && partes.length === 1) return;
  const f = (v.startsWith('-') ? '-' : '') + (+d).toLocaleString('pt-BR');
  if (f !== v) inp.value = f;
}
document.addEventListener('focusin', (e) => { if (e.target.matches?.('[data-gold],[data-num]')) e.target.setAttribute('autocomplete', 'off'); });
document.addEventListener('input', (e) => {
  if (e.target.matches?.('[data-num]')) return pontuar(e.target, true);
  const inp = e.target.closest?.('[data-gold]'); if (!inp) return;
  pontuar(inp, false);
  if (inp.hasAttribute('data-sem-dica')) return;
  let h = inp.parentElement.querySelector('.gold-dica');
  if (!h) { h = document.createElement('small'); h.className = 'gold-dica'; inp.after(h); }
  const n = gold(inp.value);
  h.textContent = !inp.value.trim() ? '' : n == null ? 'valor não reconhecido' : `= ${fmt(n)} gp (${moedas(n)})${emTC(n)}`;
  h.classList.toggle('erro', !!inp.value.trim() && n == null);
}, true); // fase de captura: pontua antes das prévias lerem o campo
function minutos(v) { // "2:30" ou "2" (horas) -> minutos
  if (!v) return null; const s = String(v).trim();
  if (s.includes(':')) { const [h, m] = s.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); }
  const h = parseFloat(s.replace(',', '.')); return isNaN(h) ? null : Math.round(h * 60);
}
const inteiro = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? Math.min(+d, 1e6) : null; };
const fmtDur = (m) => m == null ? '—' : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const taxa = (total) => Math.min(Math.max(Math.floor(total * TAXA), TAXA_MIN), TAXA_MAX);
const premium = () => S.perfil?.plano === 'premium' && (!S.perfil.premium_ate || new Date(S.perfil.premium_ate) > new Date());
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3500); }
function erro(e) {
  console.error(e);
  const m = String(e?.message || '');
  if (/perfil_valores|insuficiente/i.test(m)) return toast(/insuficiente/i.test(m) ? m : 'Saldo no banco insuficiente. Atualize o saldo no Painel.');
  toast(m || 'Algo deu errado. Tente de novo.');
}
// o banco muda sozinho nas compras, vendas e gastos: relê o saldo depois de cada uma
async function syncBanco() {
  const { data } = await sb.from('profiles').select('banco').eq('id', S.user.id).single();
  if (data && S.perfil) { S.perfil.banco = data.banco; renderPersonagem(); }
}
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
$('#btn-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };

// (setTimeout evita travar o cliente ao chamar o Supabase dentro do evento de login)
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') setTimeout(async () => {
    const nova = await dialogo({ titulo: 'Criar nova senha', texto: 'Use 8 ou mais caracteres. Não use a senha da sua conta do Tibia.', ok: 'Salvar senha',
      campo: { tipo: 'password', placeholder: 'nova senha' }, validar: (v) => (v.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '') });
    if (nova) { const { error } = await sb.auth.updateUser({ password: nova }); toast(error ? error.message : 'Senha alterada!'); }
  }, 0);
  if (session?.user && S.user?.id !== session.user.id) { S.user = session.user; setTimeout(iniciar, 0); }
  if (!session) { S.user = null; $('#tela-app').classList.add('hidden'); $('#tela-auth').classList.remove('hidden'); }
});

// ---------- carga de dados ----------
// a lista de itens de NPC passa de 1.000 linhas (limite por pedido): busca em partes
async function todosNpcItens() {
  const tudo = [];
  for (let de = 0; de < 20000; de += 1000) {
    const { data, error } = await sb.from('npc_itens').select('id,item,npc,preco,fonte,npcs').order('item').order('id').range(de, de + 999);
    if (error) return { data: null, error };
    tudo.push(...data); if (data.length < 1000) break;
  }
  return { data: tudo, error: null };
}
async function iniciar() {
  $('#tela-auth').classList.add('hidden'); $('#tela-app').classList.remove('hidden');
  try {
    const [p, it, h, l, c] = await Promise.all([
      sb.from('profiles').select('*').eq('id', S.user.id).single(),
      todosNpcItens(),
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
    renderTudo(); carregarVendasNpc();
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
  const p = S.perfil, el = $('#card-char'), hoje = hojeISO();
  const hh = S.hunts.filter((h) => h.data === hoje), xpHoje = hh.reduce((t, h) => t + (h.xp || 0), 0), profitHoje = hh.reduce((t, h) => t + h.profit, 0);
  el.innerHTML = `<div class="pt-saud">${p.primeiro_nome ? 'Olá, ' + esc(p.primeiro_nome) + '!' : 'Seu personagem'}</div>` +
    (p.personagem ? `<div class="char-nome">${esc(p.personagem)}</div><div class="char-info">${[p.vocacao, p.mundo].filter(Boolean).map(esc).join(' · ') || 'level e mundo aparecem quando o Tibia.com responder'}</div>` +
      (p.level ? `<span class="char-lvl">Level ${fmt(p.level)}</span>` : '') : `<p class="muted">Informe seu personagem na página Conta.</p>`) +
    `<div class="pt-mini"><div><span>Profit hoje</span><b class="${cls(profitHoje)}">${fmt(profitHoje)}</b></div><div><span>Hunts hoje</span><b>${hh.length}</b></div></div>` +
    `<div class="pt-banco"><div class="pt-banco-topo"><span>Saldo no banco</span><span><button class="link" type="button" data-banco="historico">histórico</button> · <button class="link" type="button" data-banco="editar">editar</button></span></div>` +
    `<div class="pt-banco-valor">${fmt(p.banco)} <small>gp</small></div><div class="muted pt-banco-moedas">${moedas(p.banco || 0)}${p.preco_tc ? emTC(p.banco || 0) : ' · <button class="link" type="button" data-definir-tc>quanto rende em TC?</button>'}</div>` +
    `<form class="pt-banco-form" id="form-banco"><input name="valor" data-gold placeholder="ex: 500k, 50cc ou 500,000" autocomplete="off">` +
    `<button class="btn mini-btn" data-banco="mais">+ Depositar</button><button class="btn sec mini-btn" type="button" data-banco="menos">− Retirar</button></form></div>`;
}
$('#card-char').addEventListener('click', async (e) => {
  const acao = e.target.closest('[data-banco]')?.dataset.banco; if (!acao) return;
  e.preventDefault();
  if (acao === 'historico') return historicoBanco();
  let novo;
  if (acao === 'editar') {
    const r = await dialogo({ titulo: 'Saldo no banco', texto: 'Digite o saldo atual. Aceita 2.5kk, 250cc ou 2.500.000.', ok: 'Salvar saldo',
      campo: { valor: S.perfil.banco ? fmt(S.perfil.banco) : '', placeholder: 'ex: 2.500.000', gold: true },
      validar: (v) => { const n = gold(v); return n == null || n < 0 ? 'Valor não reconhecido.' : ''; } });
    if (r == null) return; novo = gold(r); if (novo == null || novo < 0) return toast('Valor não reconhecido.');
  } else {
    const v = gold($('#form-banco [name=valor]').value);
    if (v == null || v <= 0) return toast('Digite quanto foi para o banco (ex: 500k).');
    novo = (S.perfil.banco || 0) + (acao === 'mais' ? v : -v);
    if (novo < 0) return toast('O saldo não pode ficar negativo.');
  }
  const { data, error } = await sb.from('profiles').update({ banco: novo }).eq('id', S.user.id).select().single();
  if (error) return erro(error);
  S.perfil = data; renderPersonagem(); renderPainel(); toast(`Saldo no banco: ${fmt(novo)} gp`);
});
const ORIGEM_BANCO = { compra: '🛒', venda_market: '💰', venda_npc: '💰', gasto: '🧾', manual: '✎' };
async function historicoBanco() {
  const box = $('#card-char .pt-banco'); let h = $('.banco-hist', box);
  if (h) return h.remove();
  h = Object.assign(document.createElement('div'), { className: 'banco-hist' }); h.innerHTML = '<span class="muted">Carregando…</span>'; box.appendChild(h);
  const { data, error } = await sb.from('banco_movimentos').select('criado_em,origem,descricao,valor,saldo').order('criado_em', { ascending: false }).limit(12);
  if (error) { h.innerHTML = '<span class="muted">Não deu para carregar o histórico.</span>'; return; }
  h.innerHTML = data.length ? data.map((m) => `<div class="bh-linha"><span class="bh-ico" aria-hidden="true">${ORIGEM_BANCO[m.origem] || '•'}</span><span class="bh-desc">${esc(m.descricao || '')}<small class="muted">${new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span><b class="${cls(m.valor)}">${m.valor > 0 ? '+' : ''}${fmt(m.valor)}</b></div>`).join('')
    : '<span class="muted">Nenhum movimento ainda. Compras, vendas e gastos lançados no site aparecem aqui.</span>';
}
const imgSegura = (u) => (typeof u === 'string' && /^https:\/\/static\.tibia\.com\//.test(u) ? u : '');
function renderHoje(d) {
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const tile = (rot, nome, img, extra = '') => `<div class="hoje-tile"><div class="hoje-img">${imgSegura(img) ? `<img src="${esc(imgSegura(img))}" alt="${esc(nome || '')}" loading="lazy">` : '<span class="hoje-vazio">?</span>'}</div><div><div class="hoje-rot">${rot}</div><div class="hoje-nome">${esc(nome || (d ? '—' : 'carregando...'))}</div>${extra}</div></div>`;
  $('#card-hoje').innerHTML = `<div class="pt-titulo">Hoje no Tibia</div><div class="hoje-grid">` +
    tile('Criatura em boost', d?.criatura, d?.criaturaImg, '<small class="muted">mais XP e loot hoje</small>') +
    tile('Boss em boost', d?.boss, d?.bossImg, '<small class="muted">mais chance de loot hoje</small>') +
    `<div class="hoje-tile"><div class="hoje-img"><img class="img-rashid" src="rashid.png" alt="Rashid" width="34" height="37"></div><div><div class="hoje-rot">Rashid está em</div><div class="hoje-nome">${rashidHoje()}</div><small class="muted">${dias[new Date(Date.now() - 6 * 3600e3).getDay()]} · muda no server save</small></div></div></div>`;
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
  const lootNpc = vendidoNpc(iniMes);
  const gastosMes = S.gastos.filter((g) => g.data >= iniMes).reduce((a, g) => a + g.valor, 0);
  let tradeMes = 0, tradeTotal = 0;
  for (const c of S.compras) { const r = calcCompra(c); tradeTotal += r.realizado; if ((c.created_at || '').slice(0, 10) >= iniMes) tradeMes += r.realizado; }
  const resultadoMes = pMes + tradeMes - gastosMes;
  const k = (rot, val, c = '') => `<div class="kpi ${c}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
  $('#kpis').innerHTML =
    k('Profit de hoje', `<span class="${cls(pHoje)}">${fmt(pHoje)}</span>`) +
    k('Resultado do mês', `<span class="${cls(resultadoMes)}">${fmt(resultadoMes)}</span>`, 'ouro') +
    k('Profit do mês (hunts)', `<span class="${cls(pMes)}">${fmt(pMes)}</span>`) +
    k('Lucro Market → NPC no mês', `<span class="${cls(tradeMes)}">${fmt(tradeMes)}</span>`) +
    k('Profit total', `<span class="${cls(total)}">${fmt(total)}</span>`) +
    k('Profit por hora', porHora == null ? '—' : fmt(porHora)) +
    k('Hunts registradas', S.hunts.length) +
    k('XP total', fmtC(xp)) +
    k('Vendido ao NPC no mês', `<span class="pos">${fmt(lootNpc)}</span>`) +
    (premium() ? k('Gastos extras no mês', `<span class="neg">${fmt(gastosMes)}</span>`) : '');
  const meta = (rot, atual, alvo) => {
    const pct = alvo > 0 ? Math.min(100, Math.max(0, (atual / alvo) * 100)) : 0;
    const txt = !alvo ? 'defina a meta' : atual >= alvo ? '✅ batida!' : `faltam ${fmt(alvo - atual)}`;
    return `<div class="meta"><div class="topo-meta"><span>${rot}: <b>${fmt(atual)}</b> / ${fmt(alvo)}</span><span class="muted">${txt}</span></div><div class="barra"><div class="${atual >= alvo && alvo ? 'ok' : ''}" style="width:${pct}%"></div></div></div>`;
  };
  $('#metas').innerHTML = meta('Hoje', pHoje, p.meta_diaria) + meta('Semana', pSem, p.meta_semanal) + meta('Mês', pMes, p.meta_mensal);
  const f = $('#form-metas');
  for (const n of ['meta_diaria', 'meta_semanal', 'meta_mensal']) if (document.activeElement !== f[n]) f[n].value = p[n] ? fmt(p[n]) : '';
  renderGrafico();
}
$('#form-metas').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target, upd = {};
  for (const n of ['meta_diaria', 'meta_semanal', 'meta_mensal']) upd[n] = gold(f[n].value) ?? 0;
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
  const W = Math.max(520, Math.round($('#grafico').clientWidth || 900)), H = 260, L = 60, T = 20, B = 30, max = Math.max(meta, ...vals, 1), min = Math.min(0, ...vals);
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1)), bw = (W - L - 10) / dias.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Profit por dia">`;
  for (let i = 0; i <= 4; i++) { const v = min + ((max - min) * i) / 4; s += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="${corTema('--grade')}"/><text x="${L - 6}" y="${y(v) + 4}" fill="${corTema('--muted')}" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
  vals.forEach((v, i) => {
    const x = L + i * bw + bw * 0.15, top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
    s += `<rect x="${x}" y="${top}" width="${bw * 0.7}" height="${Math.max(h, v ? 1 : 0)}" rx="2" fill="${v < 0 ? corTema('--verm') : meta && v >= meta ? corTema('--verde') : corTema('--ouro')}"><title>${fmtData(dias[i])}: ${fmt(v)} gp</title></rect>`;
    if (i % 5 === 4 || i === 29) s += `<text x="${x + bw * 0.35}" y="${H - 10}" fill="${corTema('--muted')}" font-size="11" text-anchor="middle">${dias[i].slice(8)}/${dias[i].slice(5, 7)}</text>`;
  });
  if (meta) s += `<line x1="${L}" x2="${W - 10}" y1="${y(meta)}" y2="${y(meta)}" stroke="${corTema('--verde')}" stroke-width="2"/><text x="${W - 12}" y="${y(meta) - 6}" fill="${corTema('--verde')}" font-size="12" text-anchor="end">meta ${fmtC(meta)}</text>`;
  const comHunt = vals.filter((v) => v !== 0);
  if (comHunt.length) { const md = comHunt.reduce((a, v) => a + v, 0) / comHunt.length; s += `<line x1="${L}" x2="${W - 10}" y1="${y(md)}" y2="${y(md)}" stroke="${corTema('--muted')}" stroke-width="1.2" stroke-dasharray="4 4"/><text x="${L + 4}" y="${y(md) - 5}" fill="${corTema('--muted')}" font-size="11">média dos dias com hunt ${fmtC(md)}</text>`; }
  $('#grafico').innerHTML = s + '</svg>';
}

// ---------- hunts ----------
const metaDif = (d) => `<span class="meta-dif ${d >= 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : ''}${fmt(d)}</span>`;
function renderHunts() {
  $('#limite-hunts').textContent = premium() ? 'Premium: hunts ilimitadas' : `Plano grátis: ${S.hunts.length}/${LIMITE_GRATIS} hunts`;
  $('#locais').innerHTML = [...new Set(S.hunts.map((h) => h.local))].map((n) => `<option value="${esc(n)}">`).join('');
  const t = $('#tabela-hunts');
  if (!S.hunts.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhuma hunt ainda. Registre a primeira acima.</td></tr>');
  const meta = S.perfil.meta_diaria || 0, porDia = new Map();
  for (const h of S.hunts) porDia.set(h.data, (porDia.get(h.data) || 0) + h.profit);
  const opH = (v) => Array.from({ length: 13 }, (_, k) => `<option value="${k}" ${k === v ? 'selected' : ''}>${k} h</option>`).join('');
  const opM = (v) => Array.from({ length: 12 }, (_, k) => k * 5).map((m) => `<option value="${m}" ${m === v ? 'selected' : ''}>${String(m).padStart(2, '0')} min</option>`).join('');
  const linha = (h) => {
    if (editandoHunt.has(h.id)) {
      const d = h.duracao_min || 0;
      return `<tr data-id="${h.id}" class="hunt-editando"><td><input type="date" data-h="data" value="${esc(h.data)}" required></td><td><input data-h="local" list="locais" maxlength="80" value="${esc(h.local)}"></td>` +
        `<td class="num"><input class="qtd" data-h="loot" data-gold data-sem-dica value="${fmt(h.loot)}"></td><td class="num"><input class="qtd" data-h="gasto" data-gold data-sem-dica value="${fmt(h.gasto)}"></td>` +
        `<td class="num muted">—</td><td class="num"><span class="dur"><select data-h="dur_h" aria-label="Horas">${opH(Math.floor(d / 60))}</select><select data-h="dur_m" aria-label="Minutos">${opM(d % 60 - (d % 5))}</select></span></td>` +
        `<td class="num muted">—</td><td class="num muted">—</td><td><input data-h="obs" maxlength="200" value="${esc(h.obs || '')}"></td>` +
        `<td class="acao-npc"><div class="acoes-hunt"><button class="btn-ok" type="button" data-hunt-acao="salvar" title="Salvar" aria-label="Salvar hunt"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="del" type="button" data-hunt-acao="cancelar" title="Cancelar edição">↺</button></div></td></tr>`;
    }
    return `<tr data-id="${h.id}"><td>${fmtData(h.data)}</td><td>${esc(h.local)}</td><td class="num">${fmt(h.loot)}</td><td class="num">${fmt(h.gasto)}</td><td class="num ${cls(h.profit)}"><b>${fmt(h.profit)}</b></td><td class="num">${fmtDur(h.duracao_min)}</td><td class="num">${h.duracao_min ? fmt(h.profit / (h.duracao_min / 60)) : '—'}</td>` +
      `<td class="num">${meta ? metaDif(porDia.get(h.data) - meta) : '<span class="muted">defina</span>'}</td><td class="muted">${esc(h.obs)}</td>` +
      `<td class="acao-npc"><div class="acoes-hunt"><button class="btn-editar" type="button" data-hunt-acao="editar" title="Editar" aria-label="Editar hunt de ${esc(fmtData(h.data))}">✎ Editar</button><button class="del" type="button" data-hunt-acao="apagar" title="Apagar">✕</button></div></td></tr>`;
  };
  t.innerHTML = `<tr><th>Data</th><th>Hunt</th><th class="num">Loot</th><th class="num">Supplies</th><th class="num">Profit</th><th class="num">Duração</th><th class="num">Profit/h</th><th class="num" title="Profit do dia menos a meta diária">Meta do dia</th><th>Obs.</th><th></th></tr>` +
    S.hunts.map(linha).join('');
}
// histórico de hunts: editar na própria linha, salvar com ✓, apagar com ✕
const editandoHunt = new Set();
$('#tabela-hunts').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-hunt-acao]'); if (!b) return;
  const tr = b.closest('tr'), id = +tr.dataset.id, acao = b.dataset.huntAcao;
  if (acao === 'editar') { editandoHunt.add(id); renderHunts(); $(`#tabela-hunts tr[data-id="${id}"] [data-h=loot]`)?.focus(); return; }
  if (acao === 'cancelar') { editandoHunt.delete(id); renderHunts(); return; }
  if (acao === 'apagar') {
    if (!await confirmar('Apagar esta hunt?', 'Ela sai do histórico, das metas e do ranking.', { tipo: 'perigo', ok: 'Apagar' })) return;
    const { error } = await sb.from('hunts').delete().eq('id', id);
    if (error) return erro(error);
    S.hunts = S.hunts.filter((h) => h.id !== id); renderPainel(); renderHunts(); renderRanking(); return;
  }
  if (acao === 'salvar') {
    const v = (c) => $(`[data-h=${c}]`, tr).value;
    const row = { data: v('data'), local: v('local').trim().slice(0, 80), loot: gold(v('loot')), gasto: gold(v('gasto')), duracao_min: (+v('dur_h') * 60 + +v('dur_m')) || null, obs: v('obs').trim().slice(0, 200) || null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data)) return toast('Confira a data.');
    if (!row.local) return toast('Digite o nome da hunt.');
    if (row.loot == null || row.gasto == null || row.loot < 0 || row.gasto < 0) return toast('Confira os valores de loot e supplies.');
    b.disabled = true;
    const { data, error } = await sb.from('hunts').update(row).eq('id', id).select().single();
    if (error) { b.disabled = false; return erro(error); }
    Object.assign(S.hunts.find((h) => h.id === id), data);
    S.hunts.sort((a, c) => (c.data > a.data ? 1 : c.data < a.data ? -1 : c.id - a.id));
    editandoHunt.delete(id); renderPainel(); renderPersonagem(); renderHunts(); renderRanking();
    toast(`Hunt atualizada: profit de ${fmt(data.profit)} gp`);
  }
});
$('#tabela-hunts').addEventListener('keydown', (e) => {
  const tr = e.target.closest('tr.hunt-editando'); if (!tr) return;
  if (e.key === 'Enter') { e.preventDefault(); $('[data-hunt-acao=salvar]', tr).click(); }
  if (e.key === 'Escape') { e.preventDefault(); $('[data-hunt-acao=cancelar]', tr).click(); }
});
$('#form-hunt').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, local: f.local.value.trim(), loot: gold(f.loot.value), gasto: gold(f.gasto.value), duracao_min: (+f.dur_h.value * 60 + +f.dur_m.value) || null, xp: gold(f.xp.value), obs: f.obs.value.trim() || null };
  if (row.loot == null || row.gasto == null) return toast('Confira os valores de loot e supplies.');
  const { data, error } = await sb.from('hunts').insert(row).select().single();
  if (error) return erro(error);
  S.hunts.unshift(data); S.hunts.sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : b.id - a.id));
  f.reset(); f.data.value = hojeISO(); $$('.gold-dica', f).forEach((h) => (h.textContent = ''));
  renderPainel(); renderPersonagem(); renderHunts(); renderRanking(); toast(`Hunt salva: profit de ${fmt(data.profit)} gp`);
};

// ---------- ranking ----------
function bloqueado(txt) { return `<div class="bloqueio">🔒 ${txt}<br><br><button class="btn" type="button" data-ir="conta">Ver o VIP</button></div>`; }
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

// ---------- Vender no NPC: digita a quantidade, vê o lucro e confirma (o valor entra no banco) ----------
const L = (id) => S.loot.get(id) || { qtd: 0, pm: null, qm: null };
const qtdNpc = new Map();                                  // quantidade digitada em cada linha (ainda não vendida)
S.vendasNpc = [];
async function carregarVendasNpc() {
  const ini = hojeISO().slice(0, 8) + '01';
  const { data } = await sb.from('banco_movimentos').select('criado_em,descricao,valor').eq('origem', 'venda_npc').gte('criado_em', ini).order('criado_em', { ascending: false }).limit(500);
  S.vendasNpc = data || []; renderNpcResumo(); renderPainel();
}
const vendidoNpc = (desde) => (S.vendasNpc || []).filter((v) => v.criado_em.slice(0, 10) >= desde).reduce((t, v) => t + v.valor, 0);
const grupoNpc = (i) => (i.fonte === 'wiki' ? 'Outros NPCs' : i.npc);
const MAX_LINHAS_NPC = 150;
function renderNpc() {
  const npcs = ['Todos', ...new Set(S.itens.filter((i) => i.fonte !== 'wiki').map((i) => i.npc)), ...(S.itens.some((i) => i.fonte === 'wiki') ? ['Outros NPCs'] : [])];
  if (!npcs.includes(S.filtroNpc)) S.filtroNpc = 'Todos';
  $('#chips-npc').innerHTML = npcs.map((n) => `<button class="chip ${n === S.filtroNpc ? 'ativo' : ''}" data-npc="${esc(n)}">${esc(n)}</button>`).join('');
  $$('#chips-npc .chip').forEach((c) => c.onclick = () => { S.filtroNpc = c.dataset.npc; renderNpc(); });
  renderNpcResumo(); tabelaNpc();
}
function linhaNpc(i) {
  const q = qtdNpc.get(i.id) || 0;
  const outros = String(i.npcs || '').split(',').map((x) => x.trim()).filter((x) => x && x !== i.npc);
  return `<tr data-id="${i.id}"><td>${esc(i.item)}</td><td class="muted">${esc(i.npc)}${outros.length ? ` <small class="npc-mais" title="Também compram: ${esc(outros.join(', '))}">+${outros.length}</small>` : ''}</td><td class="num">${fmt(i.preco)}</td>` +
    `<td class="num"><input class="qtd" data-campo="vender" data-num inputmode="numeric" placeholder="0" value="${q ? fmt(q) : ''}" aria-label="Quantidade de ${esc(i.item)}"></td>` +
    `<td class="num lucro-npc ${q ? 'pos' : 'muted'}"><b>${q ? fmt(q * i.preco) : '—'}</b></td>` +
    `<td class="acao-npc"><button class="btn-ok btn-ok-txt" type="button" data-npc-acao="vender" ${q ? '' : 'disabled'} title="Vendi: o valor entra no banco">💰 Vendi</button></td></tr>`;
}
function tabelaNpc() {
  const q = $('#busca-item').value.trim().toLowerCase();
  const lista = S.itens.filter((i) => (S.filtroNpc === 'Todos' || grupoNpc(i) === S.filtroNpc) && (!q || i.item.toLowerCase().includes(q)));
  // itens já digitados ficam sempre na tela; o resto é cortado para a página não pesar
  const vis = lista.length > MAX_LINHAS_NPC ? [...lista.filter((i) => qtdNpc.get(i.id)), ...lista.filter((i) => !qtdNpc.get(i.id)).slice(0, MAX_LINHAS_NPC)] : lista;
  $('#tabela-npc').innerHTML = `<tr><th>Item</th><th>NPC</th><th class="num">Preço NPC</th><th class="num">Quantidade</th><th class="num">Lucro</th><th></th></tr>` +
    (vis.length ? vis.map(linhaNpc).join('') : `<tr><td colspan="6" class="bloqueio">Nenhum item encontrado${q ? ` para "${esc(q)}"` : ''}.</td></tr>`) +
    (lista.length > vis.length ? `<tr><td colspan="6" class="muted npc-corte">Mostrando ${vis.length} de ${fmt(lista.length)} itens. Digite o nome do item na busca para achar os outros.</td></tr>` : '');
}
$('#busca-item').oninput = tabelaNpc;
// lucro aparece enquanto digita
$('#tabela-npc').addEventListener('input', (e) => {
  if (!e.target.matches('input[data-campo=vender]')) return;
  const tr = e.target.closest('tr'), id = +tr.dataset.id, it = S.itens.find((i) => i.id === id); if (!it) return;
  const q = inteiro(e.target.value) || 0; qtdNpc.set(id, q);
  const td = $('.lucro-npc', tr); td.className = `num lucro-npc ${q ? 'pos' : 'muted'}`; td.innerHTML = `<b>${q ? fmt(q * it.preco) : '—'}</b>`;
  $('[data-npc-acao=vender]', tr).disabled = !q;
});
$('#tabela-npc').addEventListener('click', (e) => { const b = e.target.closest('[data-npc-acao=vender]'); if (b) venderNpc(+b.closest('tr').dataset.id, b); });
$('#tabela-npc').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input[data-campo=vender]')) return;
  e.preventDefault(); const tr = e.target.closest('tr'); venderNpc(+tr.dataset.id, $('[data-npc-acao=vender]', tr));
});
// o servidor confere o preço pela lista do site e põe o valor no banco
async function venderNpc(id, btn) {
  const it = S.itens.find((i) => i.id === id), q = qtdNpc.get(id) || 0; if (!it || !q) return toast('Digite a quantidade que vendeu.');
  if (!await confirmar(`Vendeu ${fmt(q)} ${it.item}?`, `${it.npc} paga ${fmt(it.preco)} gp cada.\nEntra no seu banco: ${fmt(q * it.preco)} gp.`, { ok: '💰 Vendi' })) return;
  if (btn) btn.disabled = true;
  const l = L(id);
  const g = await sb.from('loot_guardado').upsert({ user_id: S.user.id, item_id: id, qtd: (l.qtd || 0) + q, preco_market: l.pm, qtd_market: l.qm });
  if (g.error) { if (btn) btn.disabled = false; return erro(g.error); }
  const { data, error } = await sb.rpc('vender_loot_npc', { p_item: id, p_qtd: q });
  if (error) { if (btn) btn.disabled = false; return erro(error); }
  S.loot.set(id, { ...l, qtd: data.qtd });
  if (data.banco != null) S.perfil.banco = data.banco;
  qtdNpc.delete(id);
  S.vendasNpc.unshift({ criado_em: new Date().toISOString(), descricao: `${q}x ${it.item} (${it.npc})`, valor: data.recebido });
  const tr = $(`#tabela-npc tr[data-id="${id}"]`); if (tr) tr.outerHTML = linhaNpc(it);
  renderNpcResumo(); renderPersonagem(); renderPainel();
  toast(`+${fmt(data.recebido)} gp no banco (${fmt(q)} ${it.item})`);
}
function renderNpcResumo() {
  const hoje = hojeISO(), mes = hoje.slice(0, 8) + '01';
  $('#resumo-npc').innerHTML = kpi('Vendido ao NPC hoje', `<span class="pos">${fmt(vendidoNpc(hoje))}</span>`, 'ouro') +
    kpi('Vendido ao NPC no mês', `<span class="pos">${fmt(vendidoNpc(mes))}</span>`) +
    kpi('Vendas no mês', String((S.vendasNpc || []).length));
}

// ---------- Market ----------
function calcCompra(c) {
  const q = c.qtd_comprada ?? c.qtd;                                  // o que de fato foi comprado (ou o planejado)
  const sub = q * c.preco_unit, tx = c.tipo === 'criar' ? taxa(c.qtd * c.preco_unit) : 0, total = sub + tx, npc = melhorPreco(c.item);
  const unit = q ? total / q : 0, vend = c.qtd_vendida || 0;
  return { q, sub, tx, total, unit, npc, vend,
    lucro: npc ? npc.preco * q - total : null,                           // lucro previsto vendendo tudo no NPC
    realizado: npc && vend ? Math.round(vend * (npc.preco - unit)) : 0 }; // lucro do que já foi vendido
}
function previewMarket() {
  const f = $('#form-market'), c = { item: f.item.value, qtd: inteiro(f.qtd.value), preco_unit: gold(f.preco.value), tipo: f.tipo.value }, el = $('#preview-market');
  if (!c.item || !c.qtd || c.preco_unit == null) return el.classList.remove('on');
  const r = calcCompra(c); el.classList.add('on');
  el.innerHTML = `Subtotal <b>${fmt(r.sub)}</b> · Taxa <b>${fmt(r.tx)}</b> · Total pago <b>${fmt(r.total)}</b> · Custo por unidade <b>${fmt(r.unit)}</b><br>` +
    (r.npc ? `${esc(r.npc.npc)} paga <b>${fmt(r.npc.preco)}</b> cada → lucro de <b class="${cls(r.lucro)}">${fmt(r.lucro)} gp</b>` : 'Nenhum NPC da lista compra esse item.');
}
['input', 'change'].forEach((ev) => $('#form-market').addEventListener(ev, previewMarket));
$('#form-market').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { item: f.item.value.trim(), qtd: inteiro(f.qtd.value), preco_unit: gold(f.preco.value), tipo: f.tipo.value };
  if (!row.qtd) return toast('Confira a quantidade.');
  if (row.preco_unit == null) return toast('Confira o preço.');
  const r = calcCompra(row);
  if (!await confirmar('Lançar esta compra?', `${fmt(row.qtd)} ${row.item} por ${fmt(row.preco_unit)} gp cada.\nSai do seu banco agora: ${fmt(r.total)} gp${r.tx ? ` (com ${fmt(r.tx)} gp de taxa)` : ''}.\nSe a oferta não for aceita, apague a compra e o ouro volta (a taxa não).`, { ok: 'Lançar compra' })) return;
  const { data, error } = await sb.from('compras_market').insert(row).select().single();
  if (error) return erro(error);
  S.compras.unshift(data); f.reset(); previewMarket(); renderMarket(); renderPainel(); syncBanco(); toast(`Compra salva! −${fmt(r.total)} gp no banco`);
};
const kpi = (rot, val, c = '') => `<div class="kpi ${c}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
// cada compra: mostra o que foi salvo (com Editar) ou os campos Comprei/Vendi com o ✓ verde
const editandoCompra = new Set();
const ICONE_OK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function linhaCompra(c) {
  const r = calcCompra(c), ed = editandoCompra.has(c.id);
  const ini = `<tr data-id="${c.id}"${ed ? ' class="npc-editando"' : ''}><td>${esc(c.item)}</td><td class="num">${fmt(c.qtd)}</td>`;
  const meio = `<td class="num">${fmt(c.preco_unit)}</td><td class="muted">${c.tipo === 'criar' ? 'Criar oferta' : 'Aceitar oferta'}</td><td class="num">${fmt(r.tx)}</td><td class="num">${fmt(r.total)}</td><td class="num">${r.npc ? fmt(r.npc.preco) : '—'}</td>`;
  const apagar = `<button class="del" data-id="${c.id}" title="Apagar" aria-label="Apagar compra de ${esc(c.item)}">✕</button>`;
  if (ed) return ini +
    `<td class="num"><input class="qtd" data-campo="comprada" data-num inputmode="numeric" placeholder="${fmt(c.qtd)}" value="${c.qtd_comprada != null ? fmt(c.qtd_comprada) : ''}"></td>` + meio +
    `<td class="num"><input class="qtd" data-campo="vendida" data-num inputmode="numeric" placeholder="0" value="${c.qtd_vendida ? fmt(c.qtd_vendida) : ''}"></td>` +
    `<td class="num muted">—</td><td class="num muted">—</td><td class="acao-npc"><button class="btn-ok" type="button" data-compra-acao="salvar" title="Confirmar e salvar" aria-label="Confirmar compra de ${esc(c.item)}">${ICONE_OK}</button> ${apagar}</td></tr>`;
  const comprou = c.qtd_comprada != null, vendeuTudo = comprou && (c.qtd_vendida || 0) >= c.qtd_comprada && c.qtd_comprada > 0;
  const confirmar = !comprou
    ? `<button class="btn-ok btn-ok-txt" type="button" data-compra-acao="confirmar-compra" title="A oferta foi aceita: recebi os itens pelo preço que coloquei">${ICONE_OK}<span>Comprei</span></button>`
    : !vendeuTudo && r.npc ? `<button class="btn-ok btn-ok-txt" type="button" data-compra-acao="confirmar-venda" title="Vendi tudo o que comprei no NPC">${ICONE_OK}<span>Vendi</span></button>` : '';
  return ini +
    `<td class="num">${comprou ? `<span class="tag-ok">✓ ${fmt(c.qtd_comprada)}</span>` : '<span class="tag-espera" title="Oferta no Market ainda não confirmada">⏳ aguardando</span>'}</td>` + meio +
    `<td class="num">${c.qtd_vendida ? `<span class="${vendeuTudo ? 'tag-ok' : ''}">${vendeuTudo ? '✓ ' : ''}${fmt(c.qtd_vendida)}</span>` : '<span class="muted">0</span>'}</td>` +
    `<td class="num ${cls(r.lucro)}"><b>${r.lucro == null ? '—' : fmt(r.lucro)}</b></td><td class="num ${cls(r.realizado)}">${r.vend ? `<b>${fmt(r.realizado)}</b>` : '<span class="muted">—</span>'}</td>` +
    `<td class="acao-npc">${confirmar} <button class="btn-editar" type="button" data-compra-acao="editar" title="Editar Comprei e Vendi (para compras parciais)" aria-label="Editar compra de ${esc(c.item)}">✎ Editar</button> ${apagar}</td></tr>`;
}
function renderMarketResumo() {
  let tot = 0, tx = 0, lu = 0, re = 0; for (const c of S.compras) { const r = calcCompra(c); tot += r.total; tx += r.tx; lu += r.lucro || 0; re += r.realizado; }
  $('#resumo-market').innerHTML = kpi('Compras', S.compras.length) + kpi('Total pago', fmt(tot)) + kpi('Taxas do Market', fmt(tx)) +
    kpi('Lucro previsto no NPC', `<span class="${cls(lu)}">${fmt(lu)}</span>`) + kpi('Lucro já realizado', `<span class="${cls(re)}">${fmt(re)}</span>`, 'ouro');
  $('#total-market').innerHTML = S.compras.length ? `Total pago: <b>${fmt(tot)}</b> · Lucro previsto: <b class="${cls(lu)}">${fmt(lu)}</b>` : '';
}
function renderMarket() {
  const t = $('#tabela-market');
  renderMarketResumo();
  if (!S.compras.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhuma compra planejada.</td></tr>');
  t.innerHTML = `<tr><th>Item</th><th class="num">Planejado</th><th class="num" title="Quantos você conseguiu comprar">Comprei</th><th class="num">Preço unit.</th><th>Tipo</th><th class="num">Taxa</th><th class="num">Total pago</th><th class="num">Preço NPC</th><th class="num" title="Quantos já vendeu no NPC">Vendi</th><th class="num">Lucro previsto</th><th class="num">Lucro realizado</th><th></th></tr>` +
    S.compras.map(linhaCompra).join('');
}
function trocarLinhaCompra(id) {
  const tr = $(`#tabela-market tr[data-id="${id}"]`), c = S.compras.find((x) => x.id === id); if (tr && c) tr.outerHTML = linhaCompra(c);
}
$('#tabela-market').addEventListener('click', async (e) => {
  const del = e.target.closest('.del');
  if (del) {
    const c = S.compras.find((x) => x.id == del.dataset.id), espera = c && c.no_banco && c.qtd_comprada == null;
    if (!await confirmar('Apagar esta compra?', espera ? `A oferta ainda estava aguardando: ${fmt(c.qtd * c.preco_unit)} gp voltam para o seu banco (a taxa do Market não volta).` : 'Ela sai das compras planejadas e do painel. O banco não muda.', { tipo: 'perigo', ok: 'Apagar' })) return;
    const { error } = await sb.from('compras_market').delete().eq('id', del.dataset.id);
    if (error) return erro(error);
    S.compras = S.compras.filter((x) => x.id != del.dataset.id); editandoCompra.delete(+del.dataset.id); renderMarket(); renderPainel(); syncBanco(); return;
  }
  const b = e.target.closest('[data-compra-acao]'); if (!b) return;
  const id = +b.closest('tr').dataset.id;
  if (b.dataset.compraAcao === 'editar') { editandoCompra.add(id); trocarLinhaCompra(id); $(`#tabela-market tr[data-id="${id}"] input`)?.focus(); }
  else if (b.dataset.compraAcao === 'confirmar-compra' || b.dataset.compraAcao === 'confirmar-venda') confirmarCompraVenda(id, b.dataset.compraAcao === 'confirmar-venda');
  else salvarCompra(id, b);
});
$('#tabela-market').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input[data-campo]')) return;
  e.preventDefault(); salvarCompra(+e.target.closest('tr').dataset.id);
});
// um clique: "recebi todos pelo preço da oferta" ou "vendi tudo no NPC"
async function confirmarCompraVenda(id, venda) {
  const c = S.compras.find((x) => x.id === id); if (!c) return;
  const r = calcCompra({ ...c, qtd_comprada: c.qtd_comprada ?? c.qtd });
  const ok = venda
    ? await confirmar('Vendeu tudo no NPC?', `Confirmar que vendeu ${fmt(c.qtd_comprada)} ${c.item} para ${r.npc.npc} por ${fmt(r.npc.preco)} gp cada?\nEntra no seu banco: ${fmt(c.qtd_comprada * r.npc.preco)} gp · lucro: ${fmt(Math.round(c.qtd_comprada * (r.npc.preco - r.unit)))} gp.`, { ok: '✓ Vendi tudo' })
    : await confirmar('A compra foi concluída?', `Confirmar que recebeu ${fmt(c.qtd)} ${c.item} por ${fmt(c.preco_unit)} gp cada?\nTotal pago: ${fmt(r.total)} gp${r.tx ? ` (com ${fmt(r.tx)} gp de taxa)` : ''}.\nSe recebeu só uma parte, use Editar.`, { ok: '✓ Comprei' });
  if (!ok) return;
  const upd = venda ? { qtd_vendida: c.qtd_comprada } : { qtd_comprada: c.qtd };
  const { data, error } = await sb.from('compras_market').update(upd).eq('id', id).select().single();
  if (error) return erro(error);
  Object.assign(c, data); trocarLinhaCompra(id); renderMarketResumo(); renderPainel(); syncBanco();
  const rr = calcCompra(c);
  toast(venda ? `Venda registrada! Lucro realizado: ${fmt(rr.realizado)} gp` : `Compra confirmada: ${fmt(c.qtd_comprada)} ${c.item}`);
}
async function salvarCompra(id, btn) {
  const tr = $(`#tabela-market tr[data-id="${id}"]`), c = S.compras.find((x) => x.id === id); if (!tr || !c) return;
  const comprada = inteiro($('[data-campo=comprada]', tr).value), vendida = inteiro($('[data-campo=vendida]', tr).value);
  if (vendida && vendida > (comprada ?? c.qtd)) return toast('Você não pode ter vendido mais do que comprou.');
  if (btn) btn.disabled = true;
  const { data, error } = await sb.from('compras_market').update({ qtd_comprada: comprada, qtd_vendida: vendida }).eq('id', id).select().single();
  if (error) { if (btn) btn.disabled = false; return erro(error); }
  Object.assign(c, data); editandoCompra.delete(id); trocarLinhaCompra(id); renderMarketResumo(); renderPainel(); syncBanco();
  const r = calcCompra(c);
  toast(vendida ? `Salvo! Lucro realizado: ${fmt(r.realizado)} gp` : `Salvo! Lucro previsto: ${fmt(r.lucro)} gp`);
}

// ---------- Gastos (premium) ----------
function renderGastos() {
  const f = $('#form-gasto'), t = $('#tabela-gastos');
  f.classList.toggle('hidden', !premium());
  if (!premium()) { $('#total-gastos').textContent = ''; $('#resumo-gastos').innerHTML = ''; return (t.innerHTML = `<tr><td>${bloqueado('Controle de imbuements, blessings, casa e outros gastos. Disponível no Premium.')}</td></tr>`); }
  $('#total-gastos').innerHTML = `Total: <b class="neg">${fmt(S.gastos.reduce((a, g) => a + g.valor, 0))}</b>`;
  { const mes = hojeISO().slice(0, 8) + '01', porCat = new Map(); for (const g of S.gastos) porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + g.valor);
    const top = [...porCat].sort((x, y) => y[1] - x[1])[0];
    $('#resumo-gastos').innerHTML = kpi('Gasto total', `<span class="neg">${fmt(S.gastos.reduce((t, g) => t + g.valor, 0))}</span>`) + kpi('Gasto este mês', `<span class="neg">${fmt(S.gastos.filter((g) => g.data >= mes).reduce((t, g) => t + g.valor, 0))}</span>`) + kpi('Lançamentos', S.gastos.length) + kpi('Maior categoria', top ? `${esc(top[0])}<small class="muted"> ${fmtC(top[1])}</small>` : '—', 'ouro'); }
  if (!S.gastos.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhum gasto lançado.</td></tr>');
  t.innerHTML = `<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="num">Valor</th><th></th></tr>` +
    S.gastos.map((g) => `<tr><td>${fmtData(g.data)}</td><td>${esc(g.categoria)}</td><td class="muted">${esc(g.descricao)}</td><td class="num neg">${fmt(g.valor)}</td><td><button class="del" data-id="${g.id}">✕</button></td></tr>`).join('');
  $$('.del', t).forEach((b) => b.onclick = async () => {
    const g = S.gastos.find((x) => x.id == b.dataset.id);
    if (!await confirmar('Apagar este gasto?', g?.no_banco ? `${fmt(g.valor)} gp voltam para o seu banco.` : 'Ele sai da lista. O banco não muda.', { tipo: 'perigo', ok: 'Apagar' })) return;
    const { error } = await sb.from('gastos_extras').delete().eq('id', b.dataset.id);
    if (error) return erro(error); S.gastos = S.gastos.filter((x) => x.id != b.dataset.id); renderGastos(); renderPainel(); syncBanco();
  });
}
$('#form-gasto').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, categoria: f.categoria.value, descricao: f.descricao.value.trim() || null, valor: gold(f.valor.value) };
  if (row.valor == null) return toast('Confira o valor.');
  const { data, error } = await sb.from('gastos_extras').insert(row).select().single();
  if (error) return erro(error);
  S.gastos.unshift(data); f.reset(); f.data.value = hojeISO(); renderGastos(); renderPainel(); syncBanco(); toast(`Gasto lançado: −${fmt(row.valor)} gp no banco`);
};

// ---------- Histórico de preços (premium) ----------
function renderHistorico() {
  const f = $('#form-historico'), t = $('#tabela-historico');
  f.classList.toggle('hidden', !premium());
  if (!premium()) $('#resumo-historico').innerHTML = '';
  if (!premium()) return (t.innerHTML = `<tr><td>${bloqueado('Anote preços do Market e veja o lucro de revender no NPC. Disponível no Premium.')}</td></tr>`);
  { let comLucro = 0, melhor = null; for (const h of S.historico) { const n = melhorPreco(h.item); if (n && n.preco > h.preco) { comLucro++; if (!melhor || n.preco - h.preco > melhor.l) melhor = { item: h.item, l: n.preco - h.preco }; } }
    $('#resumo-historico').innerHTML = kpi('Preços anotados', S.historico.length) + kpi('Itens diferentes', new Set(S.historico.map((h) => h.item.toLowerCase())).size) + kpi('Com lucro no NPC', comLucro) + kpi('Melhor oportunidade', melhor ? `${esc(melhor.item)}<small class="pos"> +${fmtC(melhor.l)}/un</small>` : '—', 'ouro'); }
  if (!S.historico.length) return (t.innerHTML = '<tr><td class="bloqueio">Nenhum preço anotado.</td></tr>');
  t.innerHTML = `<tr><th>Data</th><th>Item</th><th class="num">Preço Market</th><th class="num">Preço NPC</th><th class="num">Lucro/unid.</th><th></th></tr>` +
    S.historico.map((h) => { const n = melhorPreco(h.item), l = n ? n.preco - h.preco : null;
      return `<tr><td>${fmtData(h.data)}</td><td>${esc(h.item)}</td><td class="num">${fmt(h.preco)}</td><td class="num">${n ? fmt(n.preco) : '—'}</td><td class="num ${cls(l)}">${l == null ? '—' : fmt(l)}</td><td><button class="del" data-id="${h.id}">✕</button></td></tr>`; }).join('');
  $$('.del', t).forEach((b) => b.onclick = async () => {
    if (!await confirmar('Apagar este preço anotado?', '', { tipo: 'perigo', ok: 'Apagar' })) return;
    const { error } = await sb.from('historico_precos').delete().eq('id', b.dataset.id);
    if (error) return erro(error); S.historico = S.historico.filter((x) => x.id != b.dataset.id); renderHistorico();
  });
}
function previewHistorico() {
  const f = $('#form-historico'), el = $('#preview-historico'), npc = f.item.value.trim() ? melhorPreco(f.item.value) : null, p = gold(f.preco.value);
  if (!f.item.value.trim()) return el.classList.remove('on');
  el.classList.add('on');
  el.innerHTML = npc ? `<b>${esc(npc.npc)}</b> paga <b>${fmt(npc.preco)} gp</b> por ${esc(npc.item)}` +
    (p != null ? ` · comprando a ${fmt(p)} no Market: <b class="${cls(npc.preco - p)}">${npc.preco - p > 0 ? '+' : ''}${fmt(npc.preco - p)} gp por unidade</b>` : '')
    : 'Nenhum NPC da lista compra esse item.';
}
['input', 'change'].forEach((ev) => $('#form-historico').addEventListener(ev, previewHistorico));
$('#form-historico').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  const row = { data: f.data.value, item: f.item.value.trim(), preco: gold(f.preco.value) };
  if (row.preco == null) return toast('Confira o preço.');
  const { data, error } = await sb.from('historico_precos').insert(row).select().single();
  if (error) return erro(error);
  S.historico.unshift(data); f.reset(); f.data.value = hojeISO(); previewHistorico(); renderHistorico();
};

// ---------- Conta ----------
function renderConta() {
  const p = S.perfil;
  const fp = $('#form-perfil'); if (document.activeElement?.form !== fp) { fp.primeiro_nome.value = p.primeiro_nome || ''; fp.personagem.value = p.personagem || ''; }
  $('#info-conta').innerHTML = `<p><b>${esc(p.primeiro_nome || p.nome || '')}</b> · ${esc(S.user.email)}</p><p>Plano atual: <span class="selo">${premium() ? 'VIP' : 'Free'}</span>${p.admin ? ' <span class="selo selo-adm">Master</span>' : ''}${p.premium_ate ? ` <span class="muted">até ${new Date(p.premium_ate).toLocaleDateString('pt-BR')}</span>` : ''}</p>`;
  $('#btn-assinar').classList.toggle('hidden', premium());
  $('#menu [data-pag=admin]').classList.toggle('hidden', !p.admin);
}
$('#form-codigo').onsubmit = async (e) => {
  e.preventDefault(); const inp = e.target.codigo, cod = inp.value.trim(); if (!cod) return;
  const { data, error } = await sb.rpc('resgatar_codigo', { p_codigo: cod });
  if (error) return toast(error.message);
  inp.value = '';
  const r = await sb.from('profiles').select('*').eq('id', S.user.id).single(); if (!r.error) S.perfil = r.data;
  await carregarPremium(); renderTudo();
  toast(`Código ativado! VIP por ${data.meses} meses${data.premium_ate ? ', até ' + new Date(data.premium_ate).toLocaleDateString('pt-BR') : ''}.`);
};
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
    const tabs = ['profiles', 'hunts', 'loot_guardado', 'compras_market', 'gastos_extras', 'historico_precos', 'xp_snapshots', 'metas_sets', 'metas_itens', 'banco_movimentos'];
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
  const r = await dialogo({ tipo: 'perigo', titulo: 'Excluir sua conta?', texto: 'Isso apaga sua conta e TODOS os seus dados, sem volta.\nPara confirmar, digite EXCLUIR.', ok: 'Excluir tudo',
    campo: { placeholder: 'EXCLUIR' }, validar: (v) => (v.trim().toUpperCase() !== 'EXCLUIR' ? 'Digite EXCLUIR para confirmar.' : '') });
  if (!r) return;
  const { error } = await sb.rpc('excluir_minha_conta');
  if (error) return erro(error);
  await sb.auth.signOut(); toast('Sua conta foi excluída.');
};

// sem handlers inline (permite uma Content-Security-Policy rígida)
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) $(`#menu [data-pag="${b.dataset.ir}"]`)?.click(); });
document.addEventListener('error', (e) => {
  const i = e.target; if (!(i instanceof HTMLImageElement) || !i.classList.contains('img-rashid')) return;
  i.replaceWith(Object.assign(document.createElement('span'), { className: 'hoje-cidade', textContent: '🧳' }));
}, true);

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
