// TibiaHub — XP farmada por dia.
// Fontes, da mais precisa para a menos: XP informada pelo jogador (janela Skills) ou ranking oficial = exata;
// soma do XP das hunts registradas no dia; subida de level = XP mínima. Cada dia mostra o melhor número e de onde veio.
(() => {
  const expLevel = (l) => Math.round((50 / 3) * (l ** 3 - 6 * l ** 2 + 17 * l - 12));
  const levelDeExp = (x) => { let l = Math.max(1, Math.floor(Math.cbrt((x * 3) / 50))); while (expLevel(l + 1) <= x) l++; while (l > 1 && expLevel(l) > x) l--; return l; };
  const diaTibia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() - 10 * 3600e3));
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dif = (a, b) => Math.round((new Date(b + 'T12:00Z') - new Date(a + 'T12:00Z')) / 864e5);
  const numXp = (t) => { const d = String(t || '').replace(/\D/g, ''); return d && d.length <= 14 ? +d : null; };
  const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const FONTE = { exata: { nome: 'exata', cor: 'var(--verde)' }, hunts: { nome: 'das hunts', cor: 'var(--ouro)' }, minima: { nome: 'mínima', cor: 'var(--muted)' } };
  let carregado = false, carregando = false, modo = 'diario', alvoAtual = null;
  try { if (localStorage.getItem('tc_xp_modo') === 'acumulado') modo = 'acumulado'; } catch { /* sem storage */ }

  async function carregar() {
    if (carregando || !S.user) return; carregando = true;
    const { data, error } = await sb.from('xp_snapshots').select('data,level,experiencia,fonte').order('data', { ascending: false }).limit(120);
    carregando = false;
    if (error) return;
    S.xpFotos = (data || []).reverse(); carregado = true; renderXp();
  }

  // ---------- números ----------
  function dias() {
    const f = S.xpFotos || [], porDia = new Map();
    for (let i = 1; i < f.length; i++) { // a foto do dia D+1 fecha o dia de jogo D
      const a = f[i - 1], b = f[i], dia = somaDia(b.data, -1);
      let valor = null, exato = false;
      if (a.experiencia != null && b.experiencia != null) { valor = Math.max(0, b.experiencia - a.experiencia); exato = true; }
      else if (a.level && b.level) valor = Math.max(0, expLevel(b.level) - expLevel(a.level));
      porDia.set(dia, { valor, exato, juntos: dif(a.data, b.data), lvA: a.level, lvB: b.level });
    }
    const hunts = new Map();
    for (const h of S.hunts || []) if (h.xp > 0) hunts.set(h.data, (hunts.get(h.data) || 0) + h.xp);
    const ate = somaDia(diaTibia(), -1), out = [];
    for (let k = 34; k >= 0; k--) {
      const d = somaDia(ate, -k), s = porDia.get(d), hx = hunts.get(d) || 0;
      let valor = s?.valor ?? null, fonte = s ? (s.exato ? 'exata' : 'minima') : null;
      if (hx && (valor == null || (!s?.exato && hx > valor))) { valor = hx; fonte = 'hunts'; }
      out.push({ dia: d, valor, fonte, hunts: hx, juntos: s?.juntos || 1, lvA: s?.lvA, lvB: s?.lvB });
    }
    return out;
  }
  function atual() {
    const ult = (S.xpFotos || []).at(-1);
    if (ult?.experiencia != null) return { level: levelDeExp(ult.experiencia), exp: ult.experiencia, exata: true, em: ult.data };
    const nivel = ult?.level || S.perfil?.level || null;
    return nivel ? { level: nivel, exp: expLevel(nivel), exata: false, em: ult?.data } : null;
  }

  // ---------- desenho ----------
  function gauge(a) {
    if (!a) return `<div class="xp-gauge"><div class="xp-gauge-txt"><small>Level</small><b>?</b></div></div><div class="xp-gauge-info muted">Informe seu personagem na página Conta.</div>`;
    const ini = expLevel(a.level), fim = expLevel(a.level + 1), pct = a.exata ? Math.min(100, Math.max(0, ((a.exp - ini) / (fim - ini)) * 100)) : null;
    const R = 54, C = 2 * Math.PI * R, off = pct == null ? C : C * (1 - pct / 100);
    return `<div class="xp-gauge"><svg viewBox="0 0 128 128" aria-hidden="true"><defs><linearGradient id="xpg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${corTema('--ouro')}"/><stop offset="1" stop-color="${corTema('--verde')}"/></linearGradient></defs>` +
      `<circle cx="64" cy="64" r="${R}" fill="none" stroke="${corTema('--grade')}" stroke-width="10"/>` +
      `<circle cx="64" cy="64" r="${R}" fill="none" stroke="url(#xpg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 64 64)" class="xp-arco"/></svg>` +
      `<div class="xp-gauge-txt"><small>Level</small><b>${a.level}</b>${pct != null ? `<span>${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>` : ''}</div></div>` +
      `<div class="xp-gauge-info">${pct != null ? `<span>Faltam <b>${fmtC(fim - a.exp)}</b> XP para o ${a.level + 1}</span><small class="muted">${fmt(a.exp)} XP · ${fmtData(a.em)}</small>`
        : `<small class="muted">Para ver a % até o level ${a.level + 1}, informe a XP que aparece no jogo.</small>`}</div>`;
  }

  function grafico(lista, W) {
    const H = 210, L = 52, R = 10, T = 12, B = 26, n = lista.length, bw = (W - L - R) / n, acum = modo === 'acumulado';
    let acc = 0; const vals = lista.map((d) => (acum ? (acc += d.valor || 0) : d.valor || 0));
    const max = Math.max(...vals, 1), y = (v) => T + (H - T - B) * (1 - v / max), ouro = corTema('--ouro');
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="xp-svg" role="img" aria-label="XP ${acum ? 'acumulada' : 'por dia'} nos últimos 30 dias"><defs>` +
      `<linearGradient id="xpb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${ouro}"/><stop offset="1" stop-color="${ouro}" stop-opacity=".45"/></linearGradient>` +
      `<linearGradient id="xpa" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${ouro}" stop-opacity=".32"/><stop offset="1" stop-color="${ouro}" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i <= 3; i++) { const v = (max * i) / 3; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${corTema('--grade')}"/><text x="${L - 6}" y="${y(v) + 4}" fill="${corTema('--muted')}" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
    if (acum) {
      const pts = vals.map((v, i) => `${(L + i * bw + bw / 2).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      s += `<polygon points="${L + bw / 2},${y(0)} ${pts} ${L + (n - 1) * bw + bw / 2},${y(0)}" fill="url(#xpa)"/><polyline points="${pts}" fill="none" stroke="${ouro}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    lista.forEach((d, i) => {
      const x = L + i * bw;
      if (!acum && d.valor) {
        const w = Math.max(3, bw * 0.62), h = Math.max(2, y(0) - y(d.valor));
        s += `<path d="M${x + (bw - w) / 2},${y(0)}v${-(h - 4)}a4,4 0 0 1 4,-4h${w - 8}a4,4 0 0 1 4,4v${h - 4}z" fill="url(#xpb)"${d.fonte === 'minima' ? ' fill-opacity=".5"' : ''}/>`;
      }
      if (!acum && d.valor === 0) s += `<rect x="${x + bw * 0.2}" y="${y(0) - 2}" width="${bw * 0.6}" height="2" rx="1" fill="${corTema('--neutro')}"/>`;
      s += `<rect class="xp-hit" data-i="${i}" x="${x}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>`;
      if (i % 5 === 4 || i === n - 1) s += `<text x="${x + bw / 2}" y="${H - 8}" fill="${corTema('--muted')}" font-size="11" text-anchor="middle">${dm(d.dia)}</text>`;
    });
    return s + '</svg>';
  }

  function calendario(lista) {
    const vals = lista.map((d) => d.valor || 0).filter(Boolean).sort((a, b) => a - b), q = (p) => vals[Math.floor(p * (vals.length - 1))] || 0;
    const nivel = (v) => (!v ? 0 : v <= q(0.25) ? 1 : v <= q(0.5) ? 2 : v <= q(0.75) ? 3 : 4);
    const vazio = (new Date(lista[0].dia + 'T12:00Z').getUTCDay() + 6) % 7; // semana começa na segunda
    return `<div class="xp-cal"><b class="xp-sub">📅 Últimos 35 dias</b><div class="xp-cal-sem"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div><div class="xp-cal-grade">` +
      '<i class="xp-cel fora"></i>'.repeat(vazio) +
      lista.map((d) => `<i class="xp-cel n${d.valor == null ? 'x' : nivel(d.valor)}" title="${dm(d.dia)}: ${d.valor == null ? 'sem dado' : (d.fonte === 'minima' ? '≥ ' : '') + fmt(d.valor) + ' XP'}"></i>`).join('') +
      `</div><div class="xp-cal-leg"><span>sem dado</span><i class="xp-cel nx"></i><span>menos</span><i class="xp-cel n1"></i><i class="xp-cel n2"></i><i class="xp-cel n3"></i><i class="xp-cel n4"></i><span>mais</span></div></div>`;
  }

  function previsao(a, ritmo) {
    if (!a) return '';
    const destino = Math.min(5000, Math.max(a.level + 1, alvoAtual || a.level + 1)), falta = expLevel(destino) - a.exp;
    const diasN = ritmo > 0 ? Math.ceil(falta / ritmo) : null;
    const quando = diasN ? new Date(Date.now() + diasN * 864e5).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: diasN > 300 ? 'numeric' : undefined }) : '';
    const chips = [a.level + 1, a.level + 5, a.level + 10, Math.ceil((a.level + 1) / 50) * 50, Math.ceil((a.level + 1) / 100) * 100].filter((v, i, arr) => arr.indexOf(v) === i);
    return `<div class="xp-prev"><b class="xp-sub">🎯 Previsão de level</b>` +
      `<div class="xp-chips">${chips.map((c) => `<button type="button" class="chip ${c === destino ? 'ativo' : ''}" data-xp-alvo="${c}">${c}</button>`).join('')}` +
      `<label class="xp-alvo">outro: <input type="number" min="${a.level + 1}" max="5000" value="${destino}" data-xp="alvo" aria-label="Level desejado"></label></div>` +
      `<div class="xp-prev-res">${diasN ? `<span class="xp-prev-num">${fmt(diasN)}</span><span>dia${diasN > 1 ? 's' : ''} até o level ${destino}<small class="muted">≈ ${quando} · faltam ${fmtC(falta)} XP no ritmo de ${fmtC(ritmo)}/dia${a.exata ? '' : ' · conta do início do level atual'}</small></span>`
        : '<span class="muted">Ainda sem ritmo. Registre hunts com XP ou espere alguns dias de coleta.</span>'}</div></div>`;
  }

  function renderXp() {
    const el = $('#card-xp'); if (!el) return;
    const lista = dias(), a = atual(), comValor = lista.filter((d) => d.valor != null);
    const ult7 = lista.slice(-7).filter((d) => d.valor != null), ritmo = ult7.length ? ult7.reduce((t, d) => t + d.valor, 0) / ult7.length : 0;
    const ontem = lista.at(-1), melhor = comValor.reduce((m, d) => (!m || d.valor > m.valor ? d : m), null), total30 = lista.slice(-30).reduce((t, d) => t + (d.valor || 0), 0);
    let seq = 0; for (let i = lista.length - 1; i >= 0 && lista[i].valor > 0; i--) seq++;
    const pre = (d) => (d?.fonte === 'minima' ? '≥ ' : ''), temMinima = comValor.some((d) => d.fonte === 'minima');
    const fotos = S.xpFotos || [], ultFoto = fotos.at(-1), hoje = diaTibia();
    const topo = `<div class="card-topo xp-topo"><h2>XP farmada</h2><div class="xp-acoes"><div class="seg" role="group" aria-label="Tipo de gráfico">` +
      `<button type="button" data-xp-modo="diario" class="${modo === 'diario' ? 'ativo' : ''}" aria-pressed="${modo === 'diario'}">Diário</button>` +
      `<button type="button" data-xp-modo="acumulado" class="${modo === 'acumulado' ? 'ativo' : ''}" aria-pressed="${modo === 'acumulado'}">Acumulado</button></div>` +
      `<button type="button" class="btn mini-btn" data-xp="informar" title="Copie o valor de Experience da janela Skills do jogo">✎ Informar XP do jogo</button></div></div>`;
    const largura = el.clientWidth || 900, W = Math.max(380, largura - 36 - (largura > 860 ? 250 : 0));
    let corpoGraf;
    if (comValor.length) corpoGraf = grafico(lista.slice(-30), W);
    else corpoGraf = `<div class="bloqueio">${ultFoto ? `Primeira foto guardada em ${fmtData(ultFoto.data)} (level ${fmt(ultFoto.level)}).<br>${ultFoto.data < hoje ? 'A foto de hoje ainda não saiu porque a ficha de personagem da TibiaData está fora do ar. O site tenta de novo a cada hora.' : 'O primeiro dia aparece depois do próximo server save.'}`
      : S.perfil?.personagem ? 'O robô tira a primeira foto do seu personagem depois do próximo server save.' : 'Informe seu personagem na página Conta para começar.'}<br>Para ter a XP exata agora, clique em <b>✎ Informar XP do jogo</b>.</div>`;
    el.innerHTML = topo + `<div class="xp-grid"><div class="xp-esq">${gauge(a)}</div><div class="xp-dir">` +
      `<div class="grid linha-kpis xp-kpis">` +
        kpi('Ontem', ontem?.valor != null ? `${pre(ontem)}${fmtC(ontem.valor)}` : '—', 'ouro') +
        kpi('Média 7 dias', ritmo ? `${ult7.some((d) => d.fonte === 'minima') ? '≥ ' : ''}${fmtC(ritmo)}` : '—') +
        kpi('Melhor dia', melhor ? `${pre(melhor)}${fmtC(melhor.valor)}<small class="muted"> ${dm(melhor.dia)}</small>` : '—') +
        kpi('30 dias', total30 ? `${temMinima ? '≥ ' : ''}${fmtC(total30)}` : '—') +
        kpi('Sequência', seq ? `🔥 ${seq} dia${seq > 1 ? 's' : ''}` : '—') + `</div>` +
      `<div class="xp-graf">${corpoGraf}<div class="xp-tip hidden" role="status"></div></div></div></div>` +
      `<div class="xp-baixo">${calendario(lista)}${previsao(a, ritmo)}</div>` +
      `<details class="xp-tabela"><summary>Ver dia a dia</summary><div class="tabela-wrap"><table><tr><th>Dia</th><th class="num">XP do dia</th><th>Fonte</th><th class="num">XP nas hunts</th><th class="num">Level</th></tr>` +
        (lista.slice().reverse().filter((d) => d.valor != null || d.hunts).map((d) => `<tr><td>${fmtData(d.dia)}${d.juntos > 1 ? ` <small class="muted">(${d.juntos} dias)</small>` : ''}</td><td class="num"><b>${pre(d)}${fmt(d.valor)}</b></td>` +
          `<td><span class="xp-fonte" style="--t:${FONTE[d.fonte]?.cor || 'var(--muted)'}">${FONTE[d.fonte]?.nome || '—'}</span></td><td class="num">${d.hunts ? fmt(d.hunts) : '—'}</td>` +
          `<td class="num">${d.lvB ? `${d.lvB}${d.lvA && d.lvB > d.lvA ? ` <small class="pos">(+${d.lvB - d.lvA})</small>` : ''}` : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem dias ainda.</td></tr>') +
        `</table></div><p class="dica"><b>exata</b>: XP do jogo (informada por você) ou do ranking oficial · <b>das hunts</b>: soma do XP das hunts que você registrou no dia · <b>mínima (≥)</b>: calculada pela subida de level, a XP real pode ser maior.</p></details>`;
    el._lista = lista.slice(-30);
  }

  // dica ao passar o mouse no gráfico
  document.addEventListener('mousemove', (e) => {
    const card = $('#card-xp'), tip = card && $('.xp-tip', card); if (!tip) return;
    const hit = e.target.closest?.('.xp-hit');
    if (!hit || !card.contains(hit)) return tip.classList.add('hidden');
    const d = card._lista?.[+hit.dataset.i]; if (!d) return;
    const box = $('.xp-graf', card).getBoundingClientRect();
    tip.innerHTML = `<b>${fmtData(d.dia)}</b><span>${d.valor == null ? 'sem dado' : `${d.fonte === 'minima' ? '≥ ' : ''}${fmt(d.valor)} XP`}</span>` +
      (d.fonte ? `<small style="color:${FONTE[d.fonte].cor}">XP ${FONTE[d.fonte].nome}</small>` : '') +
      (d.hunts && d.fonte !== 'hunts' ? `<small class="muted">hunts: ${fmt(d.hunts)}</small>` : '') +
      (d.lvA && d.lvB > d.lvA ? `<small class="muted">level ${d.lvA} → ${d.lvB}</small>` : '');
    tip.classList.remove('hidden');
    tip.style.left = Math.min(box.width - 170, Math.max(0, e.clientX - box.left + 14)) + 'px';
    tip.style.top = Math.max(0, e.clientY - box.top - 70) + 'px';
  });

  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-xp-modo]');
    if (m) { modo = m.dataset.xpModo === 'acumulado' ? 'acumulado' : 'diario'; try { localStorage.setItem('tc_xp_modo', modo); } catch { /* ok */ } return renderXp(); }
    const c = e.target.closest('[data-xp-alvo]'); if (c) { alvoAtual = +c.dataset.xpAlvo; return renderXp(); }
    if (e.target.closest('[data-xp="informar"]')) informar();
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-xp="alvo"]')) { const v = Math.floor(+e.target.value); if (v > 0) { alvoAtual = Math.min(5000, v); renderXp(); } }
  });

  // o jogador informa a XP exata (janela Skills do jogo → Experience)
  async function informar() {
    if (!S.user) return;
    const a = atual();
    const v = await dialogo({ titulo: 'Sua XP no jogo', texto: 'No Tibia, abra a janela Skills e copie o número de Experience.\nCom ele o site mostra a % até o próximo level e a XP exata de cada dia.', ok: 'Salvar XP',
      campo: { placeholder: 'ex: 970.999.044', num: true },
      validar: (x) => { const n = numXp(x); if (n == null || n > 1e13) return 'Digite só o número de Experience.';
        const l = levelDeExp(n); return a && Math.abs(l - a.level) > 30 ? `Esse número é de level ${l}, mas seu personagem está no ${a.level}. Confira.` : ''; } });
    if (v == null || v === false) return;
    const exp = numXp(v); if (exp == null) return;
    const p = S.perfil || {};
    const { error } = await sb.from('xp_snapshots').upsert({ user_id: S.user.id, data: diaTibia(), personagem: String(p.personagem || '?').slice(0, 40), mundo: p.mundo || null,
      level: levelDeExp(exp), experiencia: Math.round(exp), fonte: 'manual' }, { onConflict: 'user_id,data' });
    if (error) return erro(error);
    toast(`XP salva: level ${levelDeExp(exp)} · ${fmt(exp)} XP`); carregado = false; carregar();
  }

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => carregado && renderXp(), 200); });
  const painelOriginal = window.renderPainel;
  window.renderPainel = function () { painelOriginal(); if (carregado) renderXp(); else carregar(); };
  if (S.perfil) carregar();
})();
