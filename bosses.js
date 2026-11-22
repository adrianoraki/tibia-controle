// TibiaControle — Boss Tracker: bosses que aparecem sozinhos (raids e bosses únicos), por mundo.
// Os dados vêm das kill statistics oficiais (via TibiaData), guardadas pelo robô todo dia depois do server save.
(() => {
  const B = { carregado: false, mundo: null, mundos: [], cat: new Map(), mortes: [], coletas: [], filtro: 'todos', ordem: 'recente', busca: '' };
  const JANELA = 30;
  const diaTibia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() - 10 * 3600e3));
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dif = (a, b) => Math.round((new Date(b + 'T12:00Z') - new Date(a + 'T12:00Z')) / 864e5);
  const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const arquivo = (n) => String(n).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  // imagem oficial do Tibia.com (endereço vindo da TibiaData); sem ela, tenta o nome do arquivo e depois mostra um ícone
  const urlOk = (u) => (typeof u === 'string' && /^https:\/\/static\.tibia\.com\/[\w./-]+$/.test(u) ? u : null);
  const img = (n, u) => `<img class="boss-img" src="${esc(urlOk(u) || `https://static.tibia.com/images/library/${arquivo(n)}.gif`)}" ${urlOk(u) ? '' : `data-alt="${arquivo(String(n).replace(/^the\s+/i, ''))}"`} alt="" loading="lazy" width="64" height="64">`;
  const CLASSE = { Nemesis: 'Nêmesis', Archfoe: 'Arqui-inimigo', Bane: 'Flagelo' };

  async function carregarBase() {
    const [m, c] = await Promise.all([
      sb.from('mundos').select('nome,regiao,pvp').order('nome'),
      sb.from('criaturas').select('nome,plural,boss,classe,hp,exp,spawn,imagem').eq('rastrear', true).limit(1000),
    ]);
    B.mundos = m.data || [];
    B.cat = new Map();
    for (const x of c.data || []) { B.cat.set(x.nome.toLowerCase(), x); if (x.plural) B.cat.set(x.plural.toLowerCase(), x); }
    if (!B.mundo) {
      let salvo = null; try { salvo = localStorage.getItem('tc_boss_mundo'); } catch { /* ok */ }
      const nomes = new Set(B.mundos.map((w) => w.nome));
      B.mundo = [salvo, S.perfil?.mundo].find((w) => w && nomes.has(w)) || B.mundos[0]?.nome || null;
    }
  }
  async function carregarMundo() {
    if (!B.mundo) return;
    const desde = somaDia(diaTibia(), -(JANELA + 8));
    const [r, k] = await Promise.all([
      sb.from('boss_mortes').select('data,boss,mortos_dia,mortos_semana,jogadores_dia').eq('mundo', B.mundo).gte('data', desde).order('data').limit(5000),
      sb.from('boss_coleta').select('data').eq('mundo', B.mundo).gte('data', desde).order('data'),
    ]);
    B.mortes = r.data || []; B.coletas = (k.data || []).map((x) => x.data);
  }
  async function carregar() {
    $('#bosses-app').innerHTML = '<div class="bloqueio">Carregando bosses…</div>';
    try { await carregarBase(); await carregarMundo(); B.carregado = true; render(); }
    catch (e) { erro(e); }
  }

  // ---------- números por boss ----------
  function montar() {
    const ontem = somaDia(diaTibia(), -1), dias = [];
    for (let k = JANELA - 1; k >= 0; k--) dias.push(somaDia(ontem, -k));
    const coletados = new Set(B.coletas), inicio = B.coletas[0] || null;
    const por = new Map();
    for (const m of B.mortes) {
      const c = B.cat.get(m.boss.toLowerCase());
      if (!c) continue;                                    // fora do catálogo de bosses
      const nome = c?.nome || m.boss;
      const b = por.get(nome) || { nome, c, vistos: new Map(), semana: 0, ultSemana: null };
      if (m.mortos_dia > 0) b.vistos.set(m.data, (b.vistos.get(m.data) || 0) + m.mortos_dia);
      if (m.mortos_semana > 0 && (!b.ultSemana || m.data > b.ultSemana)) { b.ultSemana = m.data; b.semana = m.mortos_semana; }
      por.set(nome, b);
    }
    // bosses do catálogo que nunca apareceram neste mundo desde o início da coleta
    for (const c of new Set(B.cat.values())) if (!por.has(c.nome)) por.set(c.nome, { nome: c.nome, c, vistos: new Map(), semana: 0, ultSemana: null });
    const lista = [...por.values()].map((b) => {
      const datas = [...b.vistos.keys()].sort(), ult = datas.at(-1) || null;
      const intervalos = datas.slice(1).map((d, i) => dif(datas[i], d)).filter((x) => x > 0);
      return { ...b, datas, ult, ha: ult ? dif(ult, ontem) : null, vezes30: datas.filter((d) => d >= dias[0]).length,
        media: intervalos.length ? intervalos.reduce((t, x) => t + x, 0) / intervalos.length : null,
        semanaAntes: !ult && b.semana > 0 };          // só sabemos que apareceu "na semana" (antes da coleta diária começar)
    });
    return { lista, dias, coletados, inicio, ontem };
  }

  // ---------- desenho ----------
  function status(b, inicio) {
    if (b.ha === 0) return '<span class="bt-st st-ontem">● visto ontem</span>';
    if (b.ult) return `<span class="bt-st st-visto">visto há ${b.ha} dia${b.ha > 1 ? 's' : ''}</span>`;
    if (b.semanaAntes) return '<span class="bt-st st-semana">visto na última semana</span>';
    return `<span class="bt-st st-nada">sem registro${inicio ? ` desde ${dm(inicio)}` : ''}</span>`;
  }
  function trilha(b, dias, coletados) {
    return `<div class="bt-trilha" aria-hidden="true">${dias.map((d) => `<i class="${b.vistos.has(d) ? 'v' : coletados.has(d) ? 'n' : 'x'}" title="${dm(d)}: ${b.vistos.has(d) ? `morto ${b.vistos.get(d)}×` : coletados.has(d) ? 'não apareceu' : 'sem dado'}"></i>`).join('')}</div>`;
  }
  function cartao(b, dias, coletados, inicio) {
    const c = b.c || {};
    return `<article class="bt-card${b.ha === 0 ? ' ontem' : ''}"><div class="bt-cab">${img(b.nome, c.imagem)}<div class="bt-nome"><b>${esc(b.nome)}</b>` +
      `<small class="muted">${[CLASSE[c.classe] ? esc(CLASSE[c.classe]) : '', c.hp ? `${fmtC(c.hp)} HP` : '', c.exp ? `${fmtC(c.exp)} XP` : ''].filter(Boolean).join(' · ') || '&nbsp;'}</small>${status(b, inicio)}</div></div>` +
      trilha(b, dias, coletados) +
      `<div class="bt-pe"><span><b>${b.vezes30}</b> ${b.vezes30 === 1 ? 'dia' : 'dias'} com morte em ${JANELA} dias</span>${b.media ? `<span>a cada ~<b>${b.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> dias</span>` : ''}</div></article>`;
  }

  function render() {
    const el = $('#bosses-app'); if (!el) return;
    if (!B.mundos.length || !B.cat.size) { el.innerHTML = '<div class="card"><div class="bloqueio">O robô está montando a lista de mundos e de bosses a partir da TibiaWiki. Volte em alguns minutos.</div></div>'; return; }
    const { lista, dias, coletados, inicio, ontem } = montar();
    const q = B.busca.trim().toLowerCase();
    let vis = lista.filter((b) => (!q || b.nome.toLowerCase().includes(q)) &&
      (B.filtro === 'todos' || (B.filtro === 'vistos' && (b.ult || b.semanaAntes)) || (B.filtro === 'sumidos' && !b.ult)));
    const ord = { recente: (a, b) => (a.ha ?? 1e9) - (b.ha ?? 1e9) || (b.semanaAntes - a.semanaAntes) || a.nome.localeCompare(b.nome),
      sumido: (a, b) => (b.ha ?? 1e9) - (a.ha ?? 1e9) || a.nome.localeCompare(b.nome), nome: (a, b) => a.nome.localeCompare(b.nome) };
    vis.sort(ord[B.ordem] || ord.recente);
    const deOntem = lista.filter((b) => b.ha === 0).sort((a, b) => (b.vistos.get(ontem) || 0) - (a.vistos.get(ontem) || 0));
    const linhaOntem = B.mortes.filter((m) => m.data === ontem);
    const jog = linhaOntem.reduce((t, m) => t + (B.cat.get(m.boss.toLowerCase()) ? m.jogadores_dia : 0), 0);
    const temOntem = coletados.has(ontem), w = B.mundos.find((x) => x.nome === B.mundo);
    const totVistos = lista.filter((b) => b.vezes30 > 0).length;

    el.innerHTML = `<div class="card bt-topo"><div class="bt-filtros">` +
        `<label>Mundo <select data-bt="mundo">${B.mundos.map((x) => `<option ${x.nome === B.mundo ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>` +
        `<label>Buscar <input type="search" data-bt="busca" placeholder="nome do boss" value="${esc(B.busca)}" maxlength="40"></label>` +
        `<div class="seg" role="group" aria-label="Filtro">${[['todos', 'Todos'], ['vistos', 'Já apareceram'], ['sumidos', 'Sumidos']].map(([k, t]) => `<button type="button" data-bt-filtro="${k}" class="${B.filtro === k ? 'ativo' : ''}" aria-pressed="${B.filtro === k}">${t}</button>`).join('')}</div>` +
        `<label>Ordenar <select data-bt="ordem"><option value="recente" ${B.ordem === 'recente' ? 'selected' : ''}>Visto mais recente</option><option value="sumido" ${B.ordem === 'sumido' ? 'selected' : ''}>Mais tempo sumido</option><option value="nome" ${B.ordem === 'nome' ? 'selected' : ''}>Nome</option></select></label>` +
      `</div><div class="grid linha-kpis bt-kpis">` +
        kpi('Mundo', `${esc(B.mundo)}<small class="muted"> ${esc(w?.regiao || '')}</small>`) +
        kpi('Bosses ontem', temOntem ? String(deOntem.length) : '—', 'ouro') +
        kpi(`Apareceram em ${JANELA} dias`, `${totVistos}<small class="muted"> de ${lista.length}</small>`) +
        kpi('Jogadores mortos por eles ontem', temOntem ? fmt(jog) : '—') +
        kpi('Histórico desde', inicio ? fmtData(inicio) : '—') + `</div></div>` +

      `<div class="card bt-ontem"><div class="card-topo"><h2>Ontem em ${esc(B.mundo)}</h2><span class="muted">${fmtData(ontem)} · dia que terminou no último server save</span></div>` +
        (!temOntem ? '<div class="bloqueio">As mortes de ontem chegam depois do server save (por volta das 6h20 de Brasília). O robô tenta até as 9h55.</div>'
          : deOntem.length ? `<div class="bt-ontem-lista">${deOntem.map((b) => `<div class="bt-mini">${img(b.nome, b.c?.imagem)}<b>${esc(b.nome)}</b><span class="bt-qtd">${b.vistos.get(ontem)}× morto</span></div>`).join('')}</div>`
            : '<div class="bloqueio">Nenhum boss rastreado foi morto ontem neste mundo.</div>') + `</div>` +

      `<div class="card"><div class="card-topo"><h2>Todos os bosses</h2><span class="muted">${vis.length} na lista</span></div>` +
        `<div class="bt-leg"><span><i class="v"></i> morto no dia</span><span><i class="n"></i> não apareceu</span><span><i class="x"></i> sem dado</span><span class="muted">cada quadrinho é um dia, do mais antigo (esquerda) até ontem</span></div>` +
        (vis.length ? `<div class="bt-grade">${vis.map((b) => cartao(b, dias, coletados, inicio)).join('')}</div>` : '<div class="bloqueio">Nenhum boss com esse filtro.</div>') +
        `<p class="dica">O Boss Tracker acompanha bosses que aparecem sozinhos no mapa (raids e bosses únicos), a partir das estatísticas de mortes oficiais do Tibia. ` +
        `Se ninguém matar o boss, ele não aparece nas estatísticas, então "não apareceu" quer dizer "ninguém matou". O intervalo médio fica mais confiável com o passar das semanas.</p></div>`;
  }

  // ---------- eventos ----------
  document.addEventListener('change', async (e) => {
    const t = e.target.closest?.('[data-bt]'); if (!t || !$('#bosses-app')?.contains(t)) return;
    if (t.dataset.bt === 'mundo') {
      if (!B.mundos.some((w) => w.nome === t.value)) return;
      B.mundo = t.value; try { localStorage.setItem('tc_boss_mundo', B.mundo); } catch { /* ok */ }
      $('#bosses-app').classList.add('carregando'); await carregarMundo(); $('#bosses-app').classList.remove('carregando'); render();
    } else if (t.dataset.bt === 'ordem') { B.ordem = t.value; render(); }
  });
  let tb; document.addEventListener('input', (e) => {
    if (!e.target.matches?.('#bosses-app [data-bt=busca]')) return;
    clearTimeout(tb); tb = setTimeout(() => { B.busca = e.target.value.slice(0, 40); render(); const i = $('#bosses-app [data-bt=busca]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200);
  });
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-bt-filtro]'); if (f) { B.filtro = f.dataset.btFiltro; render(); return; }
    if (e.target.closest('#menu [data-pag=bosses]')) { if (!B.carregado) carregar(); else render(); }
  });
  // imagem que não existir: tenta sem "The", depois vira um ícone
  document.addEventListener('error', (e) => {
    const i = e.target; if (!(i instanceof HTMLImageElement) || !i.classList.contains('boss-img')) return;
    if (i.dataset.alt && !i.dataset.tentou && !i.src.endsWith(`/${i.dataset.alt}.gif`)) { i.dataset.tentou = '1'; i.src = `https://static.tibia.com/images/library/${i.dataset.alt}.gif`; return; }
    i.replaceWith(Object.assign(document.createElement('span'), { className: 'boss-img boss-ico', textContent: '💀' }));
  }, true);
})();
