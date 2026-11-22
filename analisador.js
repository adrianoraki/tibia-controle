// TibiaControle — Analisador do Hunt Analyzer e do Party Hunt Analyzer (página pública)
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'));
  const fmtC = (n) => { const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'kk'; if (a >= 1e3) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'; return fmt(n); };
  const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
  const num = (s) => { const m = String(s).replace(/[^\d-]/g, ''); return m && m !== '-' ? parseInt(m, 10) : 0; };
  const fmtDur = (m) => m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : '—';
  const porHora = (v, min) => (min ? v / (min / 60) : null);
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3500); };

  const EXEMPLO_SOLO = `Session data: From 2026-11-21, 14:10:05 to 2026-11-21, 15:42:31
Session: 01:32h
Raw XP Gain: 2,104,330
XP Gain: 3,156,495
Raw XP/h: 1,372,389
XP/h: 2,058,583
Loot: 912,440
Supplies: 418,760
Balance: 493,680
Damage: 6,840,112
Damage/h: 4,460,942
Healing: 1,204,880
Healing/h: 785,791
Killed Monsters:
  212x Dragon
  64x Dragon Lord
Looted Items:
  9x Dragon Ham
  3x Dragon Shield
  1x Royal Helmet`;
  const EXEMPLO_PARTY = `Session data: From 2026-11-21, 20:00:12 to 2026-11-21, 21:31:40
Session: 01:31h
Loot Type: Leader
Loot: 4,820,300
Supplies: 2,145,900
Balance: 2,674,400
Knight Exemplo (Leader)
	Loot: 4,820,300
	Supplies: 820,400
	Balance: 3,999,900
	Damage: 5,120,000
	Healing: 900,000
Druid Exemplo
	Loot: 0
	Supplies: 610,200
	Balance: -610,200
	Damage: 2,300,000
	Healing: 4,100,000
Paladin Exemplo
	Loot: 0
	Supplies: 715,300
	Balance: -715,300
	Damage: 6,400,000
	Healing: 600,000`;

  // ---------- leitura do texto copiado do cliente ----------
  function analisar(txt) {
    const linhas = String(txt).replace(/\r/g, '').split('\n');
    const r = { tipo: 'solo', inicio: null, fim: null, min: 0, campos: {}, monstros: [], itens: [], jogadores: [] };
    let secao = null, jog = null;
    for (const bruta of linhas) {
      if (!bruta.trim()) continue;
      const recuo = /^[\t ]/.test(bruta), l = bruta.trim();
      let m;
      if ((m = l.match(/^Session data: From (\d{4}-\d{2}-\d{2}), ([\d:]+) to (\d{4}-\d{2}-\d{2}), ([\d:]+)/i))) { r.inicio = `${m[1]}T${m[2]}`; r.fim = `${m[3]}T${m[4]}`; continue; }
      if ((m = l.match(/^Session: (\d+):(\d+)h/i))) { r.min = +m[1] * 60 + +m[2]; continue; }
      if (/^Killed Monsters:?$/i.test(l)) { secao = 'monstros'; continue; }
      if (/^Looted Items:?$/i.test(l)) { secao = 'itens'; continue; }
      if (secao && (m = l.match(/^(\d+)x (.+)$/))) { r[secao].push({ qtd: +m[1], nome: m[2] }); continue; }
      if (/^Loot Type:/i.test(l)) { r.tipo = 'party'; secao = null; continue; }
      if ((m = l.match(/^([^:]+):\s*(-?[\d,.]+)\s*$/))) {
        const k = m[1].trim().toLowerCase(), v = num(m[2]);
        if (recuo && jog) jog[k] = v; else { r.campos[k] = v; jog = null; }
        continue;
      }
      if (r.tipo === 'party' && !l.includes(':')) {          // nome de jogador do Party Hunt Analyzer
        jog = { nome: l.replace(/\s*\(Leader\)\s*$/i, ''), lider: /\(Leader\)/i.test(l) };
        r.jogadores.push(jog); secao = null;
      }
    }
    if (r.jogadores.length) r.tipo = 'party';
    const c = r.campos;
    if (!('loot' in c) && !('balance' in c)) return null;
    if (!('balance' in c)) c.balance = (c.loot || 0) - (c.supplies || 0);
    return r;
  }

  // quem paga quem para todos ficarem com o mesmo lucro
  function dividir(jogadores) {
    const total = jogadores.reduce((t, j) => t + (j.balance || 0), 0), cada = Math.floor(total / jogadores.length);
    const deve = jogadores.map((j) => ({ nome: j.nome, v: (j.balance || 0) - cada })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const recebe = jogadores.map((j) => ({ nome: j.nome, v: cada - (j.balance || 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const tr = [];
    let i = 0, k = 0;
    while (i < deve.length && k < recebe.length) {
      const v = Math.min(deve[i].v, recebe[k].v);
      if (v > 0) tr.push({ de: deve[i].nome, para: recebe[k].nome, v });
      deve[i].v -= v; recebe[k].v -= v;
      if (!deve[i].v) i++; if (!recebe[k].v) k++;
    }
    return { total, cada, tr };
  }

  // ---------- link compartilhável (dados só no #, nada vai para o servidor) ----------
  const b64 = { enc: (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) };
  const compactar = (r) => ({ t: r.tipo, i: r.inicio, f: r.fim, m: r.min, c: r.campos, k: r.monstros.slice(0, 30).map((x) => [x.qtd, x.nome]), l: r.itens.slice(0, 40).map((x) => [x.qtd, x.nome]), j: r.jogadores.map((j) => [j.nome, j.lider ? 1 : 0, j.loot || 0, j.supplies || 0, j.balance || 0, j.damage || 0, j.healing || 0]), n: $('#nome-hunt')?.value.trim() || '' });
  // link vem de fora: só aceita números e textos curtos, nada além do formato esperado
  const N = (v) => (Number.isFinite(+v) ? Math.max(-1e12, Math.min(1e12, Math.round(+v))) : 0);
  const T = (v, max = 40) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);
  const DATA = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null);
  const CAMPOS = ['loot', 'supplies', 'balance', 'raw xp gain', 'xp gain', 'raw xp/h', 'xp/h', 'damage', 'damage/h', 'healing', 'healing/h'];
  const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const expandir = (o) => {
    if (!o || typeof o !== 'object') throw new Error('inválido');
    const campos = {}; for (const k of CAMPOS) if (o.c && k in o.c) campos[k] = N(o.c[k]);
    return { tipo: o.t === 'party' ? 'party' : 'solo', inicio: DATA(o.i), fim: DATA(o.f), min: Math.max(0, Math.min(6000, N(o.m))), campos,
      monstros: lista(o.k, 30).map((x) => ({ qtd: Math.max(0, N(x?.[0])), nome: T(x?.[1], 60) })),
      itens: lista(o.l, 40).map((x) => ({ qtd: Math.max(0, N(x?.[0])), nome: T(x?.[1], 60) })),
      jogadores: lista(o.j, 10).map((x) => ({ nome: T(x?.[0], 30), lider: !!x?.[1], loot: N(x?.[2]), supplies: N(x?.[3]), balance: N(x?.[4]), damage: N(x?.[5]), healing: N(x?.[6]) })),
      nome: T(o.n, 60) };
  };

  // ---------- tela ----------
  let atual = null;
  const kpi = (rot, val, extra = '', c = '') => `<div class="kpi ${c}"><div class="rot">${rot}</div><div class="val">${val}</div>${extra ? `<small class="muted">${extra}</small>` : ''}</div>`;
  const barras = (lista, cor) => { const max = Math.max(...lista.map((x) => x.qtd), 1);
    return lista.slice(0, 12).map((x) => `<div class="bar-linha"><span class="bar-nome">${esc(x.nome)}</span><span class="bar-trilho"><span style="width:${(x.qtd / max) * 100}%;background:${cor}"></span></span><b>${fmt(x.qtd)}</b></div>`).join(''); };

  function render(r, compartilhado) {
    atual = r; const c = r.campos, el = $('#resultado');
    const data = r.inicio ? new Date(r.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    let h = `<div class="card"><div class="card-topo"><h2>${r.tipo === 'party' ? 'Party hunt' : 'Hunt solo'}${r.nome ? ' · ' + esc(r.nome) : ''}</h2><span class="muted">${data}${r.min ? ' · ' + fmtDur(r.min) : ''}</span></div>` +
      `<div class="grid linha-kpis">` +
      kpi('Balance (lucro)', `<span class="${cls(c.balance)}">${fmt(c.balance)}</span>`, r.min ? `${fmtC(porHora(c.balance, r.min))}/h` : '', 'ouro') +
      kpi('Loot', fmt(c.loot), r.min ? `${fmtC(porHora(c.loot, r.min))}/h` : '') +
      kpi('Supplies', `<span class="neg">${fmt(c.supplies)}</span>`, r.min ? `${fmtC(porHora(c.supplies, r.min))}/h` : '') +
      (c['xp gain'] != null ? kpi('XP', fmtC(c['xp gain']), c['xp/h'] ? `${fmtC(c['xp/h'])}/h · raw ${fmtC(c['raw xp gain'] || 0)}` : '') : '') +
      (c.damage != null ? kpi('Dano', fmtC(c.damage), c['damage/h'] ? `${fmtC(c['damage/h'])}/h` : '') : '') +
      (c.healing != null ? kpi('Cura', fmtC(c.healing), c['healing/h'] ? `${fmtC(c['healing/h'])}/h` : '') : '') +
      `</div>`;
    if (r.tipo === 'party' && r.jogadores.length) {
      const d = dividir(r.jogadores);
      h += `<div class="ana-duas"><div><h3>Jogadores</h3><div class="tabela-wrap"><table><tr><th>Jogador</th><th class="num">Loot</th><th class="num">Supplies</th><th class="num">Balance</th><th class="num">Dano</th><th class="num">Cura</th></tr>` +
        r.jogadores.map((j) => `<tr><td>${esc(j.nome)}${j.lider ? ' <span class="selo">Leader</span>' : ''}</td><td class="num">${fmt(j.loot)}</td><td class="num">${fmt(j.supplies)}</td><td class="num ${cls(j.balance)}">${fmt(j.balance)}</td><td class="num">${fmtC(j.damage || 0)}</td><td class="num">${fmtC(j.healing || 0)}</td></tr>`).join('') +
        `</table></div></div><div><h3>Divisão do loot</h3><p class="muted">Cada um fica com <b class="${cls(d.cada)}">${fmt(d.cada)} gp</b> de lucro.</p>` +
        (d.tr.length ? d.tr.map((t) => { const cmd = `transfer ${t.v} to ${t.para.replace(/[^A-Za-z' -]/g, '')}`;
          return `<div class="transf"><div><b>${esc(t.de)}</b> paga <b class="ouro-txt">${fmt(t.v)} gp</b> para <b>${esc(t.para)}</b><code>${esc(cmd)}</code></div><button class="btn sec mini-btn" type="button" data-copiar="${esc(cmd)}">Copiar</button></div>`; }).join('')
          : '<p class="muted">Ninguém precisa transferir nada.</p>') +
        `<p class="dica">Fale o comando para o NPC do banco depois de dizer <b>hi</b>. Confira o nome antes de confirmar.</p></div></div>`;
    }
    if (r.monstros.length || r.itens.length) {
      h += `<div class="ana-duas">` +
        (r.monstros.length ? `<div><h3>Criaturas mortas <small class="muted">${fmt(r.monstros.reduce((t, x) => t + x.qtd, 0))}</small></h3>${barras(r.monstros, 'var(--verm)')}</div>` : '<div></div>') +
        (r.itens.length ? `<div><h3>Itens dropados</h3>${barras(r.itens, 'var(--ouro)')}</div>` : '<div></div>') + `</div>`;
    }
    h += `</div>`;
    el.innerHTML = h;
    $('#acoes').classList.remove('hidden');
    $('#salvar-box').classList.toggle('hidden', !!compartilhado && !sessao);
    atualizarSalvar();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#form-ana').onsubmit = (e) => {
    e.preventDefault();
    const r = analisar($('#texto').value.slice(0, 50000));
    if (!r) { $('#resultado').innerHTML = '<div class="card bloqueio">Não reconheci o texto. No Tibia, abra o <b>Hunt Analyzer</b> ou o <b>Party Hunt Analyzer</b>, clique no ícone de copiar e cole aqui.</div>'; $('#acoes').classList.add('hidden'); return; }
    r.nome = $('#nome-hunt').value.trim(); history.replaceState(null, '', location.pathname); render(r, false);
  };
  $('#btn-ex-solo').onclick = () => { $('#texto').value = EXEMPLO_SOLO; $('#form-ana').requestSubmit(); };
  $('#btn-ex-party').onclick = () => { $('#texto').value = EXEMPLO_PARTY; $('#form-ana').requestSubmit(); };
  $('#nome-hunt').oninput = () => { if (atual) atual.nome = $('#nome-hunt').value.trim(); };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copiar]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiar); toast('Copiado!'); } catch { prompt('Copie:', b.dataset.copiar); }
  });
  $('#btn-link').onclick = async () => {
    if (!atual) return;
    const url = `${location.origin}${location.pathname}#h=${b64.enc(compactar(atual))}`;
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); toast('Link copiado! Quem abrir vê este resumo.'); } catch { prompt('Copie o link:', url); }
  };

  // ---------- salvar no painel (só com login) ----------
  let sb = null, sessao = null;
  function atualizarSalvar() {
    const box = $('#salvar-box'); if (!atual) return;
    if (!sessao) { box.innerHTML = `<p>Quer guardar esta hunt no seu histórico, com metas e ranking? <a href="/">Entre ou crie sua conta grátis</a>.</p>`; return; }
    const meu = atual.tipo === 'party' ? '<label>Qual jogador é você?<select id="sel-jog">' + atual.jogadores.map((j, i) => `<option value="${i}">${esc(j.nome)}</option>`).join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" id="usar-divisao" checked> <span>Usar o lucro depois da divisão</span></label>' : '';
    box.innerHTML = `<form id="form-salvar" class="linha-form"><label class="largo">Nome da hunt<input id="local-salvar" required placeholder="ex: Library Fire" value="${esc(atual.nome || '')}"></label>${meu}<button class="btn">Salvar no meu painel</button></form>`;
    $('#form-salvar').onsubmit = salvar;
  }
  async function salvar(e) {
    e.preventDefault(); const r = atual, c = r.campos;
    let loot = c.loot || 0, gasto = c.supplies || 0;
    if (r.tipo === 'party') {
      const j = r.jogadores[+$('#sel-jog').value];
      gasto = j.supplies || 0;
      loot = $('#usar-divisao').checked ? dividir(r.jogadores).cada + gasto : (j.loot || 0);
    }
    const dia = r.inicio ? r.inicio.slice(0, 10) : new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const row = { data: dia, local: $('#local-salvar').value.trim(), loot, gasto, duracao_min: r.min || null, xp: c['xp gain'] || null, obs: r.tipo === 'party' ? `Party (${r.jogadores.length}) via analisador` : 'via analisador' };
    const { error } = await sb.from('hunts').insert(row);
    if (error) return toast(/limite|20/i.test(error.message) ? 'O plano Free guarda até 20 hunts. Vire VIP para hunts ilimitadas.' : error.message);
    toast('Hunt salva no seu painel!');
  }

  // abre um link compartilhado
  function abrirHash() {
    const m = location.hash.match(/^#h=([\w-]{1,8000})$/); if (!m) return;
    try { const r = expandir(b64.dec(m[1])); $('#nome-hunt').value = r.nome || ''; render(r, true); $('#cx-colar').open = false; }
    catch { toast('Link de hunt inválido.'); }
  }
  window.addEventListener('hashchange', abrirHash);

  try {
    sb = window.supabase.createClient('https://shqwskfijvfndaocaqdv.supabase.co', 'sb_publishable_2HU-RRrIjueYdw5mXbxdhQ_DFa0zFES');
    sb.auth.getSession().then(({ data }) => { sessao = data.session; $('#link-painel').textContent = sessao ? 'Ir para o meu painel' : 'Entrar / criar conta'; atualizarSalvar(); });
  } catch { /* sem Supabase: o analisador funciona igual, só não salva */ }
  abrirHash();
})();
