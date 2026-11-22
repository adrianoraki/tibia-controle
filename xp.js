// TibiaControle — XP farmada por dia (fotos diárias tiradas pelo robô depois do server save)
(() => {
  // experiência mínima para estar em um level (fórmula oficial do Tibia)
  const expLevel = (l) => Math.round((50 / 3) * (l ** 3 - 6 * l ** 2 + 17 * l - 12));
  const diaAnterior = (iso) => { const d = new Date(iso + 'T12:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const dif = (a, b) => Math.round((new Date(b + 'T12:00Z') - new Date(a + 'T12:00Z')) / 864e5);
  let carregado = false, carregando = false;

  async function carregar() {
    if (carregando || !S.user) return; carregando = true;
    const { data, error } = await sb.from('xp_snapshots').select('data,level,experiencia,fonte').order('data', { ascending: false }).limit(91);
    carregando = false;
    if (error) return;
    S.xpFotos = (data || []).reverse(); carregado = true;
    renderXp(); marcarMini();
  }

  // cada par de fotos seguidas vira um dia farmado (o dia de jogo que terminou no server save da 2ª foto)
  function diasFarmados() {
    const f = S.xpFotos || [], out = [];
    for (let i = 1; i < f.length; i++) {
      const a = f[i - 1], b = f[i], dias = dif(a.data, b.data);
      let valor = null, exato = false;
      if (a.experiencia != null && b.experiencia != null) { valor = b.experiencia - a.experiencia; exato = true; }
      else if (a.level && b.level) valor = Math.max(0, expLevel(b.level) - expLevel(a.level));
      if (valor == null) continue;
      out.push({ dia: diaAnterior(b.data), valor, exato, dias, lvA: a.level, lvB: b.level });
    }
    return out;
  }

  function renderXp() {
    const el = $('#card-xp'); if (!el) return;
    const lista = diasFarmados(), ult = (S.xpFotos || []).at(-1);
    const topo = '<div class="card-topo"><h2>XP farmada por dia</h2><span class="muted">atualiza todo dia depois do server save</span></div>';
    if (!lista.length) {
      el.innerHTML = topo + `<div class="bloqueio">${ult ? `Primeira foto guardada em ${fmtData(ult.data)} (level ${fmt(ult.level)}).<br>O primeiro dia farmado aparece depois do próximo server save, por volta das 6h40 de Brasília.`
        : S.perfil?.personagem ? 'O robô vai tirar a primeira foto do seu personagem depois do próximo server save, por volta das 6h40 de Brasília.' : 'Informe seu personagem na página Conta para começar.'}</div>`;
      return;
    }
    const ult30 = lista.slice(-30), ontem = lista.at(-1), sete = lista.slice(-7);
    const media = sete.reduce((t, d) => t + d.valor, 0) / sete.length, recorde = lista.reduce((m, d) => (d.valor > m.valor ? d : m));
    const todosExatos = ult30.every((d) => d.exato), pre = (d) => (d.exato ? '' : '≥ ');
    let prox = '';
    if (ult?.experiencia != null && media > 0) { const falta = expLevel(ult.level + 1) - ult.experiencia; prox = kpi('Próximo level', `~${Math.max(1, Math.ceil(falta / media))} dia(s)`, ''); }
    // gráfico de barras
    const W = Math.max(520, el.clientWidth - 36 || 900), H = 230, L = 60, T = 16, B = 30, max = Math.max(...ult30.map((d) => d.valor), 1), bw = (W - L - 10) / Math.max(ult30.length, 7);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="XP farmada por dia">`;
    for (let i = 0; i <= 4; i++) { const v = (max * i) / 4; s += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="#2f2a21"/><text x="${L - 6}" y="${y(v) + 4}" fill="#a59a86" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
    ult30.forEach((d, i) => {
      const x = L + i * bw + bw * 0.15, h = Math.max(y(0) - y(d.valor), d.valor ? 1 : 0);
      if (!d.exato && !d.valor) { s += `<rect x="${x}" y="${y(0) - 3}" width="${bw * 0.7}" height="3" rx="1" fill="#5a5245"><title>${fmtData(d.dia)}: não subiu de level (XP abaixo de 1 level, sem número exato)</title></rect>`; }
      else s += `<rect x="${x}" y="${y(0) - h}" width="${bw * 0.7}" height="${h}" rx="2" fill="${d.exato ? '#e0b24c' : 'rgba(224,178,76,.45)'}"><title>${fmtData(d.dia)}: ${pre(d)}${fmt(d.valor)} XP${d.lvA !== d.lvB ? ` (level ${d.lvA} → ${d.lvB})` : ''}${d.dias > 1 ? ` · soma de ${d.dias} dias` : ''}</title></rect>`;
      if (ult30.length <= 10 || i % 5 === 4 || i === ult30.length - 1) s += `<text x="${x + bw * 0.35}" y="${H - 10}" fill="#a59a86" font-size="11" text-anchor="middle">${d.dia.slice(8)}/${d.dia.slice(5, 7)}</text>`;
    });
    s += '</svg>';
    el.innerHTML = topo + `<div class="grid linha-kpis">` +
      kpi('XP ontem', `${pre(ontem)}${fmtC(ontem.valor)}`, 'ouro') + kpi('Média 7 dias', `${todosExatos ? '' : '≥ '}${fmtC(media)}`) +
      kpi('Recorde', `${pre(recorde)}${fmtC(recorde.valor)}<small class="muted"> ${fmtData(recorde.dia).slice(0, 5)}</small>`) +
      kpi('Total 30 dias', `${todosExatos ? '' : '≥ '}${fmtC(ult30.reduce((t, d) => t + d.valor, 0))}`) + prox + `</div>` + s +
      (todosExatos ? '' : `<p class="dica">Barras claras com <b>≥</b> são a XP mínima, calculada pela subida de level, porque o personagem está fora do top 1000 do ranking do mundo (só ele mostra a XP exata). Para o número exato do dia, registre suas hunts com o XP do Hunt Analyzer.</p>`);
  }

  // card do topo: "XP ontem" real quando houver, senão a XP das hunts de hoje
  function marcarMini() {
    const d = diasFarmados().at(-1), mini = $('#card-char .pt-mini div'); if (!d || !mini) return;
    mini.innerHTML = `<span>XP ontem</span><b title="${d.exato ? 'XP exata do ranking' : 'XP mínima pela subida de level'}">${d.exato ? '' : '≥ '}${fmtC(d.valor)}</b>`;
  }

  const painelOriginal = window.renderPainel, persOriginal = window.renderPersonagem;
  window.renderPainel = function () { painelOriginal(); if (carregado) renderXp(); else carregar(); };
  window.renderPersonagem = function () { persOriginal(); if (carregado) marcarMini(); };
})();
