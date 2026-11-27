// TibiaHub — Analista da Roda do Destino: uma "mini IA" por regras que roda no navegador.
// Junta level, magic level/skill, equipamento, imbuements e a roda para dizer o que rende mais.
// Dados: itens e imbuements (TibiaWiki, CC BY-SA), magias com base power (TibiaWiki), roda (tibia.com).
// Todo texto de fora passa por esc(). Nada de HTML vindo do banco.
(() => {
  const A = { itens: null, imbs: null, carregando: false, dados: null };
  const SLOTS = [
    ['arma', 'Arma'], ['mao2', 'Escudo / livro'], ['capacete', 'Capacete'], ['armadura', 'Armadura'],
    ['calca', 'Calça'], ['botas', 'Botas'], ['amuleto', 'Amuleto'], ['anel', 'Anel'],
  ];
  const ARMA = { knight: ['Sword Weapons', 'Axe Weapons', 'Club Weapons'], paladin: ['Distance Weapons'], sorcerer: ['Wands'], druid: ['Rods'], monk: ['Fist Fighting Weapons'] };
  const TIPOS = { capacete: ['Helmets'], armadura: ['Armors'], calca: ['Legs'], botas: ['Boots'], amuleto: ['Amulets and Necklaces'], anel: ['Rings'], mao2: ['Shields', 'Spellbooks', 'Quivers'] };
  const tiposDe = (v, s) => (s === 'arma' ? ARMA[v] : TIPOS[s]);
  const CHAVE = { Helmets: 'helmets', Armors: 'armors', Shields: 'shields', Spellbooks: 'spellbooks', Boots: 'boots', 'Sword Weapons': 'swords', 'Axe Weapons': 'axes', 'Club Weapons': 'clubs', Wands: 'wands', Rods: 'rods', 'Fist Fighting Weapons': 'fists' };
  const SKILL = { knight: ['sword|axe|club', 'skill de arma', 7], paladin: ['distance', 'distance', 15], sorcerer: ['magic', 'magic level', 34], druid: ['magic', 'magic level', 34], monk: ['fist', 'fist fighting', 43] };
  const MAGO = (v) => v === 'sorcerer' || v === 'druid';
  // vida, mana e capacidade por level (a soma é igual para todas as vocações)
  const POR_LVL = { knight: [15, 5, 25], paladin: [10, 15, 20], sorcerer: [5, 30, 10], druid: [5, 30, 10], monk: [10, 10, 25] };
  const base = (v, l) => { const [h, m, c] = POR_LVL[v]; const n = Math.max(0, l - 8); return [185 + n * h, 90 + n * m, 470 + n * c]; };
  // dano/cura base que vem do level: +1 a cada 5 levels até o 500, depois a cada 6 (até 1100), 7 (até 1800)...
  function baseLvl(l) {
    if (l <= 500) return Math.floor(l / 5);
    const S = Math.floor((Math.sqrt(2 * l + 2025) + 5) / 10);
    return Math.floor((l + 1000) / S) + 50 * S - 450;
  }
  // base power que a TibiaWiki ainda não traz (runas e duas magias), do guia que o Luis trouxe
  const BP_GUIA = { 'Light Magic Missile': 15, 'Heavy Magic Missile': 30, Stalagmite: 30, Avalanche: 50, 'Great Fireball': 50, Thunderstorm: 50, 'Stone Shower': 50, Explosion: 60, Icicle: 60, Fireball: 60, 'Holy Missile': 70, 'Sudden Death': 150, 'Ethereal Barrage': 40, 'Whirlwind Throw': 32 };
  const bpDe = (m) => m.base_poder || BP_GUIA[m.nome] || null;
  // escala: magic level (magos, holy do paladin e runas) ou arma × skill (knight, monk e distance do paladin)
  const porML = (v, m) => MAGO(v) || m.tipo === 'Rune' || (v === 'paladin' && m.elemento === 'Holy');
  // estimativa (guia): médio = bônus do level + ML × BP/12,5 + BP/4  ·  físico: bônus do level + ataque × skill × BP/1000; mín/máx = ±20%
  function estimar(v, m, r, me, extraSk = 0, semCal = false) {
    const bp0 = bpDe(m); if (!bp0 || m.subclasse === 'Healing') return null;
    const aug = augDaMagia(m.nome, r.augN), bp = bp0 * (1 + (aug?.pct || 0) / 100);
    let medio;
    if (porML(v, m)) { const ml = (MAGO(v) ? r.skTotal : (parseInt(me.ml, 10) || 0)) + (MAGO(v) ? extraSk : 0); if (!ml) return null; medio = r.lvlBase + (ml * bp) / 12.5 + bp / 4; }
    else { const atk = parseInt(me.atk, 10) || 0, sk = r.skTotal + extraSk; if (!atk || !sk) return null; medio = r.lvlBase + (atk * sk * bp) / 1000; }
    medio = (medio + r.fixo) * (1 + (r.crit * r.critExtra) / 10000) * (semCal ? 1 : (me.cal || 1));
    return { min: medio * 0.8, medio, max: medio * 1.2 };
  }
  // melhorias da roda que valem para um grupo de magias
  const GRUPO_AUG = { 26: ['Lightning', 'Strong Energy Strike', 'Strong Flame Strike'], 27: ["Hell's Core", 'Rage of the Skies'], 29: ['Forked Thorns', 'Forked Glacier'] };
  const pctAug = (txt) => { const m = String(txt || '').match(/\+(\d+(?:,\d+)?)% de (?:dano|cura) base/); return m ? parseFloat(m[1].replace(',', '.')) : 0; };

  const ler = () => (S.perfil?.analista && typeof S.perfil.analista === 'object' ? S.perfil.analista : {});
  let tSalvar;
  function salvar(novo) {
    S.perfil.analista = novo;
    clearTimeout(tSalvar);
    tSalvar = setTimeout(async () => {
      const { error } = await sb.from('profiles').update({ analista: novo }).eq('id', S.user.id);
      if (error) toast('Não deu para salvar no seu perfil agora.');
    }, 700);
  }
  const doVoc = (v) => { const d = ler(); return { ml: d.ml?.[v] ?? '', sk: d.sk?.[v] ?? '', atk: d.atk?.[v] ?? '', cal: d.cal?.[v] || null, set: d.set?.[v] || {} }; };

  async function carregar() {
    if (A.carregando) return; A.carregando = true;
    const tipos = [...new Set([...Object.values(ARMA).flat(), ...Object.values(TIPOS).flat()])];
    const [i, m] = await Promise.all([
      sb.from('itens_equip').select('nome,tipo,level,vocacoes,atributos,imbue_slots').in('tipo', tipos).order('nome').limit(3000),
      sb.from('imbuements').select('nome,nivel,categoria,efeito,slots').limit(300),
    ]);
    A.carregando = false;
    if (i.error || m.error) { toast('Não deu para carregar os itens agora.'); return; }
    A.itens = i.data || []; A.imbs = m.data || [];
    document.dispatchEvent(new Event('mg-render'));
  }
  const vocOk = (it, v) => !it.vocacoes || /without|all/i.test(it.vocacoes) || it.vocacoes.toLowerCase().includes(v);
  function chave(it) { if (it.tipo !== 'Distance Weapons') return CHAVE[it.tipo]; return /crossbow/i.test(it.nome) ? 'crossbows' : /bow\b/i.test(it.nome) ? 'bows' : null; }
  function compat(it, v) {
    const k = it && chave(it); if (!k || !A.imbs) return [];
    return A.imbs.filter((im) => String(im.slots || '').split(',').some((t) => {
      const m = t.trim().toLowerCase().match(/^([a-z ]+?)\s*(?:\(([a-z]+)\))?$/); return m && m[1] === k && (!m[2] || v.includes(m[2]));
    }));
  }
  // atributos do item ("magic level +6, ice magic level +1") → bônus
  function bonusItem(it, v) {
    const b = { skill: 0, el: {}, cura: 0 }, txt = String(it?.atributos || '').toLowerCase(), [re] = SKILL[v];
    for (const parte of txt.split(',')) {
      const p = parte.trim(), n = parseInt((p.match(/\+(\d+)/) || [])[1], 10); if (!n) continue;
      const el = p.match(/^(fire|ice|energy|earth|death|holy|healing) magic level/);
      if (el) { if (el[1] === 'healing') b.cura += n; else b.el[el[1]] = (b.el[el[1]] || 0) + n; continue; }
      if (re === 'magic' ? /^magic level/.test(p) : new RegExp(`^(${re}) fighting`).test(p)) b.skill += n;
    }
    return b;
  }
  const efeitoNum = (ef, i = 0) => parseFloat(String(ef || '').split(':')[1]?.split('·')[i]?.replace(/[^\d.]/g, '') || '0') || 0;

  // ---------- o cálculo ----------
  function calcular(ctx) {
    const { v, lvl } = ctx, me = doVoc(v), [, nomeSk, idSk] = SKILL[v];
    let skItens = 0, skImb = 0, crit = 0, critExtra = 0, leechV = 0, leechM = 0, curaML = 0;
    const el = {}, slotsVazios = [], equip = {};
    for (const [s] of SLOTS) {
      const sel = me.set[s] || {}, it = A.itens?.find((x) => x.nome === sel.i);
      if (!it) continue; equip[s] = it;
      const b = bonusItem(it, v); skItens += b.skill; curaML += b.cura; for (const k in b.el) el[k] = (el[k] || 0) + b.el[k];
      const imbs = (sel.m || []).map((n) => A.imbs?.find((x) => x.nome === n)).filter(Boolean);
      for (const im of imbs) {
        const tipo = String(im.efeito || '').split(':')[0].trim();
        if (/^(Epiphany|Slash|Chop|Bash|Precision|Punch)$/.test(tipo) && (tipo === 'Epiphany') === (SKILL[v][0] === 'magic')) skImb += efeitoNum(im.efeito);
        if (tipo === 'Strike') { critExtra = Math.max(critExtra, efeitoNum(im.efeito, 0)); crit = Math.max(crit, efeitoNum(im.efeito, 1)); }
        if (tipo === 'Vampirism') leechV += efeitoNum(im.efeito);
        if (tipo === 'Void') leechM += efeitoNum(im.efeito);
      }
      if ((it.imbue_slots || 0) > imbs.length) slotsVazios.push([s, it, (it.imbue_slots || 0) - imbs.length]);
    }
    // roda: bônus de skill (fatias cheias), melhorias e dano fixo
    const tiles = RODA_OF.voc[v], cheias = (i) => ctx.t[i] >= RODA_OF.max[i];
    let skRoda = 0; const augN = {};
    tiles.forEach(([, c, id, val], i) => { if (!cheias(i)) return; if (c === 'S') skRoda += val; if (c === 'A') augN[id] = (augN[id] || 0) + 1; if (c === 'L') { if (id === 6) leechV += val / 100; else leechM += val / 100; } });
    const fixo = ctx.nomes.reduce((s, n) => s + ctx.BONUS[ctx.estagio(ctx.a[n] || 0)], 0);
    const skBase = parseInt(me.sk || me.ml, 10) || 0;
    return { me, nomeSk, idSk, skBase, skItens, skImb, skRoda, skTotal: skBase + skItens + skImb + skRoda, crit, critExtra, leechV, leechM, curaML, el, slotsVazios, equip, augN, fixo, lvlBase: baseLvl(lvl) };
  }
  function augDaMagia(nome, augN) {
    for (const [id, n] of Object.entries(augN)) {
      const m = RODA_OF.medios[id]; if (!m) continue;
      const alvo = GRUPO_AUG[id] || [m[0]];
      if (alvo.includes(nome)) return { id, n, pct: pctAug(m[2]) + (n >= 2 ? pctAug(m[3]) : 0), txt: n >= 2 ? `${m[2]} · ${m[3]}` : m[2] };
    }
    return null;
  }

  // ---------- desenho ----------
  const num = (x, d = 0) => Number(x).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
  function campoItem(v, lvl, s, rot, sel) {
    const lista = (A.itens || []).filter((i) => tiposDe(v, s).includes(i.tipo) && vocOk(i, v) && (i.level || 0) <= Math.max(lvl, 8));
    const it = lista.find((i) => i.nome === sel.i) || (A.itens || []).find((i) => i.nome === sel.i);
    const imbs = it ? compat(it, v) : [], vagas = it?.imbue_slots || 0;
    return `<div class="an-slot"><label><span>${rot}</span>
      <input list="an-l-${s}" data-an-item="${s}" value="${esc(sel.i || '')}" placeholder="Digite o nome…" maxlength="60" autocomplete="off"></label>
      <datalist id="an-l-${s}">${lista.slice(0, 400).map((i) => `<option value="${esc(i.nome)}">`).join('')}</datalist>
      ${it ? `<small class="muted">${esc(it.atributos || 'sem bônus de skill')}${vagas ? ` · ${vagas} espaço${vagas > 1 ? 's' : ''} de imbuement` : ''}</small>` : ''}
      ${Array.from({ length: vagas }, (_, k) => `<select data-an-imb="${s}" data-an-k="${k}" aria-label="Imbuement ${k + 1} de ${rot}"><option value="">— imbuement ${k + 1} —</option>${imbs.map((im) => `<option value="${esc(im.nome)}" ${sel.m?.[k] === im.nome ? 'selected' : ''}>${esc(im.nome)} (${esc(im.efeito || '')})</option>`).join('')}</select>`).join('')}</div>`;
  }

  function conselhos(ctx, r, magias) {
    const { v, lvl, sit } = ctx, out = [];
    if (!r.skBase) out.push(['📝', `Coloque o seu ${r.nomeSk} sem bônus (o que aparece no Skills do jogo menos itens) para eu calcular o total.`]);
    else out.push(['📊', `Seu ${r.nomeSk} efetivo é <b>${num(r.skTotal)}</b>: ${num(r.skBase)} base${r.skItens ? ` + ${num(r.skItens)} dos itens` : ''}${r.skImb ? ` + ${num(r.skImb)} dos imbuements` : ''}${r.skRoda ? ` + ${num(r.skRoda)} da roda` : ''}.`]);
    if (!r.equip.arma) out.push(['🗡️', 'Escolha a sua arma: é dela que saem o crítico (Strike) e boa parte do roubo de vida e mana.']);
    for (const [s, it, n] of r.slotsVazios) {
      const sug = s === 'arma' ? (sit === 'boss' ? 'Powerful Strike (crítico)' : MAGO(v) ? 'Powerful Void (mana) ou Powerful Strike' : 'Powerful Strike ou Powerful Vampirism') : s === 'capacete' ? (MAGO(v) ? 'Powerful Epiphany ou Powerful Void' : 'Powerful Void (mana)') : s === 'armadura' ? 'Powerful Vampirism ou uma proteção do elemento da hunt' : s === 'botas' ? 'Powerful Swiftness (velocidade)' : 'uma proteção do elemento que você mais apanha';
      out.push(['✨', `${esc(it.nome)} tem ${n} espaço${n > 1 ? 's' : ''} de imbuement vazio${n > 1 ? 's' : ''}: para ${sit === 'boss' ? 'boss' : sit === 'time' ? 'hunt em time' : 'hunt solo'} eu colocaria ${sug}.`]);
    }
    const alvo = magias.filter((x) => x.est).sort((a, b) => b.est.medio - a.est.medio)[0];
    if (alvo) {
      const mais = estimar(v, alvo.m, r, r.me, MAGO(v) ? 4 : 2);
      if (mais) out.push(['📈', `Na <b>${esc(alvo.m.nome)}</b> (média ${num(alvo.est.medio)}), +${MAGO(v) ? '4 de magic level' : '2 de skill'} dariam <b>+${num(mais.medio - alvo.est.medio)}</b> por hit (${num(((mais.medio / alvo.est.medio) - 1) * 100, 1)}%).`]);
      if (!r.crit && r.equip.arma && compat(r.equip.arma, v).some((im) => /^Strike/.test(String(im.efeito)))) out.push(['💥', `Um Powerful Strike na arma (5% de chance, +40% de dano crítico) daria em média <b>+${num(alvo.est.medio * 0.02)}</b> por hit na ${esc(alvo.m.nome)}.`]);
    }
    if (r.crit) out.push(['💥', `Com Strike: ${num(r.crit)}% de chance de crítico com +${num(r.critExtra)}% de dano → em média <b>+${num((r.crit * r.critExtra) / 100, 1)}%</b> de dano.`]);
    if (sit !== 'boss' && r.leechM < 3 && MAGO(v)) out.push(['💧', `Seu roubo de mana está em ${num(r.leechM, 2)}%. Em hunt, um Void no capacete ou na arma economiza muita potion.`]);
    const semAug = magias.filter((x) => x.base && !x.aug && x.temAug).slice(0, 2);
    if (semAug.length) out.push(['☸️', `A roda tem melhoria para ${semAug.map((x) => `<b>${esc(x.m.nome)}</b>`).join(' e ')}, ${semAug.length > 1 ? 'que estão no seu combo, mas as fatias ainda não estão cheias' : 'que está no seu combo, mas a fatia ainda não está cheia'}.`]);
    if (ctx.prox) out.push(['🎯', `No <b>level ${num(ctx.prox[0])}</b> a build ${sit === 'boss' ? 'de boss' : sit === 'time' ? 'de time' : 'solo'} libera <b>${esc(ctx.prox[1])}</b> no estágio ${ctx.prox[2]} (+dano e cura fixos).`]);
    const livres = ctx.total - ctx.t.reduce((s, x) => s + x, 0);
    if (livres > 0) out.push(['⚠️', `Você tem <b>${num(livres)}</b> pontos da roda sem usar.`]);
    if (lvl < 300) out.push(['ℹ️', 'Até o level 300 não dá para ligar uma Revelation Perk; foque nas fatias do centro com vida/mana e nas melhorias das magias que você usa.']);
    return out;
  }

  function calibragem(v, magias, me) {
    const ok = magias.filter((x) => x.est);
    if (!ok.length) return '';
    return `<details class="an-cal" ${me.cal ? '' : 'open'}><summary>🎯 Calibrar com um hit seu ${me.cal ? `<small class="muted">(calibrado ×${num(me.cal, 2)})</small>` : ''}</summary>
      <p class="muted">Ataque um monstro sem fraqueza nem resistência ao elemento e veja no Server Log quanto saiu (ex.: "A rat loses 523 hit points due to your attack"). Use a média de 3–5 hits da mesma magia.</p>
      <div class="an-cal-l"><select data-an-cal-mg aria-label="Magia do hit">${ok.map((x) => `<option value="${esc(x.m.nome)}">${esc(x.m.nome)}</option>`).join('')}</select>
      <input type="number" min="1" max="100000" inputmode="numeric" data-an-cal-v placeholder="dano médio que você viu" aria-label="Dano que você viu">
      <button type="button" class="btn primario" data-an-cal="ok">Calibrar</button>${me.cal ? '<button type="button" class="btn" data-an-cal="zerar">Tirar calibragem</button>' : ''}</div></details>`;
  }

  function proximas(ctx, r) {
    const { v, sit } = ctx, combo = new Set(ctx.magiasCombo.map((m) => m.nome)), PESO = { solo: { L: 5, V: 2 }, time: { L: 4, V: 2 }, boss: { L: 3, V: 3 } }[sit];
    const ded = RODA_OF.ded[v], out = [];
    RODA_OF.voc[v].forEach(([s, c, id, val], i) => {
      const max = RODA_OF.max[i], falta = max - ctx.t[i];
      if (falta <= 0 || !ctx.liberada(ctx.t, i)) return;
      const m = RODA_OF.medios[id] || ['', ''];
      let nota = 0, porque = '';
      if (c === 'A') { const alvo = GRUPO_AUG[id] || [m[0]], usa = alvo.some((n) => combo.has(n)), n = r.augN[id] || 0; nota = usa ? 10 : 3; porque = `${m[0]} melhorada ${n ? 'II' : 'I'}: ${n ? m[3] : m[2]}${usa ? ' (está no seu combo)' : ''}`; }
      else if (c === 'S') { nota = 9; porque = `+${val} de ${m[0]}`; }
      else if (c === 'U') { nota = 8; porque = `${m[0]}: ${m[1]}`; }
      else if (c === 'L') { nota = PESO.L; porque = `+${(val / 100).toFixed(2).replace('.', ',')}% de ${m[0]}`; }
      else { nota = PESO.V; porque = m[0]; }
      const dedi = s === 4 ? `+${(max * 0.075).toFixed(2).replace('.', ',')}% de mitigação` : s === 2 ? `+${num(max * ded[2])} vida e +${num(max * ded[3])} mana` : `+${num(max * (s === 0 ? ded[0] : s === 1 ? ded[1] : ded[4]))} de ${['vida', 'mana', '', 'capacidade'][s]}`;
      out.push({ i, falta, nota: (nota * 100) / falta, porque, dedi, nome: m[0] });
    });
    return out.sort((x, y) => y.nota - x.nota).slice(0, 5);
  }

  function comparar(ctx) {
    const { v, lvl } = ctx, pts = ctx.total;
    return [['solo', '🗡️ Solo'], ['time', '👥 Time'], ['boss', '💀 Boss']].map(([sit, rot]) => {
      const a = ctx.recomendada(v, sit, pts), t = ctx.fatiasDe(v, a), d = RODA_OF.ded[v];
      let vida = 0, mana = 0, mit = 0, aug = 0, sk = 0;
      RODA_OF.voc[v].forEach(([s, c, , val], i) => {
        const p = t[i]; if (s === 0) vida += p * d[0]; else if (s === 1) mana += p * d[1]; else if (s === 2) { vida += p * d[2]; mana += p * d[3]; } else if (s === 4) mit += p * 0.075;
        if (p >= RODA_OF.max[i]) { if (c === 'A') aug++; if (c === 'S') sk += val; }
      });
      const nomes = ctx.nomes, fixo = nomes.reduce((s, n) => s + ctx.BONUS[ctx.estagio(a[n] || 0)], 0);
      const rev = nomes.filter((n) => ctx.estagio(a[n] || 0)).map((n) => `${n} ${['', 'I', 'II', 'III'][ctx.estagio(a[n])]}`).join(', ') || '—';
      return `<tr class="${ctx.sit === sit ? 'meu' : ''}"><th>${rot}</th><td>+${num(vida)}</td><td>+${num(mana)}</td><td>${num(mit, 2)}%</td><td>+${num(sk)}</td><td>${num(aug)}</td><td>+${num(fixo)}</td><td>${esc(rev)}</td></tr>`;
    }).join('');
  }

  function html(ctx) {
    if (!S.perfil) return '<div class="bloqueio">Entre na sua conta para usar o analista.</div>';
    if (!A.itens) { carregar(); return '<div class="bloqueio">🧠 Carregando itens e imbuements…</div>'; }
    const { v, lvl } = ctx, me = doVoc(v), r = calcular(ctx);
    const [vidaB, manaB, capB] = base(v, lvl);
    const magias = ctx.magiasCombo.map((m) => {
      const aug = augDaMagia(m.nome, r.augN), temAug = Object.values(RODA_OF.voc[v]).some(([, c, id]) => c === 'A' && (GRUPO_AUG[id] || [RODA_OF.medios[id]?.[0]]).includes(m.nome));
      const mult = (1 + (aug?.pct || 0) / 100) * (1 + (r.crit * r.critExtra) / 10000), bp = bpDe(m);
      return { m, base: bp, guia: !m.base_poder && !!bp, aug, temAug, mult, forca: bp ? bp * mult : null, est: estimar(v, m, r, me) };
    });
    const topo = Math.max(1, ...magias.map((x) => x.forca || 0));
    const dicas = conselhos(ctx, r, magias), prox = proximas(ctx, r);
    A.ult = { v, r, me, magias };
    return `<div class="an">
      <div class="an-ficha">
        <div class="an-campos">
          <label class="mg-lvl-campo">${MAGO(v) ? 'Magic level base' : `${esc(r.nomeSk[0].toUpperCase() + r.nomeSk.slice(1))} base`}<input type="number" min="0" max="300" inputmode="numeric" data-an="sk" value="${esc(String(me.sk || me.ml || ''))}" placeholder="ex.: 90"></label>
          ${!MAGO(v) ? `<label class="mg-lvl-campo">Magic level<input type="number" min="0" max="150" inputmode="numeric" data-an="ml" value="${esc(String(me.ml || ''))}" placeholder="ex.: 12"></label>
          <label class="mg-lvl-campo">Ataque da arma<input type="number" min="0" max="200" inputmode="numeric" data-an="atk" value="${esc(String(me.atk || ''))}" placeholder="ex.: 50" title="O número de ataque que aparece no Look da arma (com munição, para paladin)"></label>` : ''}
          <div class="an-kpis"><div><span>Vida</span><b>${num(vidaB)}</b></div><div><span>Mana</span><b>${num(manaB)}</b></div><div><span>Capacidade</span><b>${num(capB)}</b></div><div><span>Dano/cura do level</span><b>+${num(r.lvlBase)}</b></div></div>
        </div>
        <details class="an-equip" ${A.fechado ? '' : 'open'}><summary>🎒 Equipamento e imbuements</summary>
          <div class="an-slots">${SLOTS.map(([s, rot]) => campoItem(v, lvl, s, rot, me.set[s] || {})).join('')}</div></details>
      </div>
      <h3 class="mg-tit">🧠 O que eu faria</h3>
      <ul class="an-dicas">${dicas.map(([i, t]) => `<li><span aria-hidden="true">${i}</span><p>${t}</p></li>`).join('')}</ul>
      <h3 class="mg-tit">⚔️ Força das magias do combo</h3>
      <div class="tabela-wrap"><table class="an-tab"><tr><th>Magia</th><th>Base power</th><th>Roda</th><th>Dano estimado</th><th>Força</th></tr>
        ${magias.map((x) => `<tr><td><button type="button" class="rd-mg" data-mg-info="${esc(x.m.nome)}">${imgDoItem(x.m.nome, 'mg-ico')}<b>${esc(x.m.nome)}</b></button></td><td>${x.base ? `${num(x.base)}${x.guia ? '<small class="muted" title="Do guia de base power (a TibiaWiki ainda não traz)"> ·g</small>' : ''}` : '<span class="muted">—</span>'}</td><td>${x.aug ? `${x.aug.pct ? `<span class="pos">+${num(x.aug.pct, 1)}%</span> ` : ''}<small class="muted">${esc(x.aug.txt)}</small>` : x.temAug ? '<span class="muted">fatia vazia</span>' : '<span class="muted">—</span>'}</td><td>${x.est ? `<b>${num(x.est.min)}–${num(x.est.max)}</b><br><small class="muted">médio ${num(x.est.medio)}</small>` : `<span class="muted">${x.m.subclasse === 'Healing' ? 'cura' : x.base ? 'preencha a ficha' : '—'}</span>`}</td><td>${x.forca ? `<div class="an-barra"><i style="width:${Math.round((x.forca / topo) * 100)}%"></i><span>${num(x.forca)}</span></div>` : '<span class="muted">—</span>'}</td></tr>`).join('')}
      </table></div>
      <p class="dica">Dano estimado = bônus do level (+${num(r.lvlBase)}) + ${MAGO(v) ? 'magic level' : 'ataque × skill'} × base power, com a melhoria da roda, +${num(r.fixo)} fixos da roda e o crítico médio do Strike; mín/máx = ±20%. A fórmula vem de um guia da comunidade (a CipSoft não publica a oficial), por isso ${me.cal ? `está <b>calibrada com o seu hit (×${num(me.cal, 2)})</b>` : 'é uma estimativa: calibre com um hit seu logo abaixo'}. Antes de resistência e armadura do monstro. Força = base power × roda × crítico, para comparar magias. ·g = base power do guia (a TibiaWiki ainda não traz).${r.leechV || r.leechM ? ` Roubo de vida ${num(r.leechV, 2)}% · de mana ${num(r.leechM, 2)}%.` : ''}</p>
      ${calibragem(v, magias, me)}
      <h3 class="mg-tit">📈 Próximas fatias que mais rendem</h3>
      ${prox.length ? `<ol class="an-prox">${prox.map((p) => `<li><button type="button" class="link" data-an-ir="${p.i}">${esc(p.nome)}</button> <span class="muted">(${num(p.falta)} pontos)</span><br><small>${esc(p.porque)} · ${esc(p.dedi)}</small></li>`).join('')}</ol>` : '<p class="muted">Todas as fatias liberadas já estão cheias.</p>'}
      <h3 class="mg-tit">⚖️ Builds lado a lado (level ${num(lvl)})</h3>
      <div class="tabela-wrap"><table class="an-tab"><tr><th></th><th>Vida</th><th>Mana</th><th>Mitigação</th><th>${esc(r.nomeSk)}</th><th>Melhorias</th><th>Dano/cura</th><th>Revelation</th></tr>${comparar(ctx)}</table></div>
      <p class="dica">O analista é um conjunto de regras do TibiaHub (não usa serviço pago nem manda seus dados para fora). Vida, mana e capacidade da ficha são as do level, sem itens e sem a roda. Itens e imbuements: TibiaWiki (CC BY-SA); roda: www.tibia.com.</p>
    </div>`;
  }

  // ---------- eventos ----------
  const dentro = (e) => e.target.closest?.('#magias-app .an');
  function mexer(fn, v) {
    const d = JSON.parse(JSON.stringify(ler()));
    d.set = d.set || {}; d.set[v] = d.set[v] || {}; d.ml = d.ml || {}; d.sk = d.sk || {}; d.atk = d.atk || {}; d.cal = d.cal || {};
    fn(d); salvar(d); document.dispatchEvent(new Event('mg-render'));
  }
  document.addEventListener('change', (e) => {
    if (!dentro(e) || !A.ctxVoc) return;
    const v = A.ctxVoc, el = e.target;
    if (['sk', 'ml', 'atk'].includes(el.dataset.an)) { const n = Math.max(0, Math.min(300, parseInt(el.value, 10) || 0)); mexer((d) => { d[el.dataset.an][v] = n || undefined; }, v); return; }
    if (el.dataset.anItem) {
      const s = el.dataset.anItem, nome = el.value.trim().slice(0, 60);
      if (nome && !A.itens.some((i) => i.nome === nome)) { toast('Item não encontrado: escolha um da lista.'); return; }
      mexer((d) => { d.set[v][s] = nome ? { i: nome, m: [] } : undefined; }, v); return;
    }
    if (el.dataset.anImb) {
      const s = el.dataset.anImb, k = +el.dataset.anK, nome = el.value;
      mexer((d) => { const x = d.set[v][s]; if (!x) return; x.m = (x.m || []).slice(0, 3); x.m[k] = nome || null; }, v);
    }
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('#magias-app [data-an-cal]'); if (!b || !A.ult) return;
    const { v, r, me, magias } = A.ult;
    if (b.dataset.anCal === 'zerar') { mexer((d) => { d.cal[v] = undefined; }, v); toast('Calibragem removida.'); return; }
    const box = b.closest('.an-cal'), nome = box.querySelector('[data-an-cal-mg]').value, viu = parseInt(box.querySelector('[data-an-cal-v]').value, 10);
    const x = magias.find((y) => y.m.nome === nome), est = x && estimar(v, x.m, r, me, 0, true);
    if (!est || !(viu > 0)) { toast('Escolha a magia e digite o dano que você viu.'); return; }
    const f = viu / est.medio;
    if (f < 0.3 || f > 3) { toast('Esse valor está muito longe da estimativa: confira o ML/skill, o ataque da arma e se o monstro não tinha fraqueza ou resistência.'); return; }
    mexer((d) => { d.cal[v] = Math.round(f * 1000) / 1000; }, v);
    toast(`Calibrado: a estimativa agora usa ×${f.toFixed(2).replace('.', ',')}.`);
  });
  document.addEventListener('toggle', (e) => { if (e.target.classList?.contains('an-equip')) A.fechado = !e.target.open; }, true);
  window.ANALISTA = { html(ctx) { A.ctxVoc = ctx.v; return html(ctx); } };
})();
