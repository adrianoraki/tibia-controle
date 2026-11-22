// TibiaHub — Mapa de monstros: mapa do Tibia por andar (TibiaMaps.io, MIT) com os lugares de cada criatura
// (coordenadas da TibiaWiki e marcadores da comunidade do TibiaMaps). Todo texto vindo de fora passa por esc().
(() => {
  const B = { xMin: 31744, yMin: 30976, w: 2560, h: 2048 };
  const IMG = (z) => `https://tibiamaps.github.io/tibia-map-data/floor-${String(z).padStart(2, '0')}-map.png`;
  const M = { carregado: false, criaturas: [], marcadores: [], z: 7, s: 1, tx: 0, ty: 0, sel: null, pontos: [], busca: '' };
  const nomeAndar = (z) => (z === 7 ? 'térreo' : z < 7 ? `+${7 - z} (acima)` : `−${z - 7} (subsolo)`);
  const limpaWiki = (t) => String(t || '')
    .replace(/\{\{Mapper Coords[^}]*\}\}/gi, '📍')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();

  async function carregar() {
    $('#mapa-app').innerHTML = '<div class="card"><div class="bloqueio">Carregando o mapa…</div></div>';
    try {
      const lista = [];
      for (let de = 0; de < 6000; de += 1000) {
        const { data, error } = await sb.from('criaturas').select('nome,plural,hp,exp,boss,imagem_wiki').order('nome').range(de, de + 999);
        if (error) throw error; lista.push(...data); if (data.length < 1000) break;
      }
      M.criaturas = lista;
      const r = await fetch('/dados/marcadores.json', { cache: 'force-cache' });
      M.marcadores = r.ok ? await r.json() : [];
      M.carregado = true; montar();
      const pedido = sessionStorage.getItem('tc_mapa_criatura'); if (pedido) { sessionStorage.removeItem('tc_mapa_criatura'); escolher(pedido); }
    } catch (e) { erro(e); }
  }

  // ---------- tela ----------
  function montar() {
    $('#mapa-app').innerHTML = `<div class="mp-grid">
      <aside class="card mp-lado">
        <label class="mp-busca">Buscar criatura<input type="search" id="mp-busca" placeholder="ex: Dragon, Hellspawn, Yeti" autocomplete="off" maxlength="40"></label>
        <div id="mp-resultados" class="mp-resultados"></div>
        <div id="mp-info" class="mp-info"><p class="muted">Escolha uma criatura para ver onde ela aparece. Você também pode arrastar o mapa, usar a roda do mouse para zoom e trocar de andar.</p>
          <p class="muted">${fmt(M.criaturas.length)} criaturas no catálogo · ${fmt(M.marcadores.length)} marcadores no mapa.</p></div>
      </aside>
      <section class="card mp-mapa">
        <div class="mp-barra"><div class="mp-andares" role="group" aria-label="Andar">${Array.from({ length: 16 }, (_, z) => `<button type="button" data-mp-z="${z}" title="Andar ${z} (${nomeAndar(z)})">${z === 7 ? '7·T' : z}</button>`).join('')}</div>
          <div class="mp-zoom"><button type="button" data-mp="menos" aria-label="Diminuir zoom">−</button><button type="button" data-mp="mais" aria-label="Aumentar zoom">+</button><button type="button" data-mp="tudo" title="Ver o mapa inteiro">⤢</button></div></div>
        <div class="mp-vista" id="mp-vista"><div class="mp-camada" id="mp-camada"><img id="mp-img" alt="Mapa do Tibia" width="${B.w}" height="${B.h}" draggable="false"><div id="mp-pontos"></div></div>
          <div class="mp-coord" id="mp-coord"></div><div class="mp-carregando hidden" id="mp-carregando">carregando andar…</div></div>
        <p class="dica">Mapa: <a href="https://tibiamaps.io" target="_blank" rel="noopener noreferrer">TibiaMaps.io</a> (MIT) · Locais das criaturas: <a href="https://tibia.fandom.com" target="_blank" rel="noopener noreferrer">TibiaWiki</a> (CC BY-SA) e marcadores do TibiaMaps. Tibia © CipSoft GmbH.</p>
      </section></div>`;
    ligarVista(); trocarAndar(M.z, false); enquadrarTudo();
  }

  function aplicar() {
    const c = $('#mp-camada'); if (!c) return;
    c.style.transform = `translate(${M.tx}px,${M.ty}px) scale(${M.s})`;
    c.style.setProperty('--inv', String(1 / M.s));
  }
  function limitar() {
    const v = $('#mp-vista').getBoundingClientRect(), mw = B.w * M.s, mh = B.h * M.s;
    M.tx = Math.min(v.width * 0.5, Math.max(v.width * 0.5 - mw, M.tx)); M.ty = Math.min(v.height * 0.5, Math.max(v.height * 0.5 - mh, M.ty));
  }
  function zoomEm(fator, cx, cy) {
    const s2 = Math.min(8, Math.max(0.15, M.s * fator)), k = s2 / M.s;
    M.tx = cx - (cx - M.tx) * k; M.ty = cy - (cy - M.ty) * k; M.s = s2; limitar(); aplicar();
  }
  function enquadrarTudo() {
    const v = $('#mp-vista').getBoundingClientRect(); M.s = Math.min(v.width / B.w, v.height / B.h);
    M.tx = (v.width - B.w * M.s) / 2; M.ty = (v.height - B.h * M.s) / 2; aplicar();
  }
  function centrar(x, y, z, s = 3) {
    if (z !== M.z) trocarAndar(z);
    const v = $('#mp-vista').getBoundingClientRect(); M.s = s;
    M.tx = v.width / 2 - (x - B.xMin) * s; M.ty = v.height / 2 - (y - B.yMin) * s; limitar(); aplicar();
  }
  function trocarAndar(z, manter = true) {
    M.z = Math.min(15, Math.max(0, z));
    const img = $('#mp-img'); $('#mp-carregando').classList.remove('hidden');
    img.onload = img.onerror = () => $('#mp-carregando')?.classList.add('hidden');
    img.src = IMG(M.z);
    $$('[data-mp-z]').forEach((b) => b.classList.toggle('ativo', +b.dataset.mpZ === M.z));
    desenharPontos(); if (!manter) aplicar();
  }
  function desenharPontos() {
    const el = $('#mp-pontos'); if (!el) return;
    el.innerHTML = M.pontos.filter((p) => p.z === M.z).map((p, i) => `<button type="button" class="mp-ponto ${p.fonte}" style="left:${p.x - B.xMin}px;top:${p.y - B.yMin}px" data-mp-ponto="${M.pontos.indexOf(p)}" title="${esc(p.rotulo)}"><span></span></button>`).join('');
    $$('[data-mp-z]').forEach((b) => b.classList.toggle('tem', M.pontos.some((p) => p.z === +b.dataset.mpZ)));
  }

  function ligarVista() {
    const v = $('#mp-vista'); let arrasto = null;
    v.addEventListener('pointerdown', (e) => { if (e.target.closest('.mp-ponto')) return; arrasto = { x: e.clientX, y: e.clientY, tx: M.tx, ty: M.ty }; v.setPointerCapture(e.pointerId); v.classList.add('arrastando'); });
    v.addEventListener('pointermove', (e) => {
      const r = v.getBoundingClientRect(), mx = (e.clientX - r.left - M.tx) / M.s, my = (e.clientY - r.top - M.ty) / M.s;
      $('#mp-coord').textContent = mx >= 0 && my >= 0 && mx < B.w && my < B.h ? `${Math.floor(mx + B.xMin)}, ${Math.floor(my + B.yMin)}, ${M.z}` : '';
      if (!arrasto) return; M.tx = arrasto.tx + e.clientX - arrasto.x; M.ty = arrasto.ty + e.clientY - arrasto.y; limitar(); aplicar();
    });
    const fim = () => { arrasto = null; v.classList.remove('arrastando'); };
    v.addEventListener('pointerup', fim); v.addEventListener('pointercancel', fim);
    v.addEventListener('wheel', (e) => { e.preventDefault(); const r = v.getBoundingClientRect(); zoomEm(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }

  // ---------- criatura ----------
  function resultados(q) {
    const el = $('#mp-resultados'); if (!el) return;
    q = q.trim().toLowerCase();
    if (q.length < 2) { el.innerHTML = ''; return; }
    const achou = M.criaturas.filter((c) => c.nome.toLowerCase().includes(q)).sort((a, b) => (a.nome.toLowerCase().startsWith(q) ? 0 : 1) - (b.nome.toLowerCase().startsWith(q) ? 0 : 1) || a.nome.localeCompare(b.nome)).slice(0, 10);
    el.innerHTML = achou.length ? achou.map((c) => `<button type="button" class="mp-res" data-mp-criatura="${esc(c.nome)}">${imgAnimada(c.imagem_wiki, '', c.nome, 'mp-mini', '🐾')}<span>${esc(c.nome)}${c.boss ? ' <small class="selo">boss</small>' : ''}</span></button>`).join('') : '<p class="muted">Nenhuma criatura com esse nome.</p>';
  }
  async function escolher(nome) {
    const c = M.criaturas.find((x) => x.nome.toLowerCase() === String(nome).toLowerCase()); if (!c) return;
    $('#mp-resultados').innerHTML = ''; $('#mp-busca').value = c.nome;
    const { data } = await sb.from('criaturas').select('local,spawn').eq('nome', c.nome).single();
    const local = data?.local || '';
    // 1) coordenadas exatas da TibiaWiki: {{Mapper Coords|128.1|123.94|11|4}} -> x = 128*256+1, y = 123*256+94, z = 11
    const pontos = [];
    for (const m of local.matchAll(/Mapper Coords\|(\d+)\.(\d+)\|(\d+)\.(\d+)\|(\d+)/gi)) {
      const x = +m[1] * 256 + +m[2], y = +m[3] * 256 + +m[4], z = +m[5];
      if (z >= 0 && z <= 15) pontos.push({ x, y, z, fonte: 'wiki', rotulo: `${c.nome} (TibiaWiki)` });
    }
    // 2) marcadores do TibiaMaps que citam a criatura pelo nome (singular ou plural)
    const nomes = [c.nome, c.plural, c.nome + 's', c.nome.replace(/y$/, 'ies')].filter(Boolean).map((n) => n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(^|[^a-z])(${nomes.join('|')})([^a-z]|$)`, 'i');
    // nomes maiores que contêm este (ex.: "Frost Dragon" para "Dragon") não contam como a criatura escolhida
    const escRe = (t) => t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const maiores = M.criaturas.flatMap((x) => [x.nome, x.plural]).filter((n) => n && n.length > c.nome.length && re.test(n)).sort((a, b) => b.length - a.length);
    const reMaior = maiores.length ? new RegExp(maiores.slice(0, 300).map(escRe).join('|'), 'gi') : null;
    for (const k of M.marcadores) { const d = reMaior ? k.d.replace(reMaior, ' ') : k.d; if (re.test(d)) pontos.push({ x: k.x, y: k.y, z: k.z, fonte: 'mapa', rotulo: k.d }); }
    M.pontos = pontos.filter((p) => p.x >= B.xMin && p.y >= B.yMin && p.x < B.xMin + B.w && p.y < B.yMin + B.h);
    M.sel = c;
    const porAndar = new Map(); for (const p of M.pontos) porAndar.set(p.z, (porAndar.get(p.z) || 0) + 1);
    $('#mp-info').innerHTML = `<div class="mp-cab">${imgAnimada(c.imagem_wiki, '', c.nome, 'mp-foto', '🐾')}<div><b>${esc(c.nome)}</b>${c.boss ? ' <small class="selo">boss</small>' : ''}<small class="muted">${[c.hp ? `${fmt(c.hp)} HP` : '', c.exp ? `${fmt(c.exp)} XP` : ''].filter(Boolean).join(' · ')}</small></div></div>` +
      (M.pontos.length ? `<div class="mp-sub">📍 ${M.pontos.length} ponto${M.pontos.length > 1 ? 's' : ''} no mapa</div><div class="mp-lista">${[...porAndar].sort((a, b) => a[0] - b[0]).map(([z, n]) => `<button type="button" class="chip" data-mp-andar-ir="${z}">Andar ${z} · ${nomeAndar(z)} <b>${n}</b></button>`).join('')}</div>` +
        `<div class="mp-pts">${M.pontos.slice(0, 40).map((p, i) => `<button type="button" class="mp-pt ${p.fonte}" data-mp-ponto="${i}"><span class="mp-bola"></span><span>${esc(p.rotulo)}</span><small class="muted">${p.x}, ${p.y}, ${p.z}</small></button>`).join('')}</div>`
        : '<div class="mp-sub">Sem coordenadas exatas no mapa para esta criatura.</div>') +
      `<div class="mp-sub">Onde encontrar (TibiaWiki)</div><p class="mp-local">${esc(limpaWiki(local).slice(0, 1500)) || '<span class="muted">Sem informação de local.</span>'}</p>` +
      `<div class="mp-leg"><span><i class="wiki"></i> ponto exato (TibiaWiki)</span><span><i class="mapa"></i> marcador da comunidade (TibiaMaps)</span></div>`;
    desenharPontos();
    if (M.pontos.length) { const p = M.pontos.find((x) => x.fonte === 'wiki') || M.pontos[0]; centrar(p.x, p.y, p.z, 2.5); }
  }

  // ---------- eventos ----------
  let tb; document.addEventListener('input', (e) => { if (e.target.id === 'mp-busca') { clearTimeout(tb); tb = setTimeout(() => resultados(e.target.value), 120); } });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mp-busca' && e.key === 'Enter') { e.preventDefault(); $('#mp-resultados [data-mp-criatura]')?.click(); } });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=mapa]')) { if (!M.carregado) carregar(); return; }
    const app = $('#mapa-app'); if (!app || !app.contains(e.target)) return;
    const c = e.target.closest('[data-mp-criatura]'); if (c) return escolher(c.dataset.mpCriatura);
    const z = e.target.closest('[data-mp-z]'); if (z) return trocarAndar(+z.dataset.mpZ);
    const ir = e.target.closest('[data-mp-andar-ir]'); if (ir) { const p = M.pontos.find((x) => x.z === +ir.dataset.mpAndarIr); if (p) centrar(p.x, p.y, p.z, Math.max(M.s, 2)); return; }
    const pt = e.target.closest('[data-mp-ponto]'); if (pt) { const p = M.pontos[+pt.dataset.mpPonto]; if (p) { centrar(p.x, p.y, p.z, Math.max(M.s, 3)); toast(p.rotulo.slice(0, 120)); } return; }
    const b = e.target.closest('[data-mp]'); if (!b) return;
    const v = $('#mp-vista').getBoundingClientRect();
    if (b.dataset.mp === 'mais') zoomEm(1.5, v.width / 2, v.height / 2);
    if (b.dataset.mp === 'menos') zoomEm(1 / 1.5, v.width / 2, v.height / 2);
    if (b.dataset.mp === 'tudo') enquadrarTudo();
  });
  // outras páginas (ex.: Boss Tracker) podem abrir o mapa já numa criatura
  window.abrirMapa = (nome) => {
    if (M.carregado) { $('#menu [data-pag=mapa]')?.click(); escolher(nome); }
    else { try { sessionStorage.setItem('tc_mapa_criatura', nome); } catch { /* ok */ } $('#menu [data-pag=mapa]')?.click(); }
  };
})();
