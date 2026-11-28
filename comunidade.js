// TibiaHub — Comunidade: hunts que rendem, termômetro do Market e builds da roda, com dados anônimos de quem escolheu compartilhar.
// O servidor só devolve médias de grupos com 3+ jogadores diferentes (nunca nome, personagem ou user_id). Texto externo passa por esc().
(() => {
  const C = { aba: 'hunts', voc: null, faixa: 0, mundo: 'meu', cache: {}, carregando: false };
  const VOCS = [['knight', 'Knight'], ['paladin', 'Paladin'], ['sorcerer', 'Sorcerer'], ['druid', 'Druid'], ['monk', 'Monk']];
  const FAIXAS = [['Todos os levels', 1, 5000], ['8 a 99', 8, 99], ['100 a 299', 100, 299], ['300 a 499', 300, 499], ['500 a 799', 500, 799], ['800+', 800, 5000]];
  const vocMinha = () => { const v = String(S.perfil?.vocacao || '').toLowerCase(); return (VOCS.find(([k]) => v.includes(k)) || [null])[0]; };
  const num = (x, d = 0) => Number(x).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const k = (x) => (x == null ? '—' : fmtC(x));

  function optin() {
    const on = !!S.perfil?.compartilhar;
    return `<div class="card cm-optin ${on ? 'on' : ''}">
      <div><b>${on ? '✅ Você está ajudando a comunidade' : '🤝 Ajude a comunidade com seus dados anônimos'}</b>
      <p class="muted">${on ? 'Suas hunts, preços anotados do Market e rodas salvas entram nas médias abaixo, sem nome e sem personagem. Pode desligar quando quiser.'
        : 'Quem liga entra nas médias (XP/h e lucro/h das hunts, preços do Market, rodas da Roda do Destino). Nada mostra seu nome ou personagem, e uma média só aparece quando tem pelo menos 3 jogadores.'}</p></div>
      <button type="button" class="btn ${on ? 'sec' : ''}" data-cm-optin="${on ? '0' : '1'}">${on ? 'Parar de compartilhar' : 'Quero compartilhar'}</button></div>`;
  }
  const filtros = (comVoc, comMundo) => `<div class="cm-filtros">
    ${comVoc ? `<label>Vocação<select data-cm-f="voc">${VOCS.map(([id, n]) => `<option value="${id}" ${C.voc === id ? 'selected' : ''}>${n}</option>`).join('')}${C.aba === 'hunts' ? `<option value="" ${!C.voc ? 'selected' : ''}>Todas</option>` : ''}</select></label>
    <label>Level<select data-cm-f="faixa">${FAIXAS.map(([n], i) => `<option value="${i}" ${C.faixa === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
    ${comMundo ? `<label>Mundo<select data-cm-f="mundo"><option value="meu" ${C.mundo === 'meu' ? 'selected' : ''}>${esc(S.perfil?.mundo || 'Meu mundo')}</option><option value="todos" ${C.mundo === 'todos' ? 'selected' : ''}>Todos os mundos</option></select></label>` : ''}</div>`;
  const vazio = (txt) => `<div class="bloqueio cm-vazio">📭 ${txt}<br><small class="muted">Os números aparecem quando pelo menos 3 jogadores que compartilham tiverem dados aqui. Chame seus amigos e a sua guild para o TibiaHub!</small></div>`;

  async function buscar(chave, fn, args) {
    if (C.cache[chave]) return C.cache[chave];
    const { data, error } = await sb.rpc(fn, args);
    if (error) { erro(error); return []; }
    return (C.cache[chave] = data || []);
  }

  async function abaHunts() {
    const [, lo, hi] = FAIXAS[C.faixa], lista = await buscar(`h:${C.voc}:${C.faixa}`, 'comunidade_hunts', { p_voc: C.voc || null, p_lvl_min: lo, p_lvl_max: hi });
    const top = Math.max(1, ...lista.map((x) => x.lucro_h || 0)), topX = Math.max(1, ...lista.map((x) => x.xp_h || 0));
    return `<div class="card"><div class="cm-cab"><h3>🗡️ Hunts que estão rendendo</h3>${filtros(true, false)}</div>
      <p class="muted">Médias dos últimos 120 dias, por hora de hunt. O level é o atual de quem registrou.</p>
      ${lista.length ? `<div class="tabela-wrap"><table class="cm-tab"><tr><th>Hunt</th><th class="num">Lucro/h</th><th class="num">XP/h</th><th class="num">Jogadores</th><th class="num">Hunts</th><th class="num">Level médio</th></tr>
        ${lista.map((x) => `<tr><td><b>${esc(x.local)}</b></td>
          <td class="num"><span class="cm-barra" style="--p:${Math.max(0, (x.lucro_h || 0) / top) * 100}%"></span><b class="${(x.lucro_h || 0) >= 0 ? 'pos' : 'neg'}">${k(x.lucro_h)}</b></td>
          <td class="num"><span class="cm-barra az" style="--p:${((x.xp_h || 0) / topX) * 100}%"></span>${k(x.xp_h)}</td>
          <td class="num">${fmt(x.jogadores)}</td><td class="num">${fmt(x.hunts)}</td><td class="num">${x.lvl_medio ? fmt(x.lvl_medio) : '—'}</td></tr>`).join('')}</table></div>`
        : vazio('Ainda não tem hunts suficientes para esse filtro.')}</div>`;
  }

  async function abaMarket() {
    const mundo = C.mundo === 'meu' ? S.perfil?.mundo || null : null, lista = await buscar(`m:${mundo}`, 'comunidade_market', { p_mundo: mundo });
    const comVar = lista.map((x) => ({ ...x, var: x.mediana && x.mediana_antes ? ((x.mediana - x.mediana_antes) / x.mediana_antes) * 100 : null }));
    const subindo = comVar.filter((x) => x.var > 5).sort((a, b) => b.var - a.var).slice(0, 6), caindo = comVar.filter((x) => x.var < -5).sort((a, b) => a.var - b.var).slice(0, 6);
    const npc = (nome) => { const p = typeof melhorPreco === 'function' ? melhorPreco(nome) : null; return p ? p.preco : null; };
    const card = (x) => { const n = npc(x.item); return `<li><span class="item-nome">${imgDoItem(x.item)}${esc(x.item)}</span><b class="${x.var > 0 ? 'pos' : 'neg'}">${x.var > 0 ? '▲' : '▼'} ${num(Math.abs(x.var), 0)}%</b><small class="muted">${k(x.mediana)} agora${n && n >= x.mediana ? ' · NPC paga mais!' : ''}</small></li>`; };
    return `<div class="card"><div class="cm-cab"><h3>📈 Termômetro do Market</h3>${filtros(false, true)}</div>
      <p class="muted">Preço do meio (mediana) dos últimos 30 dias comparado com os 30 dias antes, com os preços anotados e as compras de quem compartilha.</p>
      ${lista.length ? `<div class="cm-termo"><div><h4>Subindo</h4><ul class="cm-mov">${subindo.map(card).join('') || '<li class="muted">Nada subindo forte agora.</li>'}</ul></div>
        <div><h4>Caindo</h4><ul class="cm-mov">${caindo.map(card).join('') || '<li class="muted">Nada caindo forte agora.</li>'}</ul></div></div>
        <div class="tabela-wrap"><table class="cm-tab" id="cm-tab-market"><tr><th>Item</th><th class="num">Agora</th><th class="num">30 dias antes</th><th class="num">Variação</th><th class="num">NPC paga</th><th class="num">Registros</th></tr>
        ${comVar.map((x) => { const n = npc(x.item); return `<tr><td><span class="item-nome">${imgDoItem(x.item)}${esc(x.item)}</span></td><td class="num"><b>${k(x.mediana)}</b></td><td class="num muted">${k(x.mediana_antes)}</td>
          <td class="num ${x.var > 0 ? 'pos' : x.var < 0 ? 'neg' : 'muted'}">${x.var == null ? '—' : `${x.var > 0 ? '+' : ''}${num(x.var, 0)}%`}</td><td class="num ${n && x.mediana && n >= x.mediana ? 'pos' : 'muted'}">${n ? fmtC(n) : '—'}</td><td class="num">${fmt(x.registros)}</td></tr>`; }).join('')}</table></div>`
        : vazio('Ainda não tem preços suficientes nesse mundo.')}</div>`;
  }

  async function abaBuilds() {
    const v = C.voc || 'knight', [, lo, hi] = FAIXAS[C.faixa], r = (await buscar(`b:${v}:${C.faixa}`, 'comunidade_builds', { p_voc: v, p_lvl_min: lo, p_lvl_max: hi }))[0];
    let corpo = vazio('Ainda não tem rodas salvas suficientes para essa vocação e level.');
    if (r && Array.isArray(r.fatias) && typeof RODA_OF !== 'undefined') {
      const nomes = RODA_OF.cantos[v].map((g) => RODA_OF.grandes[g][0]), RQ = ['TL', 'TR', 'BL', 'BR'], SETA = ['↖', '↗', '↙', '↘'];
      const dom = [0, 0, 0, 0]; r.fatias.forEach((x, i) => { dom[RQ.indexOf(RODA_OF.ids[i].slice(1, 3))] += +x || 0; });
      const tot = Math.max(1, dom.reduce((a, b) => a + b, 0)), QN = ['sem gema', 'Lesser', 'Regular', 'Greater'];
      const fortes = r.fatias.map((x, i) => [i, +x / RODA_OF.max[i]]).filter(([, f]) => f >= 0.8).map(([i]) => RODA_OF.medios[RODA_OF.voc[v][i][2]]?.[0]).filter(Boolean);
      corpo = `<p>Média de <b>${fmt(r.jogadores)}</b> rodas salvas no Oráculo IA · level médio ${r.lvl_medio ? fmt(r.lvl_medio) : '—'}</p>
        <div class="cm-doms">${dom.map((p, q) => `<div class="cm-dom"><span>${SETA[q]} ${esc(nomes[q])}</span><div class="cm-dom-b"><i style="width:${(p / tot) * 100}%"></i></div><b>${fmt(Math.round(p))} pts</b>
          <small class="muted">gema ${r.gemas && r.gemas[q] != null ? `${QN[Math.round(r.gemas[q])]} (média ${num(+r.gemas[q], 1)})` : '—'}</small></div>`).join('')}</div>
        ${fortes.length ? `<p class="muted">Fatias que quase todo mundo enche: ${[...new Set(fortes)].map((n) => `<b>${esc(n)}</b>`).join(', ')}.</p>` : ''}
        <p class="dica">Quer comparar com a sua? Abra <button type="button" class="link" data-ir="magias">Magias ➜ Roda ➜ 🔮 Oráculo IA</button> e salve a sua roda.</p>`;
    }
    return `<div class="card"><div class="cm-cab"><h3>☸️ Builds que a comunidade usa</h3>${filtros(true, false)}</div>${corpo}</div>`;
  }

  async function render() {
    const el = $('#comunidade-app'); if (!el || !S.perfil) return;
    if (C.voc === null) C.voc = vocMinha() || 'knight';
    const abas = [['hunts', '🗡️ Hunts'], ['market', '📈 Market'], ['builds', '☸️ Builds']];
    el.innerHTML = `${optin()}<div class="cm-abas" role="tablist">${abas.map(([id, n]) => `<button type="button" role="tab" aria-selected="${C.aba === id}" class="chip ${C.aba === id ? 'ativo' : ''}" data-cm-aba="${id}">${n}</button>`).join('')}</div>
      <div id="cm-corpo"><div class="card"><div class="bloqueio">Carregando…</div></div></div>`;
    const html = C.aba === 'market' ? await abaMarket() : C.aba === 'builds' ? await abaBuilds() : await abaHunts();
    const corpo = $('#cm-corpo'); if (corpo) corpo.innerHTML = html + '<p class="dica">Dados anônimos de jogadores do TibiaHub que escolheram compartilhar. Médias só com 3+ jogadores diferentes. Imagens de itens: TibiaWiki (CC BY-SA).</p>';
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#menu [data-pag=comunidade]')) { render(); return; }
    const aba = e.target.closest('#comunidade-app [data-cm-aba]');
    if (aba) { C.aba = aba.dataset.cmAba; if (C.aba !== 'hunts' && !C.voc) C.voc = vocMinha() || 'knight'; render(); return; }
    const op = e.target.closest('#comunidade-app [data-cm-optin]');
    if (op) {
      const quer = op.dataset.cmOptin === '1';
      if (!quer && !await confirmar('Parar de compartilhar?', 'Seus dados saem das médias da comunidade na hora. Você continua vendo as páginas.', { ok: 'Parar' })) return;
      op.disabled = true;
      const { data, error } = await sb.from('profiles').update({ compartilhar: quer }).eq('id', S.user.id).select('compartilhar').single();
      if (error) { op.disabled = false; return erro(error); }
      S.perfil.compartilhar = data.compartilhar; C.cache = {};
      toast(quer ? 'Obrigado! Seus dados anônimos já entram nas médias.' : 'Pronto: seus dados não entram mais nas médias.');
      render();
    }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('#comunidade-app [data-cm-f]'); if (!f) return;
    const k2 = f.dataset.cmF;
    if (k2 === 'voc') C.voc = VOCS.some(([id]) => id === f.value) ? f.value : '';
    else if (k2 === 'faixa') C.faixa = Math.max(0, Math.min(FAIXAS.length - 1, +f.value || 0));
    else if (k2 === 'mundo') C.mundo = f.value === 'todos' ? 'todos' : 'meu';
    render();
  });
})();
