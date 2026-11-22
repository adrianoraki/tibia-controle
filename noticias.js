// TibiaHub — Notícias do Tibia.com traduzidas para o português (texto puro; nada de HTML vindo de fora)
(() => {
  const N = { carregado: false, lista: [], filtro: 'todas', ingles: new Set(), aberta: null };
  const CAT = { development: ['Desenvolvimento', '🛠️'], community: ['Comunidade', '👥'], cipsoft: ['CipSoft', '🏢'], technical: ['Técnico', '⚙️'], support: ['Suporte', '🛟'], technical_issues: ['Técnico', '⚙️'] };
  const urlOk = (u) => (typeof u === 'string' && /^https:\/\/www\.tibia\.com\/news\/\?subtopic=newsarchive&id=\d+$/.test(u) ? u : 'https://www.tibia.com/news/');
  const dataBR = (iso) => new Date(iso + 'T12:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const paragrafos = (t) => String(t || '').split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');

  async function carregar() {
    $('#noticias-app').innerHTML = '<div class="card"><div class="bloqueio">Carregando notícias…</div></div>';
    const { data, error } = await sb.from('noticias').select('id,data,tipo,categoria,titulo_en,titulo_pt,texto_en,texto_pt,url,traduzido_por').order('data', { ascending: false }).order('id', { ascending: false }).limit(60);
    if (error) return erro(error);
    N.lista = data || []; N.carregado = true; render(); marcarLidas();
  }
  // bolinha no menu quando chega notícia nova
  async function verificarNovas() {
    const { data } = await sb.from('noticias').select('id').order('id', { ascending: false }).limit(1);
    let vista = 0; try { vista = +localStorage.getItem('tc_noticia_vista') || 0; } catch { /* ok */ }
    $('#menu [data-pag=noticias]')?.classList.toggle('tem-novidade', !!data?.[0] && data[0].id > vista);
  }
  function marcarLidas() {
    const max = Math.max(0, ...N.lista.map((n) => n.id));
    try { localStorage.setItem('tc_noticia_vista', String(max)); } catch { /* ok */ }
    $('#menu [data-pag=noticias]')?.classList.remove('tem-novidade');
  }

  function texto(n) {
    const en = N.ingles.has(n.id) || !n.texto_pt;
    return { titulo: en ? n.titulo_en : n.titulo_pt || n.titulo_en, corpo: en ? n.texto_en : n.texto_pt, en };
  }
  function card(n) {
    const [cat, ico] = CAT[n.categoria] || ['Notícia', '📰'], t = texto(n), aberta = N.aberta === n.id, longo = (t.corpo || '').length > 700;
    return `<article class="nt-card ${aberta ? 'aberta' : ''}" data-id="${n.id}"><div class="nt-meta"><span class="nt-cat nt-${esc(n.categoria || 'outra')}">${ico} ${cat}</span><time>${dataBR(n.data)}</time>` +
      `${!n.texto_pt ? '<span class="nt-trad">tradução a caminho</span>' : ''}</div>` +
      `<h3 class="nt-tit">${esc(t.titulo)}</h3><div class="nt-corpo ${longo && !aberta ? 'cortado' : ''}">${paragrafos(t.corpo)}</div>` +
      `<div class="nt-pe">${longo ? `<button type="button" class="link" data-nt="abrir">${aberta ? 'Mostrar menos' : 'Ler tudo'}</button>` : ''}` +
      `${n.texto_pt ? `<button type="button" class="link" data-nt="idioma">${t.en ? 'Ver em português' : 'Ver original em inglês'}</button>` : ''}` +
      `<a href="${esc(urlOk(n.url))}" target="_blank" rel="noopener noreferrer">Abrir no Tibia.com ↗</a></div></article>`;
  }
  function render() {
    const el = $('#noticias-app'); if (!el) return;
    if (!N.lista.length) { el.innerHTML = '<div class="card"><div class="bloqueio">As notícias do Tibia.com estão sendo baixadas e traduzidas. Volte em alguns minutos.</div></div>'; return; }
    const cats = [...new Set(N.lista.filter((n) => n.tipo !== 'ticker').map((n) => n.categoria).filter(Boolean))];
    const grandes = N.lista.filter((n) => n.tipo !== 'ticker' && (N.filtro === 'todas' || n.categoria === N.filtro));
    const curtas = N.lista.filter((n) => n.tipo === 'ticker').slice(0, 12);
    el.innerHTML = `<div class="nt-grid"><div class="nt-col">` +
        `<div class="chips nt-filtros"><button class="chip ${N.filtro === 'todas' ? 'ativo' : ''}" data-nt-filtro="todas">Todas</button>${cats.map((c) => `<button class="chip ${N.filtro === c ? 'ativo' : ''}" data-nt-filtro="${esc(c)}">${(CAT[c] || [c])[0]}</button>`).join('')}</div>` +
        (grandes.length ? grandes.map(card).join('') : '<div class="card"><div class="bloqueio">Nenhuma notícia nesta categoria.</div></div>') +
      `</div><aside class="nt-lado card"><h2>Notícias rápidas</h2>${curtas.length ? curtas.map((n) => { const t = texto(n);
          return `<div class="nt-curta" data-id="${n.id}"><time>${dataBR(n.data)}</time><div>${esc(t.corpo || t.titulo)}</div><div class="nt-pe">${n.texto_pt ? `<button type="button" class="link" data-nt="idioma">${t.en ? 'português' : 'inglês'}</button>` : ''}<a href="${esc(urlOk(n.url))}" target="_blank" rel="noopener noreferrer">Tibia.com ↗</a></div></div>`; }).join('')
        : '<div class="muted">Sem notícias rápidas.</div>'}</aside></div>` +
      `<p class="dica">Notícias oficiais do <a href="https://www.tibia.com/news/" target="_blank" rel="noopener noreferrer">Tibia.com</a> (© CipSoft GmbH), obtidas pela TibiaData e traduzidas automaticamente para o português${N.lista.some((n) => n.traduzido_por) ? ` (${esc([...new Set(N.lista.map((n) => n.traduzido_por).filter(Boolean))].join(', '))})` : ''}. A tradução pode ter erros: em caso de dúvida, vale o texto original.</p>`;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=noticias]')) { if (!N.carregado) carregar(); else { render(); marcarLidas(); } return; }
    const f = e.target.closest('[data-nt-filtro]'); if (f) { N.filtro = f.dataset.ntFiltro; render(); return; }
    const b = e.target.closest('[data-nt]'); if (!b || !$('#noticias-app').contains(b)) return;
    const id = +b.closest('[data-id]').dataset.id;
    if (b.dataset.nt === 'abrir') N.aberta = N.aberta === id ? null : id;
    if (b.dataset.nt === 'idioma') { if (N.ingles.has(id)) N.ingles.delete(id); else N.ingles.add(id); }
    render();
  });
  window.verificarNoticias = verificarNovas;
})();
