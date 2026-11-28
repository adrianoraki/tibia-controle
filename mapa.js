// TibiaHub — Mapa de monstros: mapa do Tibia por andar (TibiaMaps.io, MIT) com os lugares de cada criatura
// (coordenadas da TibiaWiki e marcadores da comunidade do TibiaMaps). Todo texto vindo de fora passa por esc().
(() => {
  const B = { xMin: 31744, yMin: 30976, w: 2560, h: 2048 };
  const IMG = (z) => `/mapas/floor-${String(z).padStart(2, '0')}-map.png`;   // cópia local do TibiaMaps (MIT), ver mapas/LICENCA
  const M = { carregado: false, criaturas: [], marcadores: [], z: 7, s: 1, tx: 0, ty: 0, sel: null, pontos: [], totalPontos: 0, busca: '', notas: [], aqui: null,
    camadas: { monstros: true, npcs: true, comunidade: false, meus: true }, todosPontos: [], npcs: [] };
  try { Object.assign(M.camadas, JSON.parse(localStorage.getItem('tc_mapa_camadas') || '{}')); } catch { /* ok */ }
  const GRATIS_PONTOS = 5, RAIO = 40;
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
        const { data, error } = await sb.from('criaturas').select('nome,plural,hp,exp,boss,imagem_wiki,classe_b:detalhes->>classe').order('nome').range(de, de + 999);
        if (error) throw error; lista.push(...data); if (data.length < 1000) break;
      }
      M.criaturas = lista;
      const r = await fetch('/dados/marcadores.json', { cache: 'force-cache' });
      M.marcadores = r.ok ? await r.json() : [];
      M.carregado = true; montar(); carregarNotas(); carregarCamadas();
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
        <div id="mp-aqui" class="mp-aqui"></div>
        <div id="mp-meus" class="mp-meus"></div>
        <div id="mp-cacas" class="mp-cacas"></div>
      </aside>
      <section class="card mp-mapa">
        <div class="mp-barra"><div class="mp-andares" role="group" aria-label="Andar">${Array.from({ length: 16 }, (_, z) => `<button type="button" data-mp-z="${z}" title="Andar ${z} (${nomeAndar(z)})">${z === 7 ? '7·T' : z}</button>`).join('')}</div>
          <div class="mp-zoom"><button type="button" data-mp="menos" aria-label="Diminuir zoom">−</button><button type="button" data-mp="mais" aria-label="Aumentar zoom">+</button><button type="button" data-mp="tudo" title="Ver o mapa inteiro">⤢</button><button type="button" data-mp="cheia" title="Tela cheia (Esc para sair)" aria-label="Tela cheia">⛶</button></div></div>
        <div class="mp-ferr" id="mp-ferr"></div>
        <div class="mp-vista" id="mp-vista"><div class="mp-camada" id="mp-camada"><img id="mp-img" alt="Mapa do Tibia" width="${B.w}" height="${B.h}" draggable="false"></div><div class="mp-sobre" id="mp-pontos"></div>
          <div class="mp-tip hidden" id="mp-tip" role="tooltip"></div><div class="mp-coord" id="mp-coord"></div><div class="mp-carregando hidden" id="mp-carregando">carregando andar…</div></div>
        <p class="dica">Mapa: <a href="https://tibiamaps.io" target="_blank" rel="noopener noreferrer">TibiaMaps.io</a> (MIT) · Locais das criaturas: <a href="https://tibia.fandom.com" target="_blank" rel="noopener noreferrer">TibiaWiki</a> (CC BY-SA) e marcadores do TibiaMaps. Tibia © CipSoft GmbH.</p>
      </section></div>`;
    ligarVista(); trocarAndar(M.z, false); enquadrarTudo(); renderFerr(); renderCacas();
  }

  function aplicar() {
    const c = $('#mp-camada'); if (!c) return;
    c.style.transform = `translate(${M.tx}px,${M.ty}px) scale(${M.s})`;
    c.style.setProperty('--inv', String(1 / M.s));
    // os pontos ficam numa camada separada, por cima do mapa (não dentro da imagem gigante): assim o navegador não precisa
    // redesenhar o mapa toda vez que um ícone muda, o que causava riscos na tela
    const p = $('#mp-pontos'); if (p) { p.style.setProperty('--tx', `${M.tx}px`); p.style.setProperty('--ty', `${M.ty}px`); p.style.setProperty('--s', String(M.s)); }
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
    const posicao = (h) => h.replace(/style="left:(-?\d+(?:\.\d+)?)px;top:(-?\d+(?:\.\d+)?)px/g, 'style="--mx:$1px;--my:$2px');
    el.innerHTML = posicao(camadasHtml() + M.pontos.filter((p) => p.z === M.z).map((p, i) => `<button type="button" class="mp-ponto ${p.fonte}${p.nome && p.nome === C.escolhido ? ' escolhido' : ''}" style="left:${p.x - B.xMin}px;top:${p.y - B.yMin}px" data-mp-ponto="${M.pontos.indexOf(p)}" data-tip="${esc(p.rotulo)}"><span></span></button>`).join('') +
      M.notas.filter((n) => M.camadas.meus && n.z === M.z).map((n) => `<button type="button" class="mp-nota ${n.tipo}" style="left:${n.x - B.xMin}px;top:${n.y - B.yMin}px" data-mp-nota="${n.id}" data-tip="${esc(rotuloNota(n))}${premium() ? ' · arraste para mover, botão direito apaga' : ''}">${ICONE_NOTA[n.tipo]}</button>`).join('') +
      (M.aqui && M.aqui.z === M.z ? `<span class="mp-aqui-marca" style="left:${M.aqui.x - B.xMin}px;top:${M.aqui.y - B.yMin}px;--r:${RAIO * 2}px"></span>` : ''));
    $$('[data-mp-z]').forEach((b) => b.classList.toggle('tem', M.pontos.some((p) => p.z === +b.dataset.mpZ)));
  }

  function ligarVista() {
    const v = $('#mp-vista'); let arrasto = null;
    let movendo = null;
    v.addEventListener('pointerdown', (e) => {
      const nt = e.target.closest('.mp-nota');
      if (nt && premium() && e.button === 0) { movendo = { id: +nt.dataset.mpNota, el: nt, x: e.clientX, y: e.clientY, mexeu: false }; v.setPointerCapture(e.pointerId); return; }
      if (e.target.closest('.mp-ponto, .mp-nota, .mp-spr, .mp-npc, .mp-com')) return; arrasto = { x: e.clientX, y: e.clientY, tx: M.tx, ty: M.ty }; v.setPointerCapture(e.pointerId); v.classList.add('arrastando'); });
    v.addEventListener('pointermove', (e) => {
      const r = v.getBoundingClientRect(), mx = (e.clientX - r.left - M.tx) / M.s, my = (e.clientY - r.top - M.ty) / M.s;
      $('#mp-coord').textContent = mx >= 0 && my >= 0 && mx < B.w && my < B.h ? `${Math.floor(mx + B.xMin)}, ${Math.floor(my + B.yMin)}, ${M.z}` : '';
      if (movendo) {
        if (Math.abs(e.clientX - movendo.x) + Math.abs(e.clientY - movendo.y) > 4) movendo.mexeu = true;
        if (movendo.mexeu) { movendo.el.style.setProperty('--mx', `${mx}px`); movendo.el.style.setProperty('--my', `${my}px`); }
        return;
      }
      if (!arrasto) return; M.tx = arrasto.tx + e.clientX - arrasto.x; M.ty = arrasto.ty + e.clientY - arrasto.y; limitar(); aplicar();
    });
    const fim = () => { arrasto = null; v.classList.remove('arrastando'); };
    v.addEventListener('pointerup', (e) => {
      if (movendo) {
        const mv = movendo; movendo = null;
        if (mv.mexeu) {
          const r = v.getBoundingClientRect(), nx = Math.floor((e.clientX - r.left - M.tx) / M.s + B.xMin), ny = Math.floor((e.clientY - r.top - M.ty) / M.s + B.yMin);
          moverNota(mv.id, nx, ny);
        } else { const n = M.notas.find((x) => x.id === mv.id); if (n) toast(rotuloNota(n).slice(0, 160)); }
        return;
      }
      // clique sem arrastar: "o que tem aqui?"
      if (arrasto && Math.abs(e.clientX - arrasto.x) < 5 && Math.abs(e.clientY - arrasto.y) < 5) {
        const r = v.getBoundingClientRect(), mx = (e.clientX - r.left - M.tx) / M.s, my = (e.clientY - r.top - M.ty) / M.s;
        if (mx >= 0 && my >= 0 && mx < B.w && my < B.h) {
          const gx = Math.floor(mx + B.xMin), gy = Math.floor(my + B.yMin);
          oQueTemAqui(gx, gy, M.z);
        }
      }
      fim();
    });
    v.addEventListener('pointercancel', fim);
    v.addEventListener('contextmenu', (e) => {
      const nt = e.target.closest('.mp-nota'); if (nt) { e.preventDefault(); apagarNota(+nt.dataset.mpNota); return; }
    });
    // dica ao passar o mouse
    v.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-tip]'), tip = $('#mp-tip'); if (!tip) return;
      if (!t) { tip.classList.add('hidden'); return; }
      tip.innerHTML = t.dataset.tip.split(' · ').map((l, i) => (i ? `<small>${esc(l)}</small>` : `<b>${esc(l)}</b>`)).join('');
      const r = v.getBoundingClientRect(), b = t.getBoundingClientRect();
      tip.style.left = `${Math.min(r.width - 230, Math.max(4, b.left - r.left + 18))}px`; tip.style.top = `${Math.max(4, b.top - r.top - 8)}px`; tip.classList.remove('hidden');
    });
    v.addEventListener('mouseleave', () => $('#mp-tip')?.classList.add('hidden'));
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
    const { data } = await sb.from('criaturas').select('local,spawn,detalhes').eq('nome', c.nome).single();
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
    // 3) sem nenhum ponto: procura nos marcadores os lugares citados pela TibiaWiki (ex.: "Nimmersatt's Breeding Ground")
    if (!pontos.length) {
      const lugares = [...new Set([...local.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter((n) => n.length >= 5))].slice(0, 30);
      for (const lugar of lugares) {
        const reL = new RegExp(`(^|[^a-z])${escRe(lugar)}([^a-z]|$)`, 'i');
        for (const k of M.marcadores) if (reL.test(k.d)) pontos.push({ x: k.x, y: k.y, z: k.z, fonte: 'local', rotulo: `${lugar} — ${k.d}` });
      }
    }
    M.pontos = pontos.filter((p) => p.x >= B.xMin && p.y >= B.yMin && p.x < B.xMin + B.w && p.y < B.yMin + B.h);
    M.sel = c; M.totalPontos = M.pontos.length;
    if (false && M.pontos.length > GRATIS_PONTOS) {
      // grátis: só os pontos da área com mais respawn
      const f = centroRespawn();
      M.pontos = M.pontos.slice().sort((a, b) => (a.z !== f.z) - (b.z !== f.z) || Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y)).slice(0, GRATIS_PONTOS);
    }
    const porAndar = new Map(); for (const p of M.pontos) porAndar.set(p.z, (porAndar.get(p.z) || 0) + 1);
    $('#mp-info').innerHTML = `<div class="mp-cab">${imgAnimada(c.imagem_wiki, '', c.nome, 'mp-foto', '🐾')}<div><b>${esc(c.nome)}</b>${c.boss ? ' <small class="selo">boss</small>' : ''}<small class="muted">${[c.hp ? `${fmt(c.hp)} HP` : '', c.exp ? `${fmt(c.exp)} XP` : ''].filter(Boolean).join(' · ')}</small></div></div>` +
      fichaCriatura(data?.detalhes) +
      (M.pontos.length ? `<div class="mp-sub">📍 ${M.totalPontos} ponto${M.totalPontos > 1 ? 's' : ''} no mapa${M.totalPontos > M.pontos.length ? ` · mostrando ${M.pontos.length}` : ''}</div>`
        + (M.totalPontos > M.pontos.length ? `<p class="mp-vip-aviso">🔒 Mais ${M.totalPontos - M.pontos.length} pontos de respawn no VIP. <button type="button" class="link" data-ir="conta">Ver o VIP</button></p>` : '') + `<div class="mp-lista">${[...porAndar].sort((a, b) => a[0] - b[0]).map(([z, n]) => `<button type="button" class="chip" data-mp-andar-ir="${z}">Andar ${z} · ${nomeAndar(z)} <b>${n}</b></button>`).join('')}</div>` +
        `<div class="mp-pts">${M.pontos.slice(0, 40).map((p, i) => `<button type="button" class="mp-pt ${p.fonte}" data-mp-ponto="${i}"><span class="mp-bola"></span><span>${esc(p.rotulo)}</span><small class="muted">${p.x}, ${p.y}, ${p.z}</small></button>`).join('')}</div>`
        : '<div class="mp-sub">Sem coordenadas exatas no mapa para esta criatura.</div>') +
      (M.pontos.length && M.pontos.every((p) => p.fonte === 'local') ? '<p class="muted mp-aviso">Sem ponto exato desta criatura: mostrando os lugares citados pela TibiaWiki.</p>' : '') +
      `<div class="mp-sub">Onde encontrar (TibiaWiki)</div><p class="mp-local">${esc(limpaWiki(local).slice(0, 1500)) || '<span class="muted">Sem informação de local.</span>'}</p>` +
      `<div class="mp-leg"><span><i class="wiki"></i> ponto exato (TibiaWiki)</span><span><i class="mapa"></i> marcador da comunidade (TibiaMaps)</span><span><i class="local"></i> lugar citado</span></div>`;
    desenharPontos();
    if (M.pontos.length) focarRespawn();
  }

  // vai direto para onde há mais respawn: o andar com mais pontos e, nele, o grupo de pontos mais cheio
  function focarRespawn() {
    const { z, x0, x1, y0, y1, viz } = centroRespawn();
    const v = $('#mp-vista').getBoundingClientRect();
    const s = Math.min(4, Math.max(1.2, Math.min(v.width / (x1 - x0 + 80), v.height / (y1 - y0 + 80))));
    centrar((x0 + x1) / 2, (y0 + y1) / 2, z, s);
    if (viz.length > 1) toast(`Maior concentração: andar ${z} (${nomeAndar(z)}), ${viz.length} pontos juntos.`);
  }
  function centroRespawn() {
    const porZ = new Map(); for (const p of M.pontos) porZ.set(p.z, (porZ.get(p.z) || 0) + (p.fonte === 'wiki' ? 2 : 1));
    const z = [...porZ].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - 7) - Math.abs(b[0] - 7))[0][0];
    const doAndar = M.pontos.filter((p) => p.z === z), R = 60;
    let melhor = doAndar[0], viz = [melhor];
    for (const p of doAndar) {
      const perto = doAndar.filter((q) => Math.abs(q.x - p.x) <= R && Math.abs(q.y - p.y) <= R);
      if (perto.length > viz.length) { melhor = p; viz = perto; }
    }
    const xs = viz.map((p) => p.x), ys = viz.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { z, x0, x1, y0, y1, viz, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }

  // ---------- o que tem aqui, anotações, favoritos e suas hunts no mapa ----------
  const ICONE_NOTA = { nota: '📝', favorito: '⭐', hunt: '⚔️' };
  function lucroHunt(local) {
    const hs = (S.hunts || []).filter((h) => (h.local || '').trim().toLowerCase() === String(local).trim().toLowerCase());
    const min = hs.reduce((t, h) => t + (h.duracao_min || 0), 0), lucro = hs.reduce((t, h) => t + (h.profit || 0), 0);
    return { n: hs.length, lucro, porHora: min > 0 ? lucro / (min / 60) : null };
  }
  function rotuloNota(n) {
    if (n.tipo !== 'hunt') return n.texto;
    const l = lucroHunt(n.hunt_local || n.texto);
    return `${n.texto}${l.n ? ` · ${l.n} hunt${l.n > 1 ? 's' : ''}${l.porHora != null ? ` · ${fmt(l.porHora)}/h` : ''}` : ''}`;
  }
  async function carregarNotas() {
    if (!premium()) { renderMeus(); return; }
    const { data, error } = await sb.from('mapa_notas').select('id,tipo,x,y,z,texto,hunt_local').order('criado_em', { ascending: false }).limit(300);
    if (error) return erro(error);
    M.notas = data || []; desenharPontos(); renderMeus();
  }
  function renderMeus() {
    const el = $('#mp-meus'); if (!el) return;
    if (!premium()) { el.innerHTML = `<div class="mp-sub">⭐ Meus lugares <span class="selo">Apoiador</span></div><p class="muted">Apoiadores marcam no mapa onde fizeram cada hunt (com o lucro por hora) e guardam anotações e favoritos.</p><button class="btn mini-btn" type="button" data-ir="conta">Seja apoiador</button>`; return; }
    el.innerHTML = `<div class="mp-sub">⭐ Meus lugares (${M.notas.length})</div>` + (M.notas.length
      ? `<div class="mp-pts">${M.notas.map((n) => `<div class="mp-meu"><button type="button" class="mp-pt" data-mp-ir-nota="${n.id}"><span class="mp-nota-ico">${ICONE_NOTA[n.tipo]}</span><span>${esc(rotuloNota(n))}</span><small class="muted">${n.x}, ${n.y}, ${n.z}</small></button><button type="button" class="del" data-mp-apagar-nota="${n.id}" title="Apagar" aria-label="Apagar">✕</button></div>`).join('')}</div>`
      : '<p class="muted">Clique em qualquer lugar do mapa para marcar uma hunt, um favorito ou uma anotação.</p>');
  }
  function oQueTemAqui(x, y, z) {
    const el = $('#mp-aqui'); if (!el) return;
    if (false) { M.aqui = null; el.innerHTML = `<div class="card-mini mp-aqui-box"><b>📍 ${x}, ${y}, ${z}</b><p class="muted">Ver os monstros com respawn neste lugar é do VIP.</p><button class="btn mini-btn" type="button" data-ir="conta">Ver o VIP</button></div>`; return; }
    M.aqui = { x, y, z }; desenharPontos();
    el.innerHTML = `<div class="card-mini mp-aqui-box"><b>📍 Neste lugar</b> <small class="muted">${x}, ${y}, andar ${z}</small><div class="mp-aqui-lista">Procurando…</div></div>`;
    buscarAqui(x, y, z);
  }
  async function buscarAqui(x, y, z) {
    let data = [];
    try { ({ data } = await sb.from('criaturas_pontos').select('nome,x,y,z').eq('z', z).gte('x', x - RAIO).lte('x', x + RAIO).gte('y', y - RAIO).lte('y', y + RAIO).limit(200)); } catch { data = []; }
    const achados = new Map();   // nome -> distância
    const anota = (nome, px, py) => { const d = Math.round(Math.hypot(px - x, py - y)); if (!achados.has(nome) || achados.get(nome) > d) achados.set(nome, d); };
    for (const p of data || []) anota(p.nome, p.x, p.y);
    // marcadores da comunidade perto, com nome de criatura na descrição
    const perto = M.marcadores.filter((k) => k.z === z && Math.abs(k.x - x) <= RAIO && Math.abs(k.y - y) <= RAIO);
    if (perto.length) {
      const idx = indiceNomes();
      for (const k of perto) for (const [re, nome] of idx) if (re.test(k.d)) anota(nome, k.x, k.y);
    }
    const lista = [...achados].sort((a, b) => a[1] - b[1]).slice(0, 15).map(([nome, d]) => ({ c: M.criaturas.find((c) => c.nome === nome), nome, d }));
    const caixa = $('#mp-aqui .mp-aqui-lista'); if (!caixa || !M.aqui || M.aqui.x !== x || M.aqui.y !== y) return;
    const locais = [...new Set((S.hunts || []).map((h) => (h.local || '').trim()).filter(Boolean))].slice(0, 60);
    caixa.innerHTML = (lista.length ? lista.map(({ c, nome, d }) => `<button type="button" class="mp-res" data-mp-criatura="${esc(nome)}">${imgAnimada(c?.imagem_wiki, '', nome, 'mp-mini', '🐾')}<span>${esc(nome)}<small class="muted">${[c?.hp ? `${fmt(c.hp)} HP` : '', c?.exp ? `${fmt(c.exp)} XP` : '', `~${d} sqm`].filter(Boolean).join(' · ')}</small></span></button>`).join('')
      : '<p class="muted">Nenhum respawn conhecido a menos de 40 sqm daqui.</p>') +
      (!premium() ? '<p class="mp-vip-aviso">⭐ Apoiadores podem marcar hunts, favoritos e anotações no mapa. <button type="button" class="link" data-ir="conta">Seja apoiador</button></p>' : `<div class="mp-aqui-acoes"><button type="button" class="btn sec mini-btn" data-mp-marcar="favorito">⭐ Favoritar</button><button type="button" class="btn sec mini-btn" data-mp-marcar="nota">📝 Anotar</button>` +
      `<label class="mp-hunt-sel">⚔️ <select data-mp-marcar-hunt aria-label="Marcar hunt aqui"><option value="">Marcar hunt aqui…</option>${locais.map((l) => `<option>${esc(l)}</option>`).join('')}</select></label></div>`);
  }
  let _idx = null;
  function indiceNomes() {
    if (_idx) return _idx;
    const esc2 = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    _idx = M.criaturas.filter((c) => c.nome.length >= 4).sort((a, b) => b.nome.length - a.nome.length).slice(0, 2500)
      .map((c) => [new RegExp(`(^|[^a-z])(${[c.nome, c.plural].filter(Boolean).map(esc2).join('|')})([^a-z]|$)`, 'i'), c.nome]);
    return _idx;
  }
  async function marcar(tipo, texto, huntLocal = null) {
    if (!M.aqui || !premium()) return;
    texto = String(texto || '').trim().slice(0, 200); if (!texto) return;
    const { data, error } = await sb.from('mapa_notas').insert({ tipo, x: M.aqui.x, y: M.aqui.y, z: M.aqui.z, texto, hunt_local: huntLocal }).select('id,tipo,x,y,z,texto,hunt_local').single();
    if (error) return erro(error);
    M.notas.unshift(data); desenharPontos(); renderMeus(); toast(`${ICONE_NOTA[tipo]} Guardado no mapa.`);
  }

  // ---------- ficha da criatura (fraquezas e características) ----------
  const ELEM = { physical: ['⚔️', 'Físico'], earth: ['🌿', 'Terra'], fire: ['🔥', 'Fogo'], energy: ['⚡', 'Energia'], ice: ['❄️', 'Gelo'], holy: ['✨', 'Sagrado'], death: ['💀', 'Morte'], hpDrain: ['🩸', 'Drenar vida'], drown: ['💧', 'Afogamento'], heal: ['💚', 'Cura'] };
  function fichaCriatura(d) {
    if (!d || typeof d !== 'object') return '';
    if (false) return `<p class="mp-vip-aviso">🔒 Fraquezas por elemento, armadura, velocidade e imunidades no VIP. <button type="button" class="link" data-ir="conta">Ver o VIP</button></p>`;
    const mods = d.mods && typeof d.mods === 'object' ? Object.entries(d.mods).filter(([k]) => ELEM[k] && k !== 'heal') : [];
    const cor = (v) => (v > 100 ? 'fraco' : v < 100 ? (v <= 0 ? 'imune' : 'forte') : 'normal');
    const sn = (v) => (v === true ? 'sim' : v === false ? 'não' : null);
    const info = [['Armadura', d.armor], ['Velocidade', d.velocidade], ['Mitigação', d.mitigacao != null ? `${d.mitigacao}%` : null], ['Dano máximo', d.dano_max ? fmt(d.dano_max) : null],
      ['Foge com', d.foge_com ? `${fmt(d.foge_com)} HP` : null], ['Bestiário', [d.classe, d.dificuldade, d.ocorrencia].filter(Boolean).join(' · ') || null],
      ['Imune a paralisia', sn(d.imune_paralisia)], ['Vê invisível', sn(d.ve_invisivel)], ['Pode ser empurrado', sn(d.empurravel)], ['Atravessa', d.atravessa]].filter(([, v]) => v != null && v !== '');
    return (mods.length ? `<div class="mp-sub">Elementos (dano recebido)</div><div class="mp-elem">${mods.map(([k, v]) => `<span class="el-${cor(v)}" title="${ELEM[k][1]}: recebe ${v}% do dano">${ELEM[k][0]} ${ELEM[k][1]} <b>${v}%</b></span>`).join('')}</div>` : '') +
      (info.length ? `<dl class="mp-ficha">${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>` : '');
  }

  // ---------- camadas (monstros, NPCs, marcadores da comunidade, meus lugares) ----------
  const ICO_COM = { star: '⭐', flag: '🚩', crossmark: '✖', down: '⬇', 'red down': '🔻', up: '⬆', 'red up': '🔺', sword: '⚔', '?': '❓', checkmark: '✔', '!': '❗', mouth: '👄', 'red left': '⬅', 'red right': '➡', bag: '👜', lock: '🔒', cross: '✝', skull: '💀', $: '💲', spear: '🗡' };
  async function carregarCamadas() {
    
    const [p, n] = await Promise.all([
      sb.from('criaturas_pontos').select('nome,x,y,z').limit(5000),
      (async () => { const out = []; for (let de = 0; de < 4000; de += 1000) { const { data } = await sb.from('npcs').select('nome,cidade,funcao,x,y,z').range(de, de + 999); out.push(...(data || [])); if (!data || data.length < 1000) break; } return out; })(),
    ]);
    M.todosPontos = p.data || []; M.npcs = n || [];
    const sal = S.dadosConta?.camadas; if (sal && typeof sal === 'object') for (const k of Object.keys(M.camadas)) if (typeof sal[k] === 'boolean') M.camadas[k] = sal[k];
    desenharPontos(); renderFerr();
    const pn = (() => { try { return JSON.parse(sessionStorage.getItem('tc_mapa_npc') || 'null'); } catch { return null; } })();
    if (pn) { sessionStorage.removeItem('tc_mapa_npc'); focarNpc(pn); }
  }
  // ícones próprios do TibiaHub por classe do bestiário (não dependem de nenhum site)
  const ICO_CLASSE = { Dragon: ['🐉', '#c0392b'], Undead: ['💀', '#7f8c8d'], Demon: ['😈', '#8e1b1b'], Human: ['🧑', '#b9770e'], Humanoid: ['👹', '#6e8b3d'],
    Amphibic: ['🐸', '#16a085'], Aquatic: ['🐟', '#1f77b4'], Bird: ['🦅', '#a0522d'], Construct: ['🗿', '#5d6d7e'], 'Elemental': ['🔥', '#e67e22'],
    'Extra Dimensional': ['🌀', '#8e44ad'], Fey: ['🧚', '#d35bb5'], Giant: ['🦍', '#795548'], Inkborn: ['🦑', '#34495e'], Lycanthrope: ['🐺', '#6d4c41'],
    Magical: ['✨', '#9b59b6'], Mammal: ['🐻', '#8d6e63'], Plant: ['🌿', '#2e7d32'], Reptile: ['🦎', '#558b2f'], Slime: ['🟢', '#43a047'], Vermin: ['🕷️', '#5d4037'] };
  const icoCriatura = (c) => { const [e, cor] = ICO_CLASSE[c?.classe_b] || (c?.boss ? ['👑', '#b8860b'] : ['🐾', '#6c3fc4']); return `<span class="mp-ico" style="--c:${cor}">${e}</span>`; };
  let imgsJogo = false; try { imgsJogo = localStorage.getItem('tc_mapa_imgs2') === 'jogo'; } catch { /* ok */ }
  function camadasHtml() {
    
    const no = (o) => o.z === M.z;
    const crs = M.camadas.monstros ? M.todosPontos.filter(no).map((p) => { const c = M.criaturas.find((x) => x.nome === p.nome);
      return `<span class="mp-spr" style="left:${p.x - B.xMin}px;top:${p.y - B.yMin}px" data-mp-criatura="${esc(p.nome)}" data-tip="${esc(p.nome)}${c?.hp ? ` · ${fmt(c.hp)} HP · ${fmt(c.exp || 0)} XP` : ''} · clique para ver os respawns">${imgsJogo && c?.imagem_wiki ? imgAnimada(c.imagem_wiki, '', '', 'mp-spr-img', '🐾') : icoCriatura(c)}</span>`; }).join('') : '';
    const nps = M.camadas.npcs ? M.npcs.filter(no).map((n) => `<button type="button" class="mp-npc" style="left:${n.x - B.xMin}px;top:${n.y - B.yMin}px" data-mp-npc="${esc(n.nome)}" data-tip="${esc(n.nome)}${n.funcao ? ` · ${esc(n.funcao)}` : ''}${n.cidade ? ` · ${esc(n.cidade)}` : ''}">🧑</button>`).join('') : '';
    const com = M.camadas.comunidade ? M.marcadores.filter(no).map((k) => `<span class="mp-com" style="left:${k.x - B.xMin}px;top:${k.y - B.yMin}px" data-tip="${esc(k.d || '')} · marcador do TibiaMaps">${ICO_COM[k.i] || '•'}</span>`).join('') : '';
    return com + crs + nps;
  }
  // abre o mapa no lugar exato do NPC (página NPCs) e mostra o quadro dele
  function focarNpc(n) {
    const x = +n.x, y = +n.y, z = +n.z;
    if (!(x >= B.xMin && x < B.xMin + B.w && y >= B.yMin && y < B.yMin + B.h && z >= 0 && z <= 15)) return toast('Esse NPC está fora do mapa.');
    M.camadas.npcs = true; desenharPontos?.(); renderFerr?.();
    centrar(x, y, z, 4); mostrarNpc(String(n.nome || ''));
    const v = $('#mp-vista'); v?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  window.abrirMapaNpc = (n) => {
    if (!n) return;
    if (M.carregado && M.npcs.length) { $('#menu [data-pag=mapa]')?.click(); setTimeout(() => focarNpc(n), 60); return; }
    try { sessionStorage.setItem('tc_mapa_npc', JSON.stringify({ nome: String(n.nome).slice(0, 80), x: +n.x, y: +n.y, z: +n.z })); } catch { /* ok */ }
    $('#menu [data-pag=mapa]')?.click();
  };
  function mostrarNpc(nome) {
    const ns = M.npcs.filter((n) => n.nome === nome); if (!ns.length) return;
    const n0 = ns.find((n) => n.z === M.z) || ns[0];
    $('#mp-aqui').innerHTML = `<div class="card-mini mp-aqui-box"><b>🧑 ${esc(nome)}</b><small class="muted">${[n0.funcao, n0.cidade].filter(Boolean).map(esc).join(' · ')}</small>` +
      (ns.length > 1 ? `<div class="mp-pts">${ns.map((n) => `<button type="button" class="mp-pt" data-mp-ir="${n.x},${n.y},${n.z}"><span class="mp-nota-ico">📍</span><span>${esc(n.cidade || 'lugar')}</span><small class="muted">${n.x}, ${n.y}, ${n.z}</small></button>`).join('')}</div>` : `<small class="muted">${n0.x}, ${n0.y}, andar ${n0.z}</small>`) +
      `<a href="https://tibia.fandom.com/wiki/${encodeURIComponent(nome.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">Abrir na TibiaWiki ↗</a></div>`;
  }

  function irPara(txt) {
    const n = String(txt || '').match(/(\d{5})\D+(\d{5})\D+(\d{1,2})/); if (!n) return toast('Use o formato 32369, 32241, 7');
    const [x, y, z] = [+n[1], +n[2], +n[3]];
    if (x < B.xMin || x >= B.xMin + B.w || y < B.yMin || y >= B.yMin + B.h || z > 15) return toast('Essa coordenada está fora do mapa.');
    centrar(x, y, z, Math.max(M.s, 3)); oQueTemAqui(x, y, z);
  }
  function renderFerr() {
    const el = $('#mp-ferr'); if (!el) return;
    const vip = true, cad = (k, ico, t) => `<button type="button" class="chip ${M.camadas[k] && vip ? 'ativo' : ''}" data-mp-camada="${k}" aria-pressed="${!!M.camadas[k]}">${ico} ${t}</button>`;
    if (!vip) { el.innerHTML = `<span class="muted">🔒 No VIP: monstros e NPCs desenhados no mapa, marcadores da comunidade, ir para coordenada e mover seus marcadores.</span> <button type="button" class="link" data-ir="conta">Ver o VIP</button>`; return; }
    el.innerHTML = `<div class="mp-ferr-linha"><span class="mp-ferr-rot">Camadas</span>${cad('monstros', '🐉', 'Monstros')}${cad('npcs', '🧑', 'NPCs')}${cad('comunidade', '📌', 'Comunidade')}${cad('meus', '⭐', 'Meus lugares')}<span class="mp-ferr-rot">Monstros como</span><span class="seg mp-seg"><button type="button" data-mp-imgs="tibiahub" class="${imgsJogo ? '' : 'ativo'}">🎨 Ícones</button><button type="button" data-mp-imgs="jogo" class="${imgsJogo ? 'ativo' : ''}" title="Imagens da TibiaWiki">🖼 Imagens</button></span>` +
      `<form class="mp-irpara" data-mp-irpara><input name="c" placeholder="ir para: 32369, 32241, 7" maxlength="30" aria-label="Ir para coordenada"><button class="btn sec mini-btn">Ir</button></form></div>` +
      '';
  }
  async function moverNota(id, x, y) {
    const n = M.notas.find((v) => v.id === id); if (!n) return;
    x = Math.max(B.xMin, Math.min(B.xMin + B.w - 1, x)); y = Math.max(B.yMin, Math.min(B.yMin + B.h - 1, y));
    const { error } = await sb.from('mapa_notas').update({ x, y }).eq('id', id);
    if (error) { erro(error); desenharPontos(); return; }
    n.x = x; n.y = y; desenharPontos(); renderMeus(); toast('Marcador movido.');
  }
  function apagarNota(id) {
    confirmar('Apagar do mapa', 'Apagar este lugar marcado?', { ok: 'Apagar', tipo: 'perigo' }).then(async (ok) => {
      if (!ok) return; const { error } = await sb.from('mapa_notas').delete().eq('id', id); if (error) return erro(error);
      M.notas = M.notas.filter((x) => x.id !== id); desenharPontos(); renderMeus();
    });
  }
  // ---------- onde caçar solo, por faixa de level e vocação (locais de caça da TibiaWiki) ----------
  const FAIXAS = [[1, 50]]; for (let a = 51; a <= 491; a += 20) FAIXAS.push([a, Math.min(a + 19, 500)]); FAIXAS.push([501, 9999]);
  const VOCS = [['knight', 'Knight', '🛡️'], ['sorcerer', 'Sorcerer', '🔥'], ['druid', 'Druid', '❄️'], ['paladin', 'Paladin', '🏹'], ['monk', 'Monk', '👊']];
  const C = { lista: null, faixa: null, voc: null, faixaSel: null, vocSel: null, escolhido: null };
  const lvlDe = (l, voc) => (voc === 'knight' ? l.lvl_knight : voc === 'paladin' ? l.lvl_paladin : voc === 'monk' ? (l.lvl_monk ?? (l.lvl_knight != null && l.lvl_paladin != null ? Math.max(l.lvl_knight, l.lvl_paladin) : null)) : l.lvl_mage);
  const naFaixa = (v, [a, b]) => v != null && v <= b && v >= (a === 1 ? 1 : Math.floor(a * 0.75));
  const nomeFaixa = ([a, b]) => (a === 1 ? 'Lvl até 50' : b >= 9999 ? 'Lvl 500+' : `Lvl ${a}–${b}`);
  function renderCacas() {
    const el = $('#mp-cacas'); if (!el) return;
    if (false) { el.innerHTML = `<div class="mp-sub">⚔️ Onde caçar (solo) <span class="selo">VIP</span></div><p class="muted">Escolha sua faixa de level e sua vocação e veja no mapa os lugares recomendados para caçar sozinho, com estrelas de XP e de loot.</p><button class="btn mini-btn" type="button" data-ir="conta">Ver o VIP</button>`; return; }
    // começa na faixa do level do personagem e na vocação dele
    if (C.faixaSel == null) {
      const lv = +S.perfil?.level || 0; C.faixaSel = Math.max(0, FAIXAS.findIndex(([a, b]) => lv >= a && lv <= b));
      const v = String(S.perfil?.vocacao || '').toLowerCase(); C.vocSel = VOCS.find(([k]) => v.includes(k))?.[0] || null;
    }
    const sel = C.faixa != null && C.voc ? (C.lista || []).filter((l) => naFaixa(lvlDe(l, C.voc), FAIXAS[C.faixa])).sort((x, y) => lvlDe(y, C.voc) - lvlDe(x, C.voc)) : [];
    const est = (n) => (n == null ? '' : '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)));
    el.innerHTML = `<div class="mp-sub">⚔️ Onde caçar (solo)</div>` +
      `<label class="mp-caca-lvl">Seu level<select data-mp-caca-faixa aria-label="Faixa de level">${FAIXAS.map((f, i) => `<option value="${i}" ${i === C.faixaSel ? 'selected' : ''}>${nomeFaixa(f)}</option>`).join('')}</select></label>` +
      `<div class="mp-caca-vocs" role="group" aria-label="Vocação">${VOCS.map(([k, t, ico]) => `<button type="button" class="${C.voc === k && C.faixa === C.faixaSel ? 'ativo' : ''}" data-mp-caca="${C.faixaSel}|${k}" aria-pressed="${C.voc === k && C.faixa === C.faixaSel}"><span>${ico}</span>${t}</button>`).join('')}</div>` +
      (C.faixa != null && C.voc ? `<div class="mp-cacas-lista">${C.lista == null ? '<p class="muted">Carregando…</p>' : sel.length
        ? `<small class="muted">${sel.length} lugar${sel.length > 1 ? 'es' : ''} para ${VOCS.find((v) => v[0] === C.voc)[1]} · ${nomeFaixa(FAIXAS[C.faixa])}${C.voc === 'monk' ? ' (level estimado pelo de knight e paladin; a TibiaWiki ainda não tem dados de monk)' : ''}</small>` +
          (() => { const lim = C.limite || 12, idx = sel.findIndex((l) => l.nome === C.escolhido), vis = sel.slice(0, Math.max(lim, idx + 1));
            return vis.map((l) => `<button type="button" class="mp-caca-item${C.escolhido === l.nome ? ' escolhido' : ''}" data-mp-caca-ir="${esc(l.nome)}" aria-pressed="${C.escolhido === l.nome}" ${l.pontos?.length ? '' : 'disabled title="Sem coordenada no mapa"'}><b>${C.escolhido === l.nome ? '📍 ' : ''}${esc(l.nome)}</b><small class="muted">a partir do lvl ${lvlDe(l, C.voc)}${l.cidade ? ` · ${esc(l.cidade)}` : ''}${l.pontos?.length ? '' : ' · sem ponto no mapa'}</small>` +
            `${l.exp_estrelas != null || l.loot_estrelas != null ? `<small class="mp-estrelas">XP ${est(l.exp_estrelas)} · Loot ${est(l.loot_estrelas)}</small>` : ''}` +
            `${C.escolhido === l.nome && l.melhores_loots?.length ? `<small class="mp-caca-loot">Melhores loots: ${l.melhores_loots.map(esc).join(', ')}</small>` : ''}</button>`).join('') + (sel.length > vis.length ? `<button type="button" class="btn sec mini-btn mp-caca-mais" data-mp-caca-mais>Mostrar mais ${Math.min(12, sel.length - vis.length)} de ${sel.length - vis.length} restantes</button>` : ''); })()
        : '<p class="muted">Nenhum lugar cadastrado nesta faixa para essa vocação.</p>'}</div>` : '<p class="muted mp-cacas-dica">Escolha o level e a vocação: os lugares aparecem no mapa em rosa.</p>') +
      `<p class="dica">Locais de caça e levels recomendados: TibiaWiki (CC BY-SA).</p>`;
  }
  async function escolherCaca(i, voc) {
    
    C.faixa = +i; C.faixaSel = +i; C.voc = voc; C.escolhido = null; C.limite = 12; renderCacas();
    if (C.lista == null) {
      const { data, error } = await sb.from('locais_caca').select('nome,cidade,lvl_knight,lvl_paladin,lvl_mage,lvl_monk,exp_estrelas,loot_estrelas,melhores_loots,pontos').limit(1000);
      if (error) return erro(error); C.lista = data || [];
    }
    const sel = C.lista.filter((l) => naFaixa(lvlDe(l, voc), FAIXAS[C.faixa]));
    M.pontos = sel.flatMap((l) => (l.pontos || []).map((p) => ({ x: p.x, y: p.y, z: p.z, fonte: 'caca', nome: l.nome, rotulo: `${l.nome} · lvl ${lvlDe(l, voc)}${l.melhores_loots?.length ? ` · loot: ${l.melhores_loots.slice(0, 3).join(', ')}` : ''}` })))
      .filter((p) => p.x >= B.xMin && p.y >= B.yMin && p.x < B.xMin + B.w && p.y < B.yMin + B.h);
    M.totalPontos = M.pontos.length; M.sel = null;
    const vt = VOCS.find((v) => v[0] === voc);
    $('#mp-busca').value = ''; $('#mp-resultados').innerHTML = ''; M.aqui = null; $('#mp-aqui').innerHTML = '';
    $('#mp-info').innerHTML = `<div class="mp-sub">⚔️ ${vt[2]} ${vt[1]} · ${nomeFaixa(FAIXAS[C.faixa])}</div><p class="muted">${sel.length} lugar${sel.length === 1 ? '' : 'es'} de caça · ${M.pontos.length} ponto${M.pontos.length === 1 ? '' : 's'} no mapa (em rosa). A lista está logo abaixo, em Onde caçar.</p>`;
    renderCacas(); desenharPontos();
    if (M.pontos.length) focarRespawn(); else toast('Nenhum desses lugares tem coordenada no mapa.');
  }

  // ---------- tela cheia: o mapa com a barra lateral ocupa a tela toda ----------
  function telaCheia() {
    const g = $('#mapa-app .mp-grid'); if (!g) return;
    const ligado = document.fullscreenElement === g || g.classList.contains('mp-cheia');
    if (ligado) { if (document.fullscreenElement) document.exitFullscreen?.(); g.classList.remove('mp-cheia'); document.body.classList.remove('sem-rolagem'); }
    else if (g.requestFullscreen) g.requestFullscreen().catch(() => { g.classList.add('mp-cheia'); document.body.classList.add('sem-rolagem'); });
    else { g.classList.add('mp-cheia'); document.body.classList.add('sem-rolagem'); }   // celulares sem tela cheia: ocupa a janela toda
    setTimeout(() => { limitar(); aplicar(); }, 150);
  }
  document.addEventListener('fullscreenchange', () => { const b = $('[data-mp="cheia"]'); if (b) b.textContent = document.fullscreenElement ? '✕' : '⛶'; setTimeout(() => { if ($('#mp-vista')) { limitar(); aplicar(); } }, 150); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const g = $('#mapa-app .mp-grid.mp-cheia'); if (g) telaCheia(); } });

  // ---------- eventos ----------
  document.addEventListener('submit', (e) => {
    if (!e.target.matches?.('[data-mp-irpara]')) return; e.preventDefault(); irPara(e.target.c.value);
  });
  document.addEventListener('change', (e) => {
    const fx = e.target.closest?.('[data-mp-caca-faixa]');
    if (fx) { C.faixaSel = +fx.value; if (C.voc) escolherCaca(C.faixaSel, C.voc); else renderCacas(); return; }
    const sel = e.target.closest?.('[data-mp-marcar-hunt]'); if (!sel || !sel.value) return;
    marcar('hunt', sel.value, sel.value);
  });
  let tb; document.addEventListener('input', (e) => { if (e.target.id === 'mp-busca') { clearTimeout(tb); tb = setTimeout(() => resultados(e.target.value), 120); } });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mp-busca' && e.key === 'Enter') { e.preventDefault(); $('#mp-resultados [data-mp-criatura]')?.click(); } });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=mapa]')) { if (!M.carregado) carregar(); return; }
    const app = $('#mapa-app'); if (!app || !app.contains(e.target)) return;
    const c = e.target.closest('[data-mp-criatura]'); if (c) return escolher(c.dataset.mpCriatura);
    const z = e.target.closest('[data-mp-z]'); if (z) return trocarAndar(+z.dataset.mpZ);
    const ir = e.target.closest('[data-mp-andar-ir]'); if (ir) { const p = M.pontos.find((x) => x.z === +ir.dataset.mpAndarIr); if (p) centrar(p.x, p.y, p.z, Math.max(M.s, 2)); return; }
    const im = e.target.closest('[data-mp-imgs]'); if (im) { imgsJogo = im.dataset.mpImgs === 'jogo'; try { localStorage.setItem('tc_mapa_imgs2', imgsJogo ? 'jogo' : 'tibiahub'); } catch { /* ok */ } desenharPontos(); renderFerr(); return; }
    if (e.target.closest('[data-mp-caca-mais]')) { C.limite = (C.limite || 12) + 12; renderCacas(); return; }
    const cc = e.target.closest('[data-mp-caca]');
    if (cc) { const [i, v] = cc.dataset.mpCaca.split('|'); if (C.faixa === +i && C.voc === v) { C.faixa = null; C.voc = null; M.pontos = []; desenharPontos(); renderCacas(); } else escolherCaca(i, v); return; }
    const ci = e.target.closest('[data-mp-caca-ir]');
    if (ci) { const l = (C.lista || []).find((x) => x.nome === ci.dataset.mpCacaIr), p = l?.pontos?.[0]; if (p) { C.escolhido = l.nome; renderCacas(); desenharPontos(); centrar(p.x, p.y, p.z, Math.max(M.s, 2.5)); } return; }
    const cm = e.target.closest('[data-mp-camada]');
    if (cm) { const k = cm.dataset.mpCamada; M.camadas[k] = !M.camadas[k];
      try { localStorage.setItem('tc_mapa_camadas', JSON.stringify(M.camadas)); } catch { /* ok */ } salvarNaConta('camadas', { ...M.camadas }); desenharPontos(); renderFerr(); return; }
    const np = e.target.closest('[data-mp-npc]'); if (np) { mostrarNpc(np.dataset.mpNpc); return; }
    const irc = e.target.closest('[data-mp-ir]'); if (irc) { const [x, y, z] = irc.dataset.mpIr.split(',').map(Number); centrar(x, y, z, Math.max(M.s, 3)); return; }
    const mk = e.target.closest('[data-mp-marcar]');
    if (mk) {
      const tipo = mk.dataset.mpMarcar;
      dialogo({ titulo: tipo === 'favorito' ? 'Favoritar este lugar' : 'Anotar neste lugar', texto: 'Escreva um nome ou uma anotação (até 200 letras).', ok: 'Guardar',
        campo: { placeholder: tipo === 'favorito' ? 'ex: hunt boa para EK 400' : 'ex: cuidado com PK aqui', maxlength: 200 } })
        .then((v) => { if (v) marcar(tipo, typeof v === 'string' ? v : v.valor); });
      return;
    }
    const irN = e.target.closest('[data-mp-ir-nota]'); if (irN) { const n = M.notas.find((x) => x.id === +irN.dataset.mpIrNota); if (n) centrar(n.x, n.y, n.z, Math.max(M.s, 3)); return; }
    const ap = e.target.closest('[data-mp-apagar-nota]'); if (ap) { apagarNota(+ap.dataset.mpApagarNota); return; }
    const pt = e.target.closest('[data-mp-ponto]'); if (pt) { const p = M.pontos[+pt.dataset.mpPonto]; if (p) { centrar(p.x, p.y, p.z, Math.max(M.s, 3)); toast(p.rotulo.slice(0, 120)); } return; }
    const b = e.target.closest('[data-mp]'); if (!b) return;
    const v = $('#mp-vista').getBoundingClientRect();
    if (b.dataset.mp === 'mais') zoomEm(1.5, v.width / 2, v.height / 2);
    if (b.dataset.mp === 'menos') zoomEm(1 / 1.5, v.width / 2, v.height / 2);
    if (b.dataset.mp === 'tudo') enquadrarTudo();
    if (b.dataset.mp === 'cheia') telaCheia();
  });
  // outras páginas (ex.: Boss Tracker) podem abrir o mapa já numa criatura
  window.abrirMapa = (nome) => {
    if (M.carregado) { $('#menu [data-pag=mapa]')?.click(); escolher(nome); }
    else { try { sessionStorage.setItem('tc_mapa_criatura', nome); } catch { /* ok */ } $('#menu [data-pag=mapa]')?.click(); }
  };
})();
