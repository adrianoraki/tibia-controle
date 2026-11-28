// TibiaHub — Analista da Roda do Destino: uma "mini IA" por regras que roda no navegador.
// Junta level, magic level/skill, equipamento, imbuements e a roda para dizer o que rende mais.
// Dados: itens e imbuements (TibiaWiki, CC BY-SA), magias com base power (TibiaWiki), roda (tibia.com).
// Todo texto de fora passa por esc(). Nada de HTML vindo do banco.
(() => {
  const A = { itens: null, imbs: null, carregando: false, dados: null };
  const SLOTS = [
    ['arma', 'Arma', 'Magic Sword'], ['mao2', 'Escudo / livro', 'Dwarven Shield'], ['capacete', 'Capacete', 'Steel Helmet'], ['armadura', 'Armadura', 'Plate Armor'],
    ['calca', 'Calça', 'Plate Legs'], ['botas', 'Botas', 'Leather Boots'], ['amuleto', 'Amuleto', 'Platinum Amulet'], ['anel', 'Anel', 'Might Ring'],
  ];
  // tipos de arma por vocação: [chave, nome, item que serve de ícone, filtro]
  const ARMAS = {
    knight: [['sword', 'Sword', 'Magic Sword', (i) => i.tipo === 'Sword Weapons'], ['axe', 'Axe', 'Stonecutter Axe', (i) => i.tipo === 'Axe Weapons'], ['club', 'Club', 'Thunder Hammer', (i) => i.tipo === 'Club Weapons']],
    paladin: [['bow', 'Bow', 'Bow', (i) => i.tipo === 'Distance Weapons' && /bow\b/i.test(i.nome) && !/crossbow/i.test(i.nome)], ['crossbow', 'Crossbow', 'Crossbow', (i) => i.tipo === 'Distance Weapons' && /crossbow/i.test(i.nome)], ['dist', 'Lança/outra', 'Royal Spear', (i) => i.tipo === 'Distance Weapons' && !/bow\b/i.test(i.nome)]],
    sorcerer: [['wand', 'Wand', 'Wand of Vortex', (i) => i.tipo === 'Wands']],
    druid: [['rod', 'Rod', 'Snakebite Rod', (i) => i.tipo === 'Rods']],
    monk: [['fist', 'Fist', 'Pair of Monk Fists', (i) => i.tipo === 'Fist Fighting Weapons']],
  };
  const tipoArma = (v, sel) => ARMAS[v].find((x) => x[0] === sel?.t) || ARMAS[v][0];
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
  // Fórmulas do Tibia 15.25 com base power (documentadas pela comunidade e conferidas com exemplos):
  //   magia de magic level: médio = B(L) + bp/25 × ML + bp/6
  //   magia de skill (arma): médio = B(L) + bp/1000 × skill × ataque + bp/6
  //   mínimo = ⌊médio × 0,9⌋ · máximo = ⌈médio × 1,1⌉
  // Em cima disso: melhoria da roda no bp, +dano fixo das Revelation Perks e o crítico médio do Strike.
  function faixa(medio, r, me, critMais = 0) {
    const m = (medio + r.fixo) * (1 + (r.crit * (r.critExtra + (r.gem?.critx || 0) + critMais)) / 10000) * (me.cal || 1);
    const avg = Math.round(m);
    return { min: Math.floor(avg * 0.9), medio: avg, max: Math.ceil(avg * 1.1) };
  }
  function estimar(v, m, r, me, extraSk = 0, semCal = false, extra = {}) {
    const bp0 = bpDe(m); if (!bp0 || m.subclasse === 'Healing') return null;
    const aug = augDaMagia(m.nome, r.augN), bp = bp0 * (1 + ((aug?.pct || 0) + (r.gem?.base[m.nome] || 0) + (extra.base?.[m.nome] || 0)) / 100);
    let medio;
    if (porML(v, m)) { const ml = (MAGO(v) ? r.skTotal : (parseInt(me.ml, 10) || 0)) + (MAGO(v) ? extraSk : 0); if (!ml) return null; medio = r.lvlBase + (bp / 25) * ml + bp / 6; }
    else { const atk = r.atk, sk = r.skTotal + extraSk; if (!atk || !sk) return null; medio = r.lvlBase + (bp / 1000) * sk * atk + bp / 6; }
    return faixa(medio, r, semCal ? { ...me, cal: 1 } : me, (r.gem?.crit[m.nome] || 0) + (extra.crit?.[m.nome] || 0) + (extra.critx || 0));
  }
  // ataque básico (sem magia): o = ⌊6 × ataque / 5⌋ × (skill + 4) / 28; médio = B(L) + o × r (r = 2 no monk); mín = B + o·r/2, máx = B + o·r·2
  function ataqueBasico(v, r) {
    if (MAGO(v) || !r.atk || !r.skTotal) return null;
    const o = (Math.floor((6 * r.atk) / 5) * (r.skTotal + 4)) / 28, k = v === 'monk' ? 2 : 1, cm = 1 + (r.crit * r.critExtra) / 10000;
    return { min: Math.floor((r.lvlBase + (o * k) / 2) * cm), medio: Math.floor((r.lvlBase + o * k) * cm), max: Math.floor((r.lvlBase + o * k * 2) * cm) };
  }
  // de que elementos é feito o dano: magia de ML = elemento da magia; magia de arma e ataque básico = elementos da arma
  const elDe = (m) => String(m?.elemento || 'Physical').toLowerCase().replace('poison', 'earth');
  const partesDe = (v, m, r) => (m && porML(v, m) ? { [elDe(m)]: 1 } : (Object.keys(r.partesArma || {}).length ? r.partesArma : { physical: 1 }));
  // armadura do monstro tira um valor de cada golpe físico de arma: sorteio entre ⌊a/2⌋ e a−(a mod 2)−1 (média usada aqui)
  const armorMedia = (a) => (!a ? 0 : a > 3 ? (Math.floor(a / 2) + (a - (a % 2) - 1)) / 2 : a / 2);
  function contraMob(est, partes, mob, deArma) {
    if (!est || !mob) return null;
    const mods = mob.mods || {}, f = (k) => (Number.isFinite(+mods[k]) ? +mods[k] : 100) / 100;
    const mult = Object.entries(partes).reduce((t, [k, fr]) => t + fr * f(k), 0);
    const tira = deArma ? (partes.physical || 0) * f('physical') * armorMedia(+mob.armor || 0) : 0;
    const g = (x) => Math.max(0, Math.round(x * mult - tira));
    return { min: g(est.min), medio: g(est.medio), max: g(est.max), pct: Math.round(mult * 100) };
  }
  const txtPartes = (p) => Object.entries(p).filter(([, f]) => f > 0.005).sort((a, b) => b[1] - a[1]).map(([k, f]) => `${EL_PT[k] || k}${Object.keys(p).length > 1 ? ` ${Math.round(f * 100)}%` : ''}`).join(' · ');

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
  const doVoc = (v) => { const d = ler(); return { gemas: Array.isArray(d.gemas?.[v]) ? d.gemas[v] : [], ml: d.ml?.[v] ?? '', sk: d.sk?.[v] ?? '', atk: d.atk?.[v] ?? '', cal: d.cal?.[v] || null, set: d.set?.[v] || {}, mob: typeof d.mob === 'string' ? d.mob : '', cmp: d.cmp?.[v] || 'nada', roda: Array.isArray(d.rodas?.[v]) ? d.rodas[v] : null }; };

  async function carregar() {
    if (A.carregando) return; A.carregando = true;
    const tipos = [...new Set([...Object.values(ARMA).flat(), ...Object.values(TIPOS).flat()])];
    const [i, m, c] = await Promise.all([
      sb.from('itens_equip').select('nome,tipo,level,vocacoes,armor,atributos,imbue_slots,ataque,ataque_el').in('tipo', tipos).order('nome').limit(3000),
      sb.from('imbuements').select('nome,nivel,categoria,efeito,slots').limit(300),
      sb.from('criaturas').select('nome,hp,mods:detalhes->mods,armor:detalhes->armor').order('nome').limit(4000),
    ]);
    A.carregando = false;
    if (i.error || m.error) { toast('Não deu para carregar os itens agora.'); return; }
    A.itens = i.data || []; A.imbs = m.data || []; A.mobs = (c.data || []).filter((x) => x.mods && typeof x.mods === 'object');
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
  const PROT_IMB = { 'Dragon Hide': 'fire', 'Snake Skin': 'earth', 'Quara Scale': 'ice', 'Cloud Fabric': 'energy', 'Lich Shroud': 'death', 'Demon Presence': 'holy' };
  const CONV_IMB = { Scorch: 'fire', Venom: 'earth', Frost: 'ice', Electrify: 'energy', Reap: 'death' };
  const EL_PT = { physical: 'físico', fire: 'fogo', ice: 'gelo', energy: 'energia', earth: 'terra', death: 'morte', holy: 'sagrado' };
  const efeitoNum = (ef, i = 0) => parseFloat(String(ef || '').split(':')[1]?.split('·')[i]?.replace(/[^\d.]/g, '') || '0') || 0;

  // ---------- gemas ----------
  const QUAL = ['Sem gema', 'Lesser', 'Regular', 'Greater'];
  const ROMANO_G = ['I', 'II', 'III', 'IV'];
  const basicDe = (v) => [...(GEMAS.basicVoc[MAGO(v) ? 'mago' : v] || []), ...GEMAS.basicGeral];
  const supremeDe = (v) => [...(GEMAS.supremeVoc[v] || []), ...GEMAS.supremeGeral];
  const fmtP = (x) => num(x, x % 1 ? (x * 10 % 1 ? 2 : 1) : 0);
  function rotBasic(ef, g = 0) {
    const k = GEMAS.graus[g] || 1, out = [];
    if (ef.hp) out.push(`+${num(Math.round(ef.hp * k))} vida`);
    if (ef.mana) out.push(`+${num(Math.round(ef.mana * k))} mana`);
    if (ef.cap) out.push(`+${num(Math.round(ef.cap * k))} cap`);
    for (const [e, x] of Object.entries(ef.res || {})) out.push(`+${fmtP(x * k)}% ${EL_PT[e]}`);
    for (const [e, x] of Object.entries(ef.neg || {})) out.push(`${fmtP(x)}% ${EL_PT[e]}`);
    if (ef.mit) out.push(`+${fmtP(ef.mit * k)}% mitigação`);
    if (ef.md) out.push(`+${fmtP(ef.md * k)}% res. mana drain`);
    if (ef.ld) out.push(`+${fmtP(ef.ld * k)}% res. life drain`);
    return out.join(' · ');
  }
  function rotSupreme([sp, tp, val], g = 0) {
    const k = GEMAS.graus[g] || 1, x = fmtP(val * k), mom = g ? ` · +${['', '0,33', '0,66', '1'][g]}% momentum` : '';
    return tp === 'crit' ? `${sp}: +${x}% dano crítico` : tp === 'base' ? `${sp}: +${x}% dano base` : tp === 'heal' ? `${sp}: +${x}% cura base`
      : tp === 'cd' ? `${sp}: −${num(val)}s de recarga${mom}` : tp === 'rev' ? `Revelation Mastery ${sp}: +${num(Math.round(val * k))} pontos`
      : tp === 'dodge' ? `+${x}% dodge` : tp === 'critx' ? `+${x}% dano crítico (todas)` : tp === 'll' ? `+${x}% life leech` : `+${x}% mana leech`;
  }
  // nível de Ressonância de Vaso de cada domínio = fatias "Vaso" cheias nele (0 a 3)
  function ressonancia(v, t) {
    const n = [0, 0, 0, 0];
    RODA_OF.voc[v].forEach(([, c], i) => { if (c === 'V' && t[i] >= RODA_OF.max[i]) n[['TL', 'TR', 'BL', 'BR'].indexOf(RODA_OF.ids[i].slice(1, 3))]++; });
    return n;
  }
  function efeitoGemas(v, t, gemas) {
    const res = ressonancia(v, t), g = { hp: 0, mana: 0, cap: 0, res: {}, mit: 0, md: 0, ld: 0, dodge: 0, critx: 0, ll: 0, ml: 0, base: {}, crit: {}, heal: {}, rev: {}, bonus: 0, vasos: [] };
    const B = basicDe(v), SU = supremeDe(v);
    for (let q = 0; q < 4; q++) {
      const gm = gemas[q] || {}, qual = Math.max(0, Math.min(3, +gm.q || 0)), nv = res[q], st = { qual, nv, ativos: [] };
      g.vasos.push(st); if (!qual) continue;
      if (nv === qual) g.bonus += qual === 3 ? 2 : 1;
      const usa = (slot, mod, grau, nivel) => { if (!mod) return; const ok = nv >= nivel; st.ativos.push([slot, ok]); if (!ok) return;
        const k = GEMAS.graus[Math.max(0, Math.min(3, +grau || 0))];
        if (slot === 's') { const [sp, tp, val] = mod; const x = val * k;
          if (tp === 'base') g.base[sp] = (g.base[sp] || 0) + x; else if (tp === 'crit') g.crit[sp] = (g.crit[sp] || 0) + x; else if (tp === 'heal') g.heal[sp] = (g.heal[sp] || 0) + x;
          else if (tp === 'rev') g.rev[sp] = (g.rev[sp] || 0) + Math.round(val * k); else if (tp === 'dodge') g.dodge += x; else if (tp === 'critx') g.critx += x; else if (tp === 'll') g.ll += x; else if (tp === 'ml') g.ml += x;
          return; }
        const ef = mod[3];
        g.hp += Math.round((ef.hp || 0) * k); g.mana += Math.round((ef.mana || 0) * k); g.cap += Math.round((ef.cap || 0) * k);
        g.mit += (ef.mit || 0) * k; g.md += (ef.md || 0) * k; g.ld += (ef.ld || 0) * k;
        for (const [e, x] of Object.entries(ef.res || {})) g.res[e] = (g.res[e] || 0) + x * k;
        for (const [e, x] of Object.entries(ef.neg || {})) g.res[e] = (g.res[e] || 0) + x;
      };
      usa('1', B.find((b) => b[0] === gm.m1), gm.g1, 1);
      if (qual >= 2) usa('2', B.find((b) => b[0] === gm.m2), gm.g2, 2);
      if (qual >= 3) usa('s', SU[+gm.s] !== undefined && gm.s !== '' && gm.s != null ? SU[+gm.s] : null, gm.gs, 3);
    }
    return g;
  }

  // ---------- o cálculo ----------
  function calcular(ctx) {
    const { v, lvl } = ctx, me = doVoc(v), [, nomeSk, idSk] = SKILL[v];
    let skItens = 0, skImb = 0, crit = 0, critExtra = 0, leechV = 0, leechM = 0, curaML = 0, armadura = 0, defesa = 0;
    const el = {}, slotsVazios = [], equip = {}, prot = {}, conv = {};
    for (const [s] of SLOTS) {
      const sel = me.set[s] || {}, it = A.itens?.find((x) => x.nome === sel.i);
      if (!it) continue; equip[s] = it;
      if (s === 'mao2' && it.tipo === 'Shields') defesa = it.armor || 0; else if (s !== 'arma' && s !== 'mao2' && it.armor > 0) armadura += it.armor;
      for (const parte of String(it.atributos || '').toLowerCase().split(',')) { const pm = parte.trim().match(/^(physical|fire|ice|energy|earth|death|holy) ([+-]\d+)%/); if (pm) prot[pm[1]] = (prot[pm[1]] || 0) + parseInt(pm[2], 10); }
      const b = bonusItem(it, v); skItens += b.skill; curaML += b.cura; for (const k in b.el) el[k] = (el[k] || 0) + b.el[k];
      const imbs = (sel.m || []).map((n) => A.imbs?.find((x) => x.nome === n)).filter(Boolean);
      for (const im of imbs) {
        const tipo = String(im.efeito || '').split(':')[0].trim();
        if (/^(Epiphany|Slash|Chop|Bash|Precision|Punch)$/.test(tipo) && (tipo === 'Epiphany') === (SKILL[v][0] === 'magic')) skImb += efeitoNum(im.efeito);
        if (tipo === 'Strike') { critExtra = Math.max(critExtra, efeitoNum(im.efeito, 0)); crit = Math.max(crit, efeitoNum(im.efeito, 1)); }
        if (tipo === 'Vampirism') leechV += efeitoNum(im.efeito);
        if (tipo === 'Void') leechM += efeitoNum(im.efeito);
        if (PROT_IMB[tipo]) prot[PROT_IMB[tipo]] = (prot[PROT_IMB[tipo]] || 0) + efeitoNum(im.efeito);
        if (CONV_IMB[tipo] && s === 'arma') conv[CONV_IMB[tipo]] = (conv[CONV_IMB[tipo]] || 0) + efeitoNum(im.efeito);
      }
      if ((it.imbue_slots || 0) > imbs.length) slotsVazios.push([s, it, (it.imbue_slots || 0) - imbs.length]);
    }
    // roda: bônus de skill (fatias cheias), melhorias e dano fixo
    const tiles = RODA_OF.voc[v], cheias = (i) => ctx.t[i] >= RODA_OF.max[i];
    let skRoda = 0; const augN = {};
    tiles.forEach(([, c, id, val], i) => { if (!cheias(i)) return; if (c === 'S') skRoda += val; if (c === 'A') augN[id] = (augN[id] || 0) + 1; if (c === 'L') { if (id === 6) leechV += val / 100; else leechM += val / 100; } });
    const gem = efeitoGemas(v, ctx.t, me.gemas);
    for (const [e, x] of Object.entries(gem.res)) prot[e] = (prot[e] || 0) + x;
    leechV += gem.ll; leechM += gem.ml;
    // Revelation Mastery soma pontos ao domínio para o estágio da Revelation Perk
    const fixo = ctx.nomes.reduce((s, n) => s + ctx.BONUS[ctx.estagio((ctx.a[n] || 0) + (gem.rev[n] || 0))], 0) + gem.bonus;
    const skBase = parseInt(me.sk || me.ml, 10) || 0;
    const atkAuto = equip.arma?.ataque || null, atk = parseInt(me.atk, 10) || atkAuto || 0;
    // ataque da arma por elemento: físico + elemental; imbuement de dano converte parte do físico
    const elArma = String(equip.arma?.ataque_el || '').match(/^([a-z]+) (\d+)$/), atkElN = elArma ? +elArma[2] : 0;
    const partesArma = {}; if (atk > 0) {
      const fis = Math.max(0, (me.atk ? atk : (equip.arma?.ataque || 0)) - atkElN), tot = fis + atkElN || 1;
      const somaConv = Object.values(conv).reduce((x, y) => x + y, 0), convTot = Math.min(100, somaConv) / 100;
      partesArma.physical = (fis / tot) * (1 - convTot);
      if (elArma) partesArma[elArma[1]] = (partesArma[elArma[1]] || 0) + atkElN / tot;
      for (const [k, pc] of Object.entries(conv)) partesArma[k] = (partesArma[k] || 0) + (fis / tot) * convTot * (pc / somaConv);
    }
    return { gem, partesArma, armadura, defesa, prot, conv, me, atk, atkAuto, atkEl: equip.arma?.ataque_el || null, nomeSk, idSk, skBase, skItens, skImb, skRoda, skTotal: skBase + skItens + skImb + skRoda, crit, critExtra, leechV, leechM, curaML, el, slotsVazios, equip, augN, fixo, lvlBase: baseLvl(lvl) };
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
  function opcoes(v, lvl, s, sel) {
    const filtro = s === 'arma' ? tipoArma(v, sel)[3] : (i) => tiposDe(v, s).includes(i.tipo);
    return (A.itens || []).filter((i) => filtro(i) && vocOk(i, v) && (i.level || 0) <= Math.max(lvl, 8))
      .sort((x, y) => (y.level || 0) - (x.level || 0) || x.nome.localeCompare(y.nome));
  }
  function campoItem(v, lvl, s, rot, icoSlot, sel) {
    const it = (A.itens || []).find((i) => i.nome === sel.i);
    const imbs = it ? compat(it, v) : [], vagas = it?.imbue_slots || 0, ta = s === 'arma' ? tipoArma(v, sel) : null;
    const rotulo = ta ? ta[1] : rot;
    return `<div class="an-slot"><div class="an-slot-cab">${imgDoItem(it ? it.nome : (ta ? ta[2] : icoSlot), 'an-slot-ico')}<b>${esc(rotulo)}</b></div>
      ${ta && ARMAS[v].length > 1 ? `<div class="an-tipos" role="radiogroup" aria-label="Tipo de arma">${ARMAS[v].map(([k, n, ico]) => `<button type="button" role="radio" aria-checked="${ta[0] === k}" class="${ta[0] === k ? 'ativo' : ''}" data-an-tipo="${k}">${imgDoItem(ico, 'an-tipo-ico')}${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="an-combo" data-an-combo="${s}">
        <input type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${esc(rotulo)}" data-an-busca="${s}" value="${esc(sel.i || '')}" placeholder="Digite o nome ou abra a lista" maxlength="60" autocomplete="off">
        ${sel.i ? `<button type="button" class="an-combo-x" data-an-limpar="${s}" aria-label="Tirar ${esc(rotulo)}">✕</button>` : ''}
        <button type="button" class="an-combo-seta" data-an-abrir="${s}" aria-label="Abrir a lista de ${esc(rotulo)}">▾</button>
        <ul class="an-lista" role="listbox" hidden></ul>
      </div>
      ${it ? `<small class="muted">${it.ataque ? `<b>Atk ${num(it.ataque)}</b>${it.ataque_el ? ` (${esc(it.ataque_el)})` : ''} · ` : ''}${it.level ? `lvl ${num(it.level)} · ` : ''}${esc(it.atributos || 'sem bônus de skill')}${vagas ? ` · ${vagas} espaço${vagas > 1 ? 's' : ''} de imbuement` : ''}</small>` : ''}
      ${Array.from({ length: vagas }, (_, k) => `<select data-an-imb="${s}" data-an-k="${k}" aria-label="Imbuement ${k + 1} de ${esc(rotulo)}"><option value="">— imbuement ${k + 1} —</option>${imbs.map((im) => `<option value="${esc(im.nome)}" ${sel.m?.[k] === im.nome ? 'selected' : ''}>${esc(im.nome)} (${esc(im.efeito || '')})</option>`).join('')}</select>`).join('')}</div>`;
  }
  function encherLista(box, filtro) {
    const s = box.dataset.anCombo, v = A.ctxVoc, sel = doVoc(v).set[s] || {}, q = String(filtro || '').trim().toLowerCase();
    const ul = box.querySelector('.an-lista');
    if (s === 'mob') {
      const ms = (A.mobs || []).filter((m) => !q || m.nome.toLowerCase().includes(q)).sort((a, b) => (q ? a.nome.toLowerCase().indexOf(q) - b.nome.toLowerCase().indexOf(q) : 0) || a.nome.localeCompare(b.nome)).slice(0, 60);
      ul.innerHTML = ms.length ? ms.map((m, k) => `<li role="option" id="an-o-mob-${k}" data-an-esc="${esc(m.nome)}" class="${k === 0 ? 'foco' : ''}">${imgDoItem(m.nome, 'an-op-ico')}<span><b>${esc(m.nome)}</b><small>${esc([m.hp ? `${m.hp} de vida` : '', ...['fire', 'ice', 'energy', 'earth', 'death', 'holy', 'physical'].filter((e) => Number.isFinite(+m.mods?.[e]) && +m.mods[e] !== 100).map((e) => `${EL_PT[e]} ${m.mods[e]}%`)].filter(Boolean).join(' · '))}</small></span></li>`).join('') : '<li class="vazio muted">Nenhum monstro com esse nome.</li>';
      ul.hidden = false; box.querySelector('input').setAttribute('aria-expanded', 'true'); return;
    }
    const lista = opcoes(v, A.ctxLvl || 1, s, sel).filter((i) => !q || i.nome.toLowerCase().includes(q)).slice(0, 60);
    ul.innerHTML = lista.length ? lista.map((i, k) => `<li role="option" id="an-o-${s}-${k}" data-an-esc="${esc(i.nome)}" class="${k === 0 ? 'foco' : ''}">${imgDoItem(i.nome, 'an-op-ico')}<span><b>${esc(i.nome)}</b><small>${esc([i.ataque ? `Atk ${i.ataque}${i.ataque_el ? ` (${i.ataque_el})` : ''}` : '', i.level ? `lvl ${num(i.level)}` : '', i.atributos || '', i.imbue_slots ? `${i.imbue_slots} imbue` : ''].filter(Boolean).join(' · '))}</small></span></li>`).join('') : '<li class="vazio muted">Nada encontrado para o seu level e vocação.</li>';
    ul.hidden = false; box.querySelector('input').setAttribute('aria-expanded', 'true');
  }
  function fecharListas(menos) { document.querySelectorAll('#magias-app .an-lista:not([hidden])').forEach((ul) => { if (ul.parentElement !== menos) { ul.hidden = true; ul.parentElement.querySelector('input')?.setAttribute('aria-expanded', 'false'); } }); }
  function escolherItem(s, nome) { const v = A.ctxVoc; if (s === 'mob') { mexer((d) => { d.mob = nome || undefined; }, v); return; } mexer((d) => { const t = d.set[v][s]?.t; d.set[v][s] = nome ? { i: nome, m: [], t } : (t ? { t } : undefined); }, v); }

  function conselhos(ctx, r, magias) {
    const { v, lvl, sit } = ctx, out = [];
    if (!r.skBase) out.push(['📝', `Coloque o seu ${r.nomeSk} sem bônus (o que aparece no Skills do jogo menos itens) para eu calcular o total.`]);
    else out.push(['📊', `Seu ${r.nomeSk} efetivo é <b>${num(r.skTotal)}</b>: ${num(r.skBase)} base${r.skItens ? ` + ${num(r.skItens)} dos itens` : ''}${r.skImb ? ` + ${num(r.skImb)} dos imbuements` : ''}${r.skRoda ? ` + ${num(r.skRoda)} da roda` : ''}.`]);
    if (!MAGO(v) && r.equip.arma && !r.atkAuto && !r.me.atk) out.push(['🗡️', `O ataque da <b>${esc(r.equip.arma.nome)}</b> ainda está chegando da TibiaWiki (atualiza em alguns minutos). Se quiser, digite o ataque do Look da arma.`]);
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
    const mobC = r.me.mob ? (A.mobs || []).find((x) => x.nome === r.me.mob) : null;
    if (mobC) {
      const mods = mobC.mods || {}, val = (k) => (Number.isFinite(+mods[k]) ? +mods[k] : 100);
      const melhor = ['physical', 'fire', 'ice', 'energy', 'earth', 'death', 'holy'].sort((a, b) => val(b) - val(a))[0];
      const armaEl = Object.entries(r.partesArma || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!MAGO(v) && armaEl && val(armaEl) < 100 && val(melhor) > val(armaEl)) out.push(['🧊', `O <b>${esc(mobC.nome)}</b> resiste a ${EL_PT[armaEl]} (${val(armaEl)}%), que é o elemento principal da sua arma. Uma arma de ${EL_PT[melhor]} (${val(melhor)}%) bateria mais nele.`]);
      else if (val(melhor) > 100) out.push(['🎯', `O ponto fraco do <b>${esc(mobC.nome)}</b> é ${EL_PT[melhor]} (${val(melhor)}%).`]);
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
    return `<details class="an-cal"><summary>🎯 Ajuste fino com um hit seu <small class="muted">(opcional${me.cal ? ` · ligado ×${num(me.cal, 2)}` : ''})</small></summary>
      <p class="muted">Não precisa: o cálculo já usa a fórmula do jogo. Só use se quiser comparar com o Server Log (média de 3–5 hits num monstro sem fraqueza nem resistência).</p>
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

  // quadro das gemas: um vaso por domínio, com a ressonância que a roda analisada dá
  const COR_DOM = ['#94c412', '#ef1a38', '#18cd8f', '#e618da'];
  function cartaoGemas(v, ctx, r, me, magias) {
    const B = basicDe(v), SU = supremeDe(v), g = r.gem;
    const opt = (lista, sel, rot) => lista.map((b) => `<option value="${esc(b[0])}" ${sel === b[0] ? 'selected' : ''}>${esc(rot(b))}</option>`).join('');
    const grau = (q, k, val) => `<select class="an-gg" data-an-gg="${q}:${k}" aria-label="Grau">${ROMANO_G.map((x, i) => `<option value="${i}" ${(+val || 0) === i ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    const vasos = ctx.nomes.map((nome, q) => {
      const gm = me.gemas[q] || {}, st = g.vasos[q], qual = st.qual, liga = (k) => st.nv >= k;
      const linha = (k, html) => `<div class="an-gl ${liga(k) ? '' : 'off'}">${html}${liga(k) ? '' : `<small class="muted">🔒 ressonância ${k}</small>`}</div>`;
      return `<div class="an-vaso" style="--c:${COR_DOM[q]}">
        <div class="an-vaso-cab"><b>${esc(nome)}</b><span class="an-ress" title="Ressonância de Vaso: fatias Vaso cheias neste domínio">${[1, 2, 3].map((k) => `<i class="${st.nv >= k ? 'on' : ''}"></i>`).join('')}<small>${st.nv}/3</small></span></div>
        <div class="an-gq" role="radiogroup" aria-label="Tamanho da gema">${QUAL.map((t, i) => `<button type="button" role="radio" aria-checked="${qual === i}" class="${qual === i ? 'ativo' : ''}" data-an-gq="${q}:${i}">${i ? '💎'.repeat(1) + ' ' : ''}${t}</button>`).join('')}</div>
        ${qual >= 1 ? linha(1, `<select data-an-gm="${q}:m1" aria-label="1º mod"><option value="">— 1º mod —</option>${opt(B.filter((b) => b[2][0]), gm.m1, (b) => rotBasic(b[3], +gm.g1 || 0))}</select>${grau(q, 'g1', gm.g1)}`) : ''}
        ${qual >= 2 ? linha(2, `<select data-an-gm="${q}:m2" aria-label="2º mod"><option value="">— 2º mod (resistência) —</option>${opt(B.filter((b) => b[2][1]), gm.m2, (b) => rotBasic(b[3], +gm.g2 || 0))}</select>${grau(q, 'g2', gm.g2)}`) : ''}
        ${qual >= 3 ? linha(3, `<select data-an-gm="${q}:s" aria-label="Supreme mod"><option value="">— supreme mod —</option>${SU.map((x, i) => `<option value="${i}" ${String(gm.s) === String(i) ? 'selected' : ''}>${esc(rotSupreme(x, +gm.gs || 0))}</option>`).join('')}</select>${grau(q, 'gs', gm.gs)}`) : ''}
        ${qual ? `<small class="${st.nv === qual ? 'pos' : 'muted'}">${st.nv === qual ? `✔ ressonância bate com a ${QUAL[qual]}: +${qual === 3 ? 2 : 1} de dano e cura` : `ressonância ${st.nv} · ${QUAL[qual]} pede ${qual} para o bônus de +${qual === 3 ? 2 : 1}`}</small>` : ''}
      </div>`;
    }).join('');
    // sugestões: supreme que mais aumenta o dano médio do seu combo
    const ataque = magias.filter((x) => x.est);
    const ganhos = SU.map((x, i) => {
      if (!['base', 'crit', 'critx'].includes(x[1])) return null;
      const extra = x[1] === 'base' ? { base: { [x[0]]: x[2] * 1.5 } } : x[1] === 'crit' ? { crit: { [x[0]]: x[2] * 1.5 } } : { critx: x[2] * 1.5 };
      const d = ataque.reduce((t, y) => { const e = estimar(v, y.m, r, me, 0, false, extra); return t + (e ? e.medio - y.est.medio : 0); }, 0);
      return d > 0 ? [i, x, d] : null;
    }).filter(Boolean).sort((a, b) => b[2] - a[2]).slice(0, 3);
    const tot = [g.hp && `+${num(g.hp)} vida`, g.mana && `+${num(g.mana)} mana`, g.cap && `+${num(g.cap)} cap`, g.mit && `+${fmtP(g.mit)}% mitigação`,
      ...Object.entries(g.res).filter(([, x]) => x).map(([e, x]) => `${x > 0 ? '+' : ''}${fmtP(x)}% ${EL_PT[e]}`), g.dodge && `+${fmtP(g.dodge)}% dodge`, g.critx && `+${fmtP(g.critx)}% dano crítico`,
      g.ll && `+${fmtP(g.ll)}% life leech`, g.ml && `+${fmtP(g.ml)}% mana leech`, ...Object.entries(g.base).map(([sp, x]) => `${sp} +${fmtP(x)}% base`), ...Object.entries(g.crit).map(([sp, x]) => `${sp} +${fmtP(x)}% crítico`),
      ...Object.entries(g.rev).map(([sp, x]) => `${sp} +${num(x)} pts`), g.bonus && `+${g.bonus} dano/cura (ressonância)`].filter(Boolean);
    const sugBasic = ctx.sit === 'boss' ? 'Mitigation Multiplier' : MAGO(v) ? 'Mana' : 'Vida';
    return `<section class="an-card">
      <h3>💎 Gemas da roda</h3>
      <p class="muted an-obs">Cada canto da roda tem um vaso. A Lesser dá 1 mod, a Regular 2 e a Greater 2 + 1 supreme. Cada mod só liga com a Ressonância de Vaso do domínio (as fatias Vaso cheias: 1 ➜ 1º mod, 2 ➜ 2º, 3 ➜ supreme).</p>
      <div class="an-vasos">${vasos}</div>
      ${tot.length ? `<p class="an-gtot"><b>Suas gemas dão:</b> ${tot.map((x) => `<span class="an-res">${esc(x)}</span>`).join('')}</p>` : ''}
      <div class="an-gsug"><b>💡 Melhores para você</b><ul>
        ${ganhos.map(([, x, d]) => `<li><b>${esc(rotSupreme(x, 3))}</b> (supreme, grau IV) <span class="pos">+${num(d / Math.max(1, ataque.length))} por hit</span> em média no seu combo</li>`).join('') || (ataque.length ? '' : '<li class="muted">Preencha a ficha para eu comparar os supreme mods.</li>')}
        <li>1º mod: <b>${sugBasic}</b> é o mais usado para ${ctx.sit === 'boss' ? 'boss (aguentar mais)' : MAGO(v) ? 'mago (mais mana para as magias)' : 'quem fica na linha de frente'}; 2º mod: a resistência do elemento que mais te machuca na hunt.</li>
      </ul></div>
      <details class="an-cal"><summary>📈 Graus e custo para melhorar (Fragment Workshop)</summary>
        <div class="tabela-wrap"><table class="an-tab"><tr><th>Grau</th><th>Bônus</th><th>Fragmentos</th><th>Gold (basic)</th><th>Gold (supreme)</th></tr>
        ${[0, 1, 2, 3].map((i) => `<tr><td>${ROMANO_G[i]}</td><td>×${String(GEMAS.graus[i]).replace('.', ',')}</td><td>${GEMAS.custo[i] ? num(GEMAS.custo[i][0]) : '—'}</td><td>${GEMAS.custo[i] ? `${num(GEMAS.custo[i][1] / 1e6, 1)}kk` : '—'}</td><td>${GEMAS.custo[i] ? `${num(GEMAS.custo[i][2] / 1e6, 1)}kk` : '—'}</td></tr>`).join('')}</table></div>
        <p class="muted an-obs">Cada mod levado ao grau IV também dá +1 ponto de promoção na roda. Valores das gemas: TibiaWiki (CC BY-SA).</p></details>
    </section>`;
  }
  const M_TXT = (ctx) => (ctx.manual ? 'que você montou' : 'recomendada');
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
    // comparação da roda: a mesma conta com outra roda (sem roda, recomendada ou a sua roda salva)
    const RQ4 = ['TL', 'TR', 'BL', 'BR'];
    const t0 = me.cmp === 'rec' ? ctx.fatiasDe(v, ctx.recomendada(v, ctx.sit, ctx.total)) : me.cmp === 'salva' && me.roda?.length === 36 ? me.roda.map((x) => Math.max(0, +x || 0)) : new Array(36).fill(0);
    const a0 = Object.fromEntries(ctx.nomes.map((n, q) => [n, t0.reduce((acc, x, i) => acc + (RQ4.indexOf(RODA_OF.ids[i].slice(1, 3)) === q ? x : 0), 0)]));
    const r0 = calcular({ ...ctx, t: t0, a: a0 });
    const mob = me.mob ? (A.mobs || []).find((x) => x.nome === me.mob) : null;
    for (const x of magias) {
      const partes = partesDe(v, x.m, r), deArma = !porML(v, x.m);
      x.partes = partes; x.vs = contraMob(x.est, partes, mob, deArma);
      x.est0 = estimar(v, x.m, r0, me); x.vs0 = contraMob(x.est0, partesDe(v, x.m, r0), mob, deArma);
      const a1 = (x.vs || x.est)?.medio, b1 = (x.vs0 || x.est0)?.medio;
      x.delta = a1 && b1 ? (a1 / b1 - 1) * 100 : null;
    }
    const basico = ataqueBasico(v, r), basicoVs = contraMob(basico, partesDe(v, null, r), mob, true);
    const comDelta = magias.filter((x) => x.delta != null), deltaMedio = comDelta.length ? comDelta.reduce((t, x) => t + x.delta, 0) / comDelta.length : null;
    const CMP = [['nada', 'sem roda'], ['rec', 'a recomendada'], ['salva', 'a minha roda salva']];
    const dicas = conselhos(ctx, r, magias), prox = proximas(ctx, r);
    const hoje = new Date().toISOString().slice(0, 10), meuVoc = S.perfil?.personagem && String(S.perfil?.vocacao || '').toLowerCase().includes(v);
    A.hsTentou = A.hsTentou || {};
    if (meuVoc && ler().hs?.[v] !== hoje && !A.hsTentou[v] && !A.buscandoHS) { A.hsTentou[v] = true; setTimeout(() => buscarHS(null, true), 0); }
    A.ult = { v, r, me, magias, t: ctx.t };
    // ----- resumo do assistente -----
    const nomeVoc = { knight: 'Knight', paladin: 'Paladin', sorcerer: 'Sorcerer', druid: 'Druid', monk: 'Monk' }[v];
    const ataques = magias.filter((x) => x.est).sort((a, b) => b.est.medio - a.est.medio), forte = ataques[0];
    const falta = [];
    if (!r.skBase) falta.push(MAGO(v) ? 'o seu magic level' : `o seu ${r.nomeSk}`);
    if (!MAGO(v) && !r.atk) falta.push(r.equip.arma ? 'o ataque da arma (ainda chegando da TibiaWiki: digite por enquanto)' : 'a sua arma');
    const pecas = SLOTS.filter(([s]) => r.equip[s]).length;
    const vagasTot = SLOTS.reduce((t, [s]) => t + (r.equip[s]?.imbue_slots || 0), 0), vagasUsadas = vagasTot - r.slotsVazios.reduce((t, x) => t + x[2], 0);
    const usados = ctx.t.reduce((s, x) => s + x, 0), revs = ctx.nomes.filter((n) => ctx.estagio(ctx.a[n] || 0)).length;
    const resumo = `<p>${esc(nomeVoc)} level <b>${num(lvl)}</b>${r.equip.arma ? ` com <b>${esc(r.equip.arma.nome)}</b>${!MAGO(v) && r.atk ? ` (ataque ${num(r.atk)})` : ''}` : ''}. ${r.skTotal ? `Seu ${esc(r.nomeSk)} total é <b>${num(r.skTotal)}</b>.` : ''}</p>
      ${forte ? `<p>Na build ${ctx.sit === 'boss' ? 'de boss' : ctx.sit === 'time' ? 'de time' : 'solo'}, o seu golpe mais forte do combo é <b>${esc(forte.m.nome)}</b>: <b>${num(forte.est.min)}–${num(forte.est.max)}</b> por hit (média ${num(forte.est.medio)}).${(() => { const ab = ataqueBasico(v, r); return ab ? ` Ataque básico: <b>${num(ab.min)}–${num(ab.max)}</b>.` : ''; })()}</p>` : ''}
      ${forte && mob && forte.vs ? `<p>Contra <b>${esc(mob.nome)}</b> ele sai <b>${num(forte.vs.min)}–${num(forte.vs.max)}</b> (${forte.vs.pct}% do dano${forte.vs.pct < 100 ? ': o monstro resiste' : forte.vs.pct > 100 ? ': o monstro é fraco' : ''}).</p>` : ''}
      ${deltaMedio != null && Math.abs(deltaMedio) >= 0.05 ? `<p>Com a roda ${M_TXT(ctx)}, o dano médio das magias do combo fica <b class="${deltaMedio > 0 ? 'pos' : 'neg'}">${deltaMedio > 0 ? '+' : ''}${num(deltaMedio, 1)}%</b> em relação a ${esc(CMP.find((c) => c[0] === me.cmp)[1])}.</p>` : ''}
      ${falta.length ? `<p class="an-falta">Para eu calcular o seu dano, preciso de ${falta.map(esc).join(' e ')}.</p>` : ''}`;
    const barra = (rot, a, b, dica) => `<div class="an-meta" title="${esc(dica)}"><div><span>${rot}</span><b>${num(a)}/${num(b)}</b></div><i><u style="width:${b ? Math.min(100, Math.round((a / b) * 100)) : 0}%"></u></i></div>`;
    const top = dicas.slice(0, 3), resto = dicas.slice(3);
    // ----- mochila (layout do inventário do jogo) -----
    const GRADE = [['amuleto', 'capacete', null], ['arma', 'armadura', 'mao2'], ['anel', 'calca', null], [null, 'botas', null]];
    if (!A.ed || !SLOTS.some(([s]) => s === A.ed)) A.ed = 'arma';
    const slotBtn = (s) => {
      if (!s) return '<span class="an-pd-vazio" aria-hidden="true"></span>';
      const [, rot, ico] = SLOTS.find((x) => x[0] === s), sel = me.set[s] || {}, it = r.equip[s], vagas = it?.imbue_slots || 0, n = (sel.m || []).filter(Boolean).length;
      const ta = s === 'arma' ? tipoArma(v, sel) : null;
      return `<button type="button" class="an-pd${A.ed === s ? ' ativo' : ''}${it ? ' cheio' : ''}" data-an-ed="${s}" aria-pressed="${A.ed === s}" title="${esc(it ? it.nome : rot)}">
        ${imgDoItem(it ? it.nome : (ta ? ta[2] : ico), 'an-pd-img')}${vagas ? `<span class="an-pd-imb" aria-label="${n} de ${vagas} imbuements">${Array.from({ length: vagas }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>` : ''}
        <small>${esc(ta ? ta[1] : rot)}</small></button>`;
    };
    const edSlot = SLOTS.find(([s]) => s === A.ed);
    return `<div class="an">
      <section class="an-ia">
        <div class="an-ia-cab"><span class="an-ava" aria-hidden="true">🧠</span><div><b>Analista TibiaHub</b><small>mini IA de regras · analisa level, skill, itens, imbuements e roda</small></div></div>
        <div class="an-ia-txt">${resumo}</div>
        <div class="an-metas">${barra('Equipamento', pecas, SLOTS.length, 'Peças escolhidas no set')}${barra('Imbuements', vagasUsadas, vagasTot, 'Espaços de imbuement preenchidos nos itens escolhidos')}${barra('Pontos da roda', usados, ctx.total, 'Pontos usados na roda')}${barra('Revelation', revs, 4, 'Revelation Perks ativas')}</div>
        <h4>O que eu faria agora</h4>
        <ol class="an-dicas">${top.map(([i, t]) => `<li><span aria-hidden="true">${i}</span><p>${t}</p></li>`).join('')}</ol>
        ${resto.length ? `<details class="an-mais"><summary>Mais ${resto.length} dica${resto.length > 1 ? 's' : ''}</summary><ul class="an-dicas">${resto.map(([i, t]) => `<li><span aria-hidden="true">${i}</span><p>${t}</p></li>`).join('')}</ul></details>` : ''}
      </section>

      <div class="an-grid">
        <section class="an-card">
          <h3>👤 Personagem</h3>
          <div class="an-campos">
            <label class="mg-lvl-campo">${MAGO(v) ? 'Magic level' : esc(r.nomeSk[0].toUpperCase() + r.nomeSk.slice(1))} <small class="muted">sem itens</small><input type="number" min="0" max="300" inputmode="numeric" data-an="sk" value="${esc(String(me.sk || me.ml || ''))}" placeholder="ex.: 90"></label>
            ${!MAGO(v) ? `<label class="mg-lvl-campo">Magic level<input type="number" min="0" max="150" inputmode="numeric" data-an="ml" value="${esc(String(me.ml || ''))}" placeholder="ex.: 12"></label>
            <label class="mg-lvl-campo">Ataque da arma${r.atkAuto && !me.atk ? ' <small class="pos">auto</small>' : ''}<input type="number" min="0" max="300" inputmode="numeric" data-an="atk" value="${esc(String(me.atk || ''))}" placeholder="${r.atkAuto ? esc(String(r.atkAuto)) : 'ex.: 50'}" title="Vem sozinho da arma escolhida (físico + elemento). Digite só se quiser trocar (ex.: paladin com munição)."></label>` : ''}
          </div>
          ${S.perfil?.personagem && String(S.perfil?.vocacao || '').toLowerCase().includes(v) ? `<div class="an-hs"><button type="button" class="btn" data-an-hs title="Pega o skill base do Highscores do tibia.com (só se o personagem estiver no top 1000 do mundo)">🏆 Buscar do Highscores</button>${A.buscandoHS ? '<small class="muted">⏳ buscando…</small>' : ler().hs?.[v] ? `<small class="muted">do Highscores em ${esc(fmtData(ler().hs[v]))}</small>` : A.hsFora?.[v] ? '<small class="muted">fora do top 1000: digite à mão</small>' : ''}</div>` : ''}
          <div class="an-kpis"><div><span>❤️ Vida</span><b>${num(vidaB + r.gem.hp)}</b>${r.gem.hp ? `<small class="muted">+${num(r.gem.hp)} gemas</small>` : ''}</div><div><span>💧 Mana</span><b>${num(manaB + r.gem.mana)}</b>${r.gem.mana ? `<small class="muted">+${num(r.gem.mana)} gemas</small>` : ''}</div><div><span>🎒 Capacidade</span><b>${num(capB + r.gem.cap)}</b>${r.gem.cap ? `<small class="muted">+${num(r.gem.cap)} gemas</small>` : ''}</div><div><span>⚔️ Dano/cura do level</span><b>+${num(r.lvlBase)}</b></div>${!MAGO(v) ? `<div><span>🗡️ Ataque</span><b>${r.atk ? num(r.atk) : '—'}</b>${r.atkEl && !me.atk ? `<small class="muted">${esc(r.atkEl)}</small>` : ''}</div>` : ''}<div><span>💥 Crítico médio</span><b>+${num((r.crit * r.critExtra) / 100, 1)}%</b></div><div><span>🩸 Roubo de vida</span><b>${num(r.leechV, 2)}%</b></div><div><span>🔷 Roubo de mana</span><b>${num(r.leechM, 2)}%</b></div><div><span>🛡️ Armadura</span><b>${num(r.armadura)}</b>${r.defesa ? `<small class="muted">escudo def ${num(r.defesa)}</small>` : ''}</div></div>
          ${Object.keys(r.prot).length ? `<p class="an-prot">🧱 Proteções: ${Object.entries(r.prot).filter(([, x]) => x).map(([k, x]) => `<span class="an-res ${x > 0 ? 'forte' : 'fraco'}">${EL_PT[k] || k} ${x > 0 ? '+' : ''}${num(x)}%</span>`).join('')}</p>` : ''}
          <p class="muted an-obs">Vida, mana e capacidade: as do level mais as gemas (sem itens e sem as fatias da roda).</p>
        </section>

        <section class="an-card">
          <h3>🎒 Equipamento</h3>
          <div class="an-mochila">
            <div class="an-pd-grade">${GRADE.flat().map(slotBtn).join('')}</div>
            <div class="an-ed">${edSlot ? campoItem(v, lvl, edSlot[0], edSlot[1], edSlot[2], me.set[edSlot[0]] || {}) : ''}</div>
          </div>
          <p class="muted an-obs">Toque numa peça para escolher o item e os imbuements. Os pontinhos mostram os imbuements colocados.</p>
        </section>
      </div>

      ${cartaoGemas(v, ctx, r, me, magias)}

      <section class="an-card">
        <h3>⚔️ Dano das magias do combo</h3>
        <div class="an-ctl">
          <div class="an-ctl-mob"><span>Contra</span><div class="an-combo" data-an-combo="mob">
            <input type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Monstro" data-an-busca="mob" value="${esc(me.mob)}" placeholder="Escolha um monstro (opcional)" maxlength="60" autocomplete="off">
            ${me.mob ? '<button type="button" class="an-combo-x" data-an-limpar="mob" aria-label="Tirar o monstro">✕</button>' : ''}
            <button type="button" class="an-combo-seta" data-an-abrir="mob" aria-label="Abrir a lista de monstros">▾</button><ul class="an-lista" role="listbox" hidden></ul></div></div>
          <label class="an-ctl-cmp"><span>Roda comparada com</span><select data-an-cmp aria-label="Comparar a roda com">${CMP.map(([k, t]) => `<option value="${k}" ${me.cmp === k ? 'selected' : ''} ${k === 'salva' && !me.roda ? 'disabled' : ''}>${t}${k === 'salva' && !me.roda ? ' (nenhuma)' : ''}</option>`).join('')}</select></label>
          <button type="button" class="btn" data-an-salvar-roda title="Guarda a roda que está sendo analisada para comparar depois">💾 Salvar esta roda</button>
        </div>
        ${mob ? `<p class="an-mob">${imgDoItem(mob.nome, 'mg-ico')}<b>${esc(mob.nome)}</b> ${mob.hp ? `· ${num(mob.hp)} de vida` : ''} · armadura ${num(+mob.armor || 0)} · ${['physical', 'fire', 'ice', 'energy', 'earth', 'death', 'holy'].map((k) => { const vv = Number.isFinite(+mob.mods?.[k]) ? +mob.mods[k] : 100; return `<span class="an-res ${vv > 100 ? 'fraco' : vv < 100 ? 'forte' : ''}" title="${vv > 100 ? 'fraco' : vv < 100 ? 'resiste' : 'normal'}">${EL_PT[k]} ${vv}%</span>`; }).join('')}</p>` : ''}
        <div class="tabela-wrap"><table class="an-tab"><tr><th>Magia</th><th>Elemento</th><th>Dano</th>${mob ? `<th>No ${esc(mob.nome)}</th>` : ''}<th title="Diferença do dano médio entre a roda analisada e ${esc(CMP.find((c) => c[0] === me.cmp)[1])}">Roda vs ${esc(CMP.find((c) => c[0] === me.cmp)[1])}</th></tr>
          ${basico ? `<tr class="an-basico"><td><span class="rd-mg">${imgDoItem(r.equip.arma?.nome || 'Magic Sword', 'mg-ico')}<b>Ataque básico</b></span><small class="muted an-bp">arma ${num(r.atk)}</small></td><td><small>${esc(txtPartes(partesDe(v, null, r)))}</small></td><td><b>${num(basico.min)}–${num(basico.max)}</b><br><small class="muted">média ${num(basico.medio)}</small></td>${mob ? `<td>${basicoVs ? `<b>${num(basicoVs.min)}–${num(basicoVs.max)}</b><br><small class="${basicoVs.pct < 100 ? 'neg' : basicoVs.pct > 100 ? 'pos' : 'muted'}">${basicoVs.pct}% · média ${num(basicoVs.medio)}</small>` : '—'}</td>` : ''}<td class="muted">—</td></tr>` : ''}
          ${magias.map((x) => `<tr><td><button type="button" class="rd-mg" data-mg-info="${esc(x.m.nome)}">${imgDoItem(x.m.nome, 'mg-ico')}<b>${esc(x.m.nome)}</b></button>${x.base ? `<small class="muted an-bp">bp ${num(x.base)}${x.guia ? '·g' : ''}${x.aug ? ` · roda ${x.aug.pct ? `+${num(x.aug.pct, 1)}%` : esc(x.aug.txt)}` : ''}</small>` : ''}</td>
            <td><small>${x.est ? esc(txtPartes(x.partes)) : x.m.subclasse === 'Healing' ? 'cura' : '—'}</small></td>
            <td>${x.est ? `<b>${num(x.est.min)}–${num(x.est.max)}</b><br><small class="muted">média ${num(x.est.medio)}</small>` : `<span class="muted">${x.m.subclasse === 'Healing' ? '—' : x.base ? 'preencha a ficha' : '—'}</span>`}</td>
            ${mob ? `<td>${x.vs ? `<b>${num(x.vs.min)}–${num(x.vs.max)}</b><br><small class="${x.vs.pct < 100 ? 'neg' : x.vs.pct > 100 ? 'pos' : 'muted'}">${x.vs.pct}% · média ${num(x.vs.medio)}</small>` : '<span class="muted">—</span>'}</td>` : ''}
            <td>${x.delta == null ? '<span class="muted">—</span>' : Math.abs(x.delta) < 0.05 ? '<span class="muted">igual</span>' : `<b class="${x.delta > 0 ? 'pos' : 'neg'}">${x.delta > 0 ? '▲ +' : '▼ '}${num(x.delta, 1)}%</b>`}</td></tr>`).join('')}
        </table></div>
        ${calibragem(v, magias, me)}
        <p class="dica">Fórmulas do Tibia 15.25 (base power): magia de ${MAGO(v) ? 'magic level = bônus do level (+' + num(r.lvlBase) + ') + base power ÷ 25 × magic level' : 'arma = bônus do level (+' + num(r.lvlBase) + ') + base power ÷ 1000 × skill × ataque'} + base power ÷ 6, de −10% a +10%, com a melhoria da roda, +${num(r.fixo)} das Revelation Perks e o crítico médio do Strike. ${MAGO(v) ? '' : 'Magias de arma e o ataque básico saem com os elementos da arma (e dos imbuements de dano). '}Contra o monstro: resistência de cada elemento e, no dano físico de arma, a armadura dele. ·g = base power do guia.${me.cal ? ` Ajuste manual ligado (×${num(me.cal, 2)}).` : ''}</p>
      </section>

      <div class="an-grid">
        <section class="an-card">
          <h3>📈 Próximas fatias que mais rendem</h3>
          ${prox.length ? `<ol class="an-prox">${prox.map((p) => `<li><button type="button" class="link" data-an-ir="${p.i}">${esc(p.nome)}</button> <span class="muted">(${num(p.falta)} pontos)</span><br><small>${esc(p.porque)} · ${esc(p.dedi)}</small></li>`).join('')}</ol>` : '<p class="muted">Todas as fatias liberadas já estão cheias.</p>'}
        </section>
        <section class="an-card">
          <h3>⚖️ Builds lado a lado</h3>
          <div class="tabela-wrap"><table class="an-tab"><tr><th></th><th>Vida</th><th>Mana</th><th>Mitig.</th><th>${esc(MAGO(v) ? 'ML' : 'Skill')}</th><th>Melh.</th><th>Dano/cura</th><th>Revelation</th></tr>${comparar(ctx)}</table></div>
        </section>
      </div>
      <p class="dica">O analista é um conjunto de regras do TibiaHub (não usa serviço pago nem manda seus dados para fora). Itens e imbuements: TibiaWiki (CC BY-SA); roda: www.tibia.com.</p>
    </div>`;
  }

  // ---------- skill pelo Highscores do tibia.com (via TibiaData) ----------
  // O perfil do personagem não mostra skills; o Highscores mostra o skill base (sem itens) do top 1000 de cada mundo.
  const CAT_VOC = { knight: 'knights', paladin: 'paladins', sorcerer: 'sorcerers', druid: 'druids', monk: 'monks' };
  async function acharNoRanking(mundo, cat, voc, nome) {
    const alvo = nome.toLowerCase(), base = `https://api.tibiadata.com/v4/highscores/${encodeURIComponent(mundo)}/${cat}/${voc}/`;
    let total = 20;
    for (let ini = 1; ini <= total; ini += 5) {
      const pags = await Promise.all(Array.from({ length: Math.min(5, total - ini + 1) }, (_, k) => fetch(base + (ini + k)).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      for (const j of pags) {
        const h = j?.highscores; if (!h) continue;
        total = Math.min(20, h.highscore_page?.total_pages || total);
        const e = (h.highscore_list || []).find((x) => String(x.name || '').toLowerCase() === alvo);
        if (e && Number.isFinite(+e.value)) return +e.value;
      }
    }
    return null;
  }
  async function buscarHS(b, silencioso = false) {
    const v = A.ctxVoc, nome = String(S.perfil?.personagem || '').trim(), mundo = String(S.perfil?.mundo || '').trim();
    const avisar = (t) => { if (!silencioso) toast(t); };
    if (!nome || !mundo) { avisar('Vincule o seu personagem na conta para buscar no Highscores.'); return; }
    if (!String(S.perfil?.vocacao || '').toLowerCase().includes(v)) { avisar('O personagem da sua conta não é dessa vocação.'); return; }
    if (!/^[A-Za-z' -]{2,30}$/.test(nome) || !/^[A-Za-z]{3,20}$/.test(mundo)) return;
    const arma = { knight: tipoArma(v, doVoc(v).set.arma)[0], paladin: 'distance', monk: 'fist' }[v], CAT = { sword: 'swordfighting', axe: 'axefighting', club: 'clubfighting', distance: 'distancefighting', fist: 'fistfighting' };
    A.buscandoHS = true; const txt = b?.textContent; if (b) { b.disabled = true; b.textContent = '⏳ Procurando…'; } else document.dispatchEvent(new Event('mg-render'));
    try {
      const voc = CAT_VOC[v];
      const [ml, sk] = await Promise.all([acharNoRanking(mundo, 'magiclevel', voc, nome), arma ? acharNoRanking(mundo, CAT[arma], voc, nome) : Promise.resolve(null)]);
      if (ml == null && sk == null) { A.hsFora = A.hsFora || {}; A.hsFora[v] = true; avisar('Seu personagem não apareceu no top 1000 do mundo. Digite o skill à mão.'); document.dispatchEvent(new Event('mg-render')); return; }
      mexer((d) => { if (MAGO(v)) { if (ml != null) d.sk[v] = ml; } else { if (sk != null) d.sk[v] = sk; if (ml != null) d.ml[v] = ml; } d.hs = d.hs || {}; d.hs[v] = new Date().toISOString().slice(0, 10); }, v);
      avisar(`Highscores: ${ml != null ? `magic level ${ml}` : ''}${ml != null && sk != null ? ' · ' : ''}${sk != null ? `${arma} ${sk}` : ''}.`);
    } finally { A.buscandoHS = false; if (b && b.isConnected) { b.disabled = false; b.textContent = txt; } if (!b) document.dispatchEvent(new Event('mg-render')); }
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
    const gm = el.dataset.anGm, gg = el.dataset.anGg;
    if (gm || gg) {
      const [q, campo] = (gm || gg).split(':'), qi = Math.max(0, Math.min(3, +q || 0));
      if (!['m1', 'm2', 's', 'g1', 'g2', 'gs'].includes(campo)) return;
      const val = gg ? Math.max(0, Math.min(3, +el.value || 0)) : String(el.value).slice(0, 40);
      mexer((d) => { d.gemas = d.gemas || {}; const arr = (d.gemas[v] = Array.isArray(d.gemas[v]) ? d.gemas[v] : [{}, {}, {}, {}]); while (arr.length < 4) arr.push({}); arr[qi] = { ...(arr[qi] || {}), [campo]: val }; }, v); return;
    }
    if (el.matches('[data-an-cmp]')) { const val = ['nada', 'rec', 'salva'].includes(el.value) ? el.value : 'nada'; mexer((d) => { d.cmp = d.cmp || {}; d.cmp[v] = val; }, v); return; }
    if (['sk', 'ml', 'atk'].includes(el.dataset.an)) { const n = Math.max(0, Math.min(300, parseInt(el.value, 10) || 0)); mexer((d) => { d[el.dataset.an][v] = n || undefined; }, v); return; }
    if (el.dataset.anBusca) { // saiu do campo: aceita se o nome digitado for exatamente um item (sem diferenciar maiúsculas)
      const s = el.dataset.anBusca, q = el.value.trim().toLowerCase(), atual = (s === 'mob' ? doVoc(v).mob : doVoc(v).set[s]?.i) || '';
      if (!q || q === atual.toLowerCase()) return;
      if (s === 'mob') { const m = (A.mobs || []).find((x) => x.nome.toLowerCase() === q); if (m) escolherItem('mob', m.nome); return; }
      const it = opcoes(v, A.ctxLvl || 1, s, doVoc(v).set[s]).find((i) => i.nome.toLowerCase() === q);
      if (it) escolherItem(s, it.nome);
      return;
    }
    if (el.dataset.anImb) {
      const s = el.dataset.anImb, k = +el.dataset.anK, nome = el.value;
      mexer((d) => { const x = d.set[v][s]; if (!x) return; x.m = (x.m || []).slice(0, 3); x.m[k] = nome || null; }, v);
    }
  });

  // campo de item: digitar filtra, ▾ abre a lista, clicar escolhe; setas, Enter e Esc funcionam
  document.addEventListener('input', (e) => { const i = e.target.closest?.('#magias-app [data-an-busca]'); if (i) encherLista(i.closest('.an-combo'), i.value); });
  document.addEventListener('focusin', (e) => { const i = e.target.closest?.('#magias-app [data-an-busca]'); if (i) { fecharListas(i.closest('.an-combo')); i.select(); } });
  document.addEventListener('keydown', (e) => {
    const i = e.target.closest?.('#magias-app [data-an-busca]'); if (!i) return;
    const box = i.closest('.an-combo'), ul = box.querySelector('.an-lista');
    if (e.key === 'Escape') { ul.hidden = true; i.setAttribute('aria-expanded', 'false'); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (ul.hidden) encherLista(box, i.value);
      const ops = [...ul.querySelectorAll('[data-an-esc]')], k = ops.findIndex((o) => o.classList.contains('foco'));
      const n = Math.max(0, Math.min(ops.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)));
      ops.forEach((o, x) => o.classList.toggle('foco', x === n)); ops[n]?.scrollIntoView({ block: 'nearest' }); if (ops[n]) i.setAttribute('aria-activedescendant', ops[n].id);
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); const o = ul.hidden ? null : ul.querySelector('.foco[data-an-esc]'); if (o) escolherItem(box.dataset.anCombo, o.dataset.anEsc); }
  });
  document.addEventListener('mousedown', (e) => { if (e.target.closest?.('#magias-app .an-lista')) e.preventDefault(); }); // não perde o foco ao clicar na lista
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('#magias-app .an-combo')) fecharListas(null);
    const op = e.target.closest?.('#magias-app [data-an-esc]'); if (op) { escolherItem(op.closest('.an-combo').dataset.anCombo, op.dataset.anEsc); return; }
    const ab = e.target.closest?.('#magias-app [data-an-abrir]');
    if (ab) { const box = ab.closest('.an-combo'), ul = box.querySelector('.an-lista'); if (ul.hidden) { fecharListas(box); encherLista(box, ''); box.querySelector('input').focus(); } else { ul.hidden = true; } return; }
    const lp = e.target.closest?.('#magias-app [data-an-limpar]'); if (lp) { escolherItem(lp.dataset.anLimpar, ''); return; }
    const tp = e.target.closest?.('#magias-app [data-an-tipo]');
    if (tp && A.ctxVoc) { const v = A.ctxVoc; mexer((d) => { const cur = d.set[v].arma || {}; d.set[v].arma = cur.t === tp.dataset.anTipo ? cur : { t: tp.dataset.anTipo }; }, v); return; }
    const gq = e.target.closest?.('#magias-app [data-an-gq]');
    if (gq && A.ctxVoc) { const v = A.ctxVoc, [q, n] = gq.dataset.anGq.split(':').map((x) => Math.max(0, Math.min(3, +x || 0))); mexer((d) => { d.gemas = d.gemas || {}; const arr = (d.gemas[v] = Array.isArray(d.gemas[v]) ? d.gemas[v] : [{}, {}, {}, {}]); while (arr.length < 4) arr.push({}); arr[q] = { ...(arr[q] || {}), q: n }; }, v); return; }
    const ed = e.target.closest?.('#magias-app [data-an-ed]'); if (ed) { A.ed = ed.dataset.anEd; document.dispatchEvent(new Event('mg-render')); return; }
    if (e.target.closest?.('#magias-app [data-an-salvar-roda]') && A.ult) { const v = A.ult.v, t = A.ult.t.map((x) => Math.max(0, Math.min(200, Math.round(+x || 0)))); mexer((d) => { d.rodas = d.rodas || {}; d.rodas[v] = t; d.cmp = d.cmp || {}; d.cmp[v] = 'salva'; }, v); toast('Roda salva: agora as próximas mudanças são comparadas com ela.'); return; }
    const hs = e.target.closest?.('#magias-app [data-an-hs]'); if (hs) { buscarHS(hs); return; }
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
  window.ANALISTA = { html(ctx) { A.ctxVoc = ctx.v; A.ctxLvl = ctx.lvl; return html(ctx); } };
})();
