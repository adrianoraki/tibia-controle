// TibiaHub — visão em gráficos do painel (alterna com a visão tradicional em cartões)
(() => {
  const CHAVE = 'tc_visao_painel';
  let visao = 'cartoes';
  try { visao = localStorage.getItem(CHAVE) === 'graficos' ? 'graficos' : 'cartoes'; } catch { /* navegador sem armazenamento */ }

  const COR = {};
  const atualizarCores = () => Object.assign(COR, { pos: corTema('--verde'), neg: corTema('--verm'), ouro: corTema('--ouro'), grade: corTema('--grade'), eixo: corTema('--muted'), txt: corTema('--txt'), card: corTema('--card') });

  // barras horizontais; se houver negativos, o zero fica no meio (positivo à direita, negativo à esquerda)
  function barrasH(itens, { cor = COR.ouro, sinal = false, sufixo = ' gp', W = 560 } = {}) {
    if (!itens.length) return '<div class="bloqueio">Sem dados ainda.</div>';
    const LB = 150, RV = 86, AL = 26, G = 8, H = itens.length * (AL + G) + 4;
    const max = Math.max(...itens.map((i) => Math.abs(i.val)), 1), temNeg = itens.some((i) => i.val < 0);
    const area = W - LB - RV, zero = LB + (temNeg ? area / 2 : 0), esc = (temNeg ? area / 2 : area) / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">`;
    if (temNeg) s += `<line x1="${zero}" x2="${zero}" y1="0" y2="${H}" stroke="${COR.eixo}" stroke-opacity=".5"/>`;
    itens.forEach((i, k) => {
      const y = 2 + k * (AL + G), w = Math.max(Math.abs(i.val) * esc, i.val ? 3 : 0), x = i.val < 0 ? zero - w : zero;
      const c = sinal ? (i.val < 0 ? COR.neg : COR.pos) : cor;
      const txt = `${sinal && i.val > 0 ? '+' : ''}${fmtC(i.val)}`;
      s += `<g class="g-barra"><title>${esc2(i.rot)}: ${sinal && i.val > 0 ? '+' : ''}${fmt(i.val)}${sufixo}${i.extra ? ' · ' + esc2(i.extra) : ''}</title>` +
        `<rect x="0" y="${y - 3}" width="${W}" height="${AL + 6}" fill="transparent"/>` +
        `<text x="${LB - 10}" y="${y + AL / 2 + 4}" fill="${COR.txt}" font-size="13" text-anchor="end">${esc2(cortar(i.rot, 20))}</text>` +
        `<rect x="${x}" y="${y}" width="${w}" height="${AL}" rx="4" fill="${c}"/>` +
        `<text x="${i.val < 0 ? zero + 6 : x + w + 6}" y="${y + AL / 2 + 4}" fill="${COR.eixo}" font-size="12">${txt}</text></g>`;
    });
    return s + '</svg>';
  }
  const esc2 = (t) => esc(t);
  const cortar = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + '…' : String(t));

  // profit acumulado no mês, com a meta mensal como linha de referência (um único eixo)
  function acumuladoMes(W = 560) {
    const hoje = hojeISO(), ini = hoje.slice(0, 8) + '01', ultimoDia = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7), 0).getDate(), diaHoje = +hoje.slice(8);
    const porDia = new Array(ultimoDia + 1).fill(0);
    for (const h of S.hunts) if (h.data >= ini && h.data <= hoje) porDia[+h.data.slice(8)] += h.profit;
    const pts = []; let acc = 0; for (let d = 1; d <= diaHoje; d++) { acc += porDia[d]; pts.push([d, acc]); }
    const meta = metasDe(S.perfil).mes;
    const H = 230, L = 56, R = 14, T = 14, B = 26;
    const max = Math.max(meta, ...pts.map((p) => p[1]), 1), min = Math.min(0, ...pts.map((p) => p[1]));
    const x = (d) => L + ((d - 1) / Math.max(ultimoDia - 1, 1)) * (W - L - R), y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Profit acumulado no mês">`;
    for (let i = 0; i <= 4; i++) { const v = min + ((max - min) * i) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${COR.grade}"/><text x="${L - 6}" y="${y(v) + 4}" fill="${COR.eixo}" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
    for (const d of [1, 10, 20, ultimoDia]) s += `<text x="${x(d)}" y="${H - 8}" fill="${COR.eixo}" font-size="11" text-anchor="middle">${String(d).padStart(2, '0')}/${hoje.slice(5, 7)}</text>`;
    if (meta) s += `<line x1="${L}" x2="${W - R}" y1="${y(meta)}" y2="${y(meta)}" stroke="${COR.pos}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R}" y="${y(meta) - 6}" fill="${COR.pos}" font-size="11" text-anchor="end">meta ${fmtC(meta)}</text>`;
    if (pts.length) {
      const linha = pts.map((p) => `${x(p[0])},${y(p[1])}`).join(' ');
      s += `<polygon points="${x(1)},${y(0)} ${linha} ${x(pts.at(-1)[0])},${y(0)}" fill="${COR.ouro}" fill-opacity=".12"/>` +
        `<polyline points="${linha}" fill="none" stroke="${COR.ouro}" stroke-width="2" stroke-linejoin="round"/>`;
      for (const p of pts) s += `<g><title>${String(p[0]).padStart(2, '0')}/${hoje.slice(5, 7)}: ${fmt(p[1])} gp acumulado</title><circle cx="${x(p[0])}" cy="${y(p[1])}" r="9" fill="transparent"/><circle cx="${x(p[0])}" cy="${y(p[1])}" r="${p[0] === diaHoje ? 4.5 : 0}" fill="${COR.ouro}" stroke="${COR.card}" stroke-width="2"/></g>`;
    }
    return s + '</svg>';
  }

  function renderGraficos() {
    const el = $('#graficos-painel'); if (!el || visao !== 'graficos') return;
    atualizarCores();
    const total = el.clientWidth || 1100, W = Math.max(320, Math.round((total >= 900 ? (total - 16) / 2 : total) - 36));
    const hoje = hojeISO(), iniMes = hoje.slice(0, 8) + '01';
    const pMes = S.hunts.filter((h) => h.data >= iniMes).reduce((a, h) => a + h.profit, 0);
    let trade = 0; for (const c of S.compras) if ((c.created_at || '').slice(0, 10) >= iniMes) trade += calcCompra(c).realizado;
    const gastos = S.gastos.filter((g) => g.data >= iniMes).reduce((a, g) => a + g.valor, 0);
    const resultado = pMes + trade - gastos;
    // profit por hora de cada hunt (média), top 8
    const g = new Map();
    for (const h of S.hunts) { if (!h.duracao_min) continue; const r = g.get(h.local) || { p: 0, m: 0, n: 0 }; r.p += h.profit; r.m += h.duracao_min; r.n++; g.set(h.local, r); }
    const porHora = [...g].map(([rot, r]) => ({ rot, val: Math.round(r.p / (r.m / 60)), extra: `${r.n} hunt(s)` })).sort((a, b) => b.val - a.val).slice(0, 8);
    // loot guardado por NPC
    const npc = new Map(); const iniMesG = hojeISO().slice(0, 8) + '01'; for (const v of (S.vendasNpc || []).filter((x) => x.criado_em.slice(0, 10) >= iniMesG)) { const n = (String(v.descricao || '').match(/^\d+x .+? \((.+)\)$/) || [])[1] || 'Outros'; npc.set(n, (npc.get(n) || 0) + v.valor); }
    const loot = [...npc].map(([rot, val]) => ({ rot, val })).sort((a, b) => b.val - a.val);

    el.innerHTML =
      `<div class="card graf"><div class="card-topo"><h2>Resultado do mês</h2><b class="graf-hero ${cls(resultado)}">${resultado > 0 ? '+' : ''}${fmt(resultado)} gp</b></div>` +
        barrasH([{ rot: 'Hunts', val: pMes }, { rot: 'Market → NPC', val: trade }, ...(premium() ? [{ rot: 'Gastos extras', val: -gastos }] : [])], { sinal: true, W }) + `</div>` +
      `<div class="card graf"><div class="card-topo"><h2>Profit acumulado no mês</h2><span class="muted">linha tracejada: meta mensal</span></div>${acumuladoMes(W)}</div>` +
      `<div class="card graf"><div class="card-topo"><h2>Profit por hora de cada hunt</h2><span class="muted">média · top 8</span></div>${porHora.length ? barrasH(porHora, { sufixo: ' gp/h', sinal: porHora.some((i) => i.val < 0), W }) : '<div class="bloqueio">Registre hunts com a duração para ver este gráfico.</div>'}</div>` +
      `<div class="card graf"><div class="card-topo"><h2>Vendido por NPC no mês</h2><span class="muted">o que já entrou no banco</span></div>${loot.length ? barrasH(loot, { W }) : '<div class="bloqueio">Nenhuma venda ao NPC este mês. Lance em Vender NPC.</div>'}</div>`;
  }

  function aplicarVisao() {
    $$('.visao-barra [data-visao]').forEach((b) => { const on = b.dataset.visao === visao; b.classList.toggle('ativo', on); b.setAttribute('aria-pressed', on); });
    $('#kpis')?.classList.toggle('hidden', visao === 'graficos');
    $('#graficos-painel')?.classList.toggle('hidden', visao !== 'graficos');
    renderGraficos();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.visao-barra [data-visao]'); if (!b) return;
    visao = b.dataset.visao; try { localStorage.setItem(CHAVE, visao); } catch { /* ok */ }
    aplicarVisao();
  });

  // redesenha na largura nova quando a janela muda de tamanho
  let tm = null;
  window.addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(() => { if (S.perfil && !$('#pag-painel').classList.contains('hidden')) renderPainel(); }, 200); });
  const painelOriginal = window.renderPainel;
  window.renderPainel = function () { painelOriginal(); aplicarVisao(); };
  if (S.perfil) aplicarVisao();
})();
