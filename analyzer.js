// TibiaHub — leitor do Hunt Analyzer.
// O jogador cola o texto do botão "Copy to clipboard" do Hunt Analyzer, ou envia um print da janela.
// Tudo é lido no próprio navegador: o texto e a imagem não saem do aparelho; só a hunt confirmada é salva.
// Segurança: todo texto lido passa por esc() antes de ir para a tela; números são validados; limites de tamanho.
(() => {
  const raiz = document.getElementById('hz'); if (!raiz) return;
  const area = $('#hz-texto', raiz), saida = $('#hz-saida', raiz), estado = $('#hz-estado', raiz), foto = $('#hz-foto', raiz);
  const MAX_TXT = 60000, MAX_LINHAS = 400, MAX_QTD = 1e7;
  const MOEDA = { 'gold coin': 1, 'platinum coin': 100, 'crystal coin': 10000 };
  let atual = null;

  // "1,109,767" / "1.109.767" / "-12,345" -> número inteiro (ou null)
  const num = (s) => {
    const t = String(s ?? '').trim(); if (!/^-?[\d.,\s]+$/.test(t)) return null;
    const n = parseInt(t.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) && Math.abs(n) < 1e13 ? n : null;
  };
  const nomeLimpo = (s) => String(s).trim().replace(/^(a|an|the)\s+/i, '').replace(/\s+/g, ' ').slice(0, 60);

  function ler(txt) {
    const t = String(txt || '').replace(/\r/g, '').slice(0, MAX_TXT);
    const campo = (rot) => { const m = t.match(new RegExp('^[ \\t]*' + rot + '[ \\t]*:[ \\t]*(-?[\\d.,]+)', 'mi')); return m ? num(m[1]) : null; };
    const r = {
      inicio: null, fim: null, minutos: null,
      xp: campo('XP Gain'), xpRaw: campo('Raw XP Gain'), loot: campo('Loot'), supplies: campo('Supplies'), balance: campo('Balance'),
      dano: campo('Damage'), cura: campo('Healing'), monstros: [], itens: [],
    };
    const de = t.match(/From\s+(\d{4}-\d{2}-\d{2}),?\s+(\d{2}:\d{2})(?::\d{2})?\s+to\s+(\d{4}-\d{2}-\d{2}),?\s+(\d{2}:\d{2})/i);
    if (de) { r.inicio = { dia: de[1], hora: de[2] }; r.fim = { dia: de[3], hora: de[4] }; }
    const ses = t.match(/^[ \t]*Session[ \t]*:[ \t]*(\d{1,3}):(\d{2})/mi);
    if (ses) r.minutos = +ses[1] * 60 + +ses[2];
    let secao = null;
    for (const linha of t.split('\n').slice(0, MAX_LINHAS)) {
      if (/^\s*Killed Monsters\s*:/i.test(linha)) { secao = 'monstros'; continue; }
      if (/^\s*Looted Items\s*:/i.test(linha)) { secao = 'itens'; continue; }
      const m = linha.match(/^\s*(\d[\d.,]*)\s*x\s+(.+?)\s*$/i);
      if (m && secao) {
        const qtd = num(m[1]), nome = nomeLimpo(m[2]);
        if (qtd > 0 && qtd <= MAX_QTD && nome) r[secao].push({ qtd, nome });
      } else if (/^\s*[A-Za-z/ ]+:/.test(linha)) secao = null;
    }
    if (r.balance == null && r.loot != null && r.supplies != null) r.balance = r.loot - r.supplies;
    return r;
  }

  // quanto vale o loot vendendo no NPC que paga mais (catálogo do site) e o que sobra para o Market
  function avaliar(r) {
    let npcTotal = 0, moedas = 0; const porNpc = new Map(), market = [], usar = [];
    for (const it of r.itens) {
      const n = it.nome.toLowerCase();
      if (MOEDA[n]) { moedas += it.qtd * MOEDA[n]; continue; }
      const p = melhorPreco(n);
      if (p && p.preco > 0) {
        const v = p.preco * it.qtd; npcTotal += v;
        const g = porNpc.get(p.npc) || { npc: p.npc, total: 0, itens: [] };
        g.total += v; g.itens.push({ ...it, preco: p.preco, v }); porNpc.set(p.npc, g);
      } else if (/\b(potion|rune|arrow|bolt|spear|star)s?\b/i.test(n)) usar.push(it);
      else market.push(it);
    }
    const npcs = [...porNpc.values()].sort((a, b) => b.total - a.total);
    npcs.forEach((g) => g.itens.sort((a, b) => b.v - a.v));
    return { npcTotal, moedas, npcs, market, usar };
  }

  const cidades = new Map();
  async function buscarCidades(nomes) {
    const falta = nomes.filter((n) => !cidades.has(n)).slice(0, 60); if (!falta.length || typeof sb === 'undefined') return;
    const { data } = await sb.from('npcs').select('nome,cidade').in('nome', falta);
    for (const n of falta) cidades.set(n, '');
    for (const d of data || []) if (d.cidade && !cidades.get(d.nome)) cidades.set(d.nome, d.cidade);
  }

  const kpi = (rot, val, extra = '') => `<div class="hz-kpi"><span>${rot}</span><b>${val}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;
  const hm = (min) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  const porHora = (v, min) => (min ? fmtC(v / (min / 60)) + '/h' : '');


  // diário de hunt: compara esta sessão com a média das suas hunts no mesmo lugar (por hora de hunt)
  function comparar(local) {
    const el = document.getElementById('hz-comp'), r = atual; if (!el || !r) return;
    const nome = String(local || '').trim().toLowerCase(), min = r.minutos || 0;
    if (!nome || !min || r.loot == null) { el.innerHTML = ''; return; }
    const ant = S.hunts.filter((h) => String(h.local).trim().toLowerCase() === nome && h.duracao_min > 0).slice(0, 10);
    if (!ant.length) { el.innerHTML = `<p class="dica">📒 Primeira hunt registrada em <b>${esc(local.trim())}</b>: as próximas vão ser comparadas com ela.</p>`; return; }
    const h = ant.reduce((t, x) => ({ min: t.min + x.duracao_min, loot: t.loot + x.loot, sup: t.sup + x.gasto, xp: t.xp + (x.xp || 0), nx: t.nx + (x.xp ? x.duracao_min : 0) }), { min: 0, loot: 0, sup: 0, xp: 0, nx: 0 });
    const media = { lucro: ((h.loot - h.sup) * 60) / h.min, loot: (h.loot * 60) / h.min, sup: (h.sup * 60) / h.min, xp: h.nx ? (h.xp * 60) / h.nx : null };
    const agora = { lucro: (((r.loot || 0) - (r.supplies || 0)) * 60) / min, loot: (r.loot * 60) / min, sup: ((r.supplies || 0) * 60) / min, xp: r.xp != null ? (r.xp * 60) / min : null };
    const varP = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 100) : null);
    const linha = (rot, k, bomSubir = true) => { if (agora[k] == null || media[k] == null) return ''; const v = varP(agora[k], media[k]), bom = v == null ? null : bomSubir ? v >= 0 : v <= 0;
      return `<div class="hz-cmp-l"><span>${rot}</span><b>${fmtC(Math.round(agora[k]))}/h</b><small class="muted">média ${fmtC(Math.round(media[k]))}/h</small>${v == null ? '' : `<b class="${bom ? 'pos' : 'neg'}">${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)}%</b>`}</div>`; };
    const dl = varP(agora.loot, media.loot), ds = varP(agora.sup, media.sup), dx = media.xp ? varP(agora.xp, media.xp) : null, dc = varP(agora.lucro, media.lucro);
    const dicas = [];
    if (dc != null && Math.abs(dc) < 8) dicas.push('Hunt dentro do normal para esse lugar.');
    if (dl != null && dl <= -12 && (dx == null || dx <= -8)) dicas.push('Menos loot e menos XP por hora: o respawn estava fraco, tinha gente na hunt ou a rota rendeu menos.');
    else if (dl != null && dl <= -12) dicas.push('O XP foi normal mas o loot caiu: pode ser azar no drop. Vale repetir antes de mudar algo.');
    if (ds != null && ds >= 15) dicas.push(`Você gastou ${ds}% mais supplies por hora que o normal: confira potions e runas (apanhou mais ou usou magia mais cara?).`);
    if (dc != null && dc >= 12) dicas.push('Uma das suas melhores sessões aqui: anote o que fez diferente (horário, rota, time).');
    el.innerHTML = `<div class="hz-cmp"><b>📒 Comparando com as suas ${ant.length} última${ant.length > 1 ? 's' : ''} hunt${ant.length > 1 ? 's' : ''} em ${esc(local.trim())}</b>
      <div class="hz-cmp-g">${linha('Lucro', 'lucro')}${linha('Loot', 'loot')}${linha('Supplies', 'sup', false)}${linha('XP', 'xp')}</div>
      ${dicas.length ? `<ul class="hz-cmp-d">${dicas.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  document.addEventListener('input', (e) => { if (e.target.matches?.('#hz-form [name=local]')) comparar(e.target.value); });
  function mostrar(r) {
    atual = r;
    const temTotais = r.loot != null || r.xp != null || r.supplies != null;
    if (!temTotais && !r.itens.length) {
      saida.innerHTML = '<div class="bloqueio">Não encontrei os dados do Hunt Analyzer nesse texto. No jogo, abra o Hunt Analyzer e use o botão <b>Copy to clipboard</b>; depois cole aqui.</div>';
      return;
    }
    const a = avaliar(r), min = r.minutos || 0;
    const realNpc = a.npcTotal + a.moedas - (r.supplies || 0);
    const npcsHtml = a.npcs.slice(0, 20).map((g) => {
      const cid = cidades.get(g.npc);
      return `<div class="hz-npc"><div class="hz-npc-topo"><b>${esc(g.npc)}</b>${cid ? `<span class="muted">${esc(cid)}</span>` : ''}<b class="pos">${fmt(g.total)} gp</b></div>` +
        `<div class="hz-chips">${g.itens.slice(0, 30).map((i) => `<span class="hz-chip" title="${fmt(i.preco)} gp cada">${imgDoItem(i.nome)}${fmt(i.qtd)}x ${esc(i.nome)} <small>${fmtC(i.v)}</small></span>`).join('')}</div></div>`;
    }).join('');
    const lista = (arr) => arr.slice(0, 60).map((i) => `<span class="hz-chip">${imgDoItem(i.nome)}${fmt(i.qtd)}x ${esc(i.nome)}</span>`).join('');
    const totMon = r.monstros.reduce((t, m) => t + m.qtd, 0);
    const topMon = [...r.monstros].sort((x, y) => y.qtd - x.qtd).slice(0, 8);
    const dia = r.inicio?.dia || hojeISO();
    const dup = S.hunts.some((h) => h.data === dia && h.loot === r.loot && h.gasto === r.supplies);
    saida.innerHTML =
      `<div class="hz-kpis">` +
        (min ? kpi('Duração', hm(min), r.inicio ? `${esc(fmtData(r.inicio.dia))} · ${esc(r.inicio.hora)}–${esc(r.fim.hora)}` : '') : '') +
        (r.xp != null ? kpi('XP (com bônus)', fmtC(r.xp), porHora(r.xp, min)) : '') +
        (r.loot != null ? kpi('Loot', fmtC(r.loot), porHora(r.loot, min)) : '') +
        (r.supplies != null ? kpi('Supplies', fmtC(r.supplies), porHora(r.supplies, min)) : '') +
        (r.balance != null ? kpi('Balance', `<span class="${cls(r.balance)}">${fmtC(r.balance)}</span>`, porHora(r.balance, min)) : '') +
        (totMon ? kpi('Monstros', fmt(totMon), min ? `${fmt(totMon / (min / 60))}/h` : '') : '') +
      `</div>` +
      (r.itens.length ? `<div class="hz-real"><div><span class="muted">Vendendo tudo no NPC que paga mais</span><b>${fmt(a.npcTotal)} gp</b></div>` +
        `<div><span class="muted">Moedas que caíram</span><b>${fmt(a.moedas)} gp</b></div>` +
        `<div><span class="muted">Lucro real (NPC + moedas − supplies)</span><b class="${cls(realNpc)}">${fmt(realNpc)} gp</b></div></div>` +
        `<p class="dica">O Hunt Analyzer calcula o loot com os preços configurados no seu client. Aqui é o que você recebe de verdade vendendo para os NPCs.</p>` : '') +
      (a.npcs.length ? `<h3 class="hz-tit">Onde vender</h3><div class="hz-npcs">${npcsHtml}</div>` : '') +
      (a.market.length ? `<h3 class="hz-tit">Sem NPC que compre: vale ver no Market</h3><div class="hz-chips">${lista(a.market)}</div>` : '') +
      (a.usar.length ? `<h3 class="hz-tit">Supplies que caíram (use nas próximas hunts)</h3><div class="hz-chips">${lista(a.usar)}</div>` : '') +
      (topMon.length ? `<h3 class="hz-tit">Mais caçados</h3><div class="hz-chips">${topMon.map((m) => `<span class="hz-chip">${fmt(m.qtd)}x ${esc(m.nome)}</span>`).join('')}</div>` : '') +
      `<form class="hz-salvar linha-form" id="hz-form">` +
        `<label>Data<input name="data" type="date" required value="${esc(dia)}"></label>` +
        `<label class="largo">Hunt / Local<input name="local" required list="locais" maxlength="80" placeholder="ex: Lion Sanctum"></label>` +
        `<button class="btn" ${r.loot == null || r.supplies == null ? 'disabled title="Faltam loot e supplies"' : ''}>Salvar no histórico</button>` +
      `</form><div id="hz-comp" aria-live="polite"></div>` + (dup ? '<p class="dica">⚠️ Já existe uma hunt nesse dia com o mesmo loot e supplies. Confira antes de salvar de novo.</p>' : '') +
      (r.itens.length && S.hunts.length ? `<form class="hz-ja linha-form" id="hz-ja"><label class="largo">Já salvou esta hunt antes? Só mande o loot para o inventário<select name="hunt">${S.hunts.slice(0, 40).map((h) => `<option value="${h.id}" ${h.id === (S.hunts.find((x) => x.data === dia && x.loot === r.loot && x.gasto === r.supplies) || {}).id ? 'selected' : ''}>${esc(fmtData(h.data))} · ${esc(h.local)} · loot ${fmtC(h.loot)}</option>`).join('')}</select></label><button class="btn btn-sec">Lançar no inventário</button></form>` : '');
    { const inp = document.querySelector('#hz-form [name=local]'); if (inp && inp.value) comparar(inp.value); }
    const nomes = a.npcs.map((g) => g.npc).filter((n) => !cidades.has(n));
    if (nomes.length) buscarCidades(nomes).then(() => { if (atual === r) mostrar(r); }).catch(() => {});
  }

  const itensDe = (r) => r.itens.filter((i) => !MOEDA[i.nome.toLowerCase()]).slice(0, 400).map((i) => ({ nome: i.nome, qtd: i.qtd }));
  saida.addEventListener('submit', async (e) => {
    if (e.target.id === 'hz-ja') {
      e.preventDefault(); const r = atual, id = +e.target.hunt.value; if (!r || !id) return;
      const b = e.target.querySelector('button'); b.disabled = true;
      const { data: n, error } = await sb.rpc('inventario_hunt', { p_hunt: id, p_itens: itensDe(r) });
      b.disabled = false;
      if (error) return erro(error);
      toast(n ? `${fmt(n)} itens entraram no seu inventário` : 'O loot dessa hunt já estava no inventário.');
      window.dispatchEvent(new Event('inventario-mudou')); return;
    }
    if (e.target.id !== 'hz-form') return; e.preventDefault();
    const f = e.target, r = atual; if (!r || r.loot == null || r.supplies == null) return;
    const local = f.local.value.trim().slice(0, 80), data = f.data.value;
    if (!local || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return toast('Preencha a data e o local da hunt.');
    const totMon = r.monstros.reduce((t, m) => t + m.qtd, 0);
    const obs = ['Hunt Analyzer', r.inicio ? `${r.inicio.hora}–${r.fim.hora}` : '', totMon ? `${fmt(totMon)} monstros` : ''].filter(Boolean).join(' · ');
    f.querySelector('button').disabled = true;
    const hi = /^(\d{2}):(\d{2})$/.exec(r.inicio?.hora || ''), hora_inicio = hi && +hi[1] < 24 && +hi[2] < 60 ? +hi[1] * 60 + +hi[2] : null;
    const ok = await salvarHunt({ data, local, loot: Math.max(0, r.loot), gasto: Math.max(0, r.supplies), duracao_min: r.minutos || null, xp: r.xp, obs, hora_inicio });
    f.querySelector('button').disabled = false;
    // o loot da hunt entra no Meu inventário (moedas ficam de fora; o servidor confere tudo de novo)
    const itens = itensDe(r);
    if (ok && itens.length) {
      const { data: n, error } = await sb.rpc('inventario_hunt', { p_hunt: ok.id, p_itens: itens });
      if (!error && n) toast(`Hunt salva · ${fmt(n)} itens entraram no seu inventário`);
      window.dispatchEvent(new Event('inventario-mudou'));
    }
    if (ok) { area.value = ''; saida.innerHTML = ''; atual = null; }
  });

  $('#hz-ler', raiz).addEventListener('click', () => mostrar(ler(area.value)));
  area.addEventListener('paste', () => setTimeout(() => mostrar(ler(area.value)), 0));

  // ---------- leitura por foto (OCR no próprio navegador, arquivos em /vendor/ocr) ----------
  let ocrPronto = null;
  function carregarOcr() {
    if (window.Tesseract) return Promise.resolve();
    if (!ocrPronto) ocrPronto = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = '/vendor/ocr/tesseract.min.js'; s.integrity = 'sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM'; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = () => { ocrPronto = null; falha(new Error('ocr')); };
      document.head.appendChild(s);
    });
    return ocrPronto;
  }
  // amplia, passa para cinza e deixa texto escuro em fundo claro (a janela do Tibia é escura)
  async function prepararImagem(file) {
    const bmp = await createImageBitmap(file);
    const esc3 = Math.min(3, 4000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * esc3); c.height = Math.round(bmp.height * esc3);
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data; let soma = 0;
    for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; soma += y; }
    const escuro = soma / (d.length / 4) < 128;
    for (let i = 0; i < d.length; i += 4) { let y = escuro ? 255 - d[i] : d[i]; y = y < 150 ? Math.max(0, y - 60) : 255; d[i] = d[i + 1] = d[i + 2] = y; }
    g.putImageData(im, 0, 0);
    return c;
  }
  // erros comuns do OCR em números (O→0, l/I→1, S→5) só dentro de valores
  const consertar = (t) => String(t).replace(/:\s*([-\dOolIS.,\s]{3,})$/gm, (m, v) => ': ' + v.replace(/[Oo]/g, '0').replace(/[lI]/g, '1').replace(/S/g, '5').replace(/\s+/g, ''));

  foto.addEventListener('change', async () => {
    const file = foto.files?.[0]; foto.value = ''; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15e6) return toast('Envie um print em PNG, JPG ou WEBP de até 15 MB.');
    raiz.classList.add('hz-lendo');
    try {
      estado.textContent = 'Preparando a leitura… (na primeira vez baixa uns 7 MB)';
      await carregarOcr();
      const canvas = await prepararImagem(file);
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: '/vendor/ocr/worker.min.js', corePath: '/vendor/ocr/', langPath: '/vendor/ocr/', workerBlobURL: false,
        logger: (m) => { if (m.status === 'recognizing text') estado.textContent = `Lendo o print… ${Math.round((m.progress || 0) * 100)}%`; },
      });
      try {
        await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        const { data } = await worker.recognize(canvas);
        area.value = consertar(data.text || '').slice(0, MAX_TXT);
      } finally { await worker.terminate(); }
      const r = ler(area.value); mostrar(r);
      estado.textContent = (r.loot != null || r.xp != null) ? 'Print lido. Confira os números antes de salvar: a leitura de imagem pode errar algum dígito.' : 'Não consegui ler os números desse print. Tente um print mais nítido só da janela do Hunt Analyzer, ou use o Copy to clipboard.';
    } catch {
      estado.textContent = 'Não foi possível ler a imagem agora. Tente de novo ou cole o texto do Copy to clipboard.';
    } finally { raiz.classList.remove('hz-lendo'); }
  });
})();
