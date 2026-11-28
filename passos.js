// TibiaHub — Próximos passos (guia para quem está começando, no Painel) e previsão de gold (usada nas Metas).
// Tudo calculado no navegador com os dados que o jogador já tem no site. Texto externo passa por esc().
(() => {
  const CHAVE = 'tc_passos_ok';
  const lerOk = () => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]')); } catch { return new Set(); } };
  const salvarOk = (s) => { try { localStorage.setItem(CHAVE, JSON.stringify([...s].slice(-40))); } catch { /* ok */ } };
  const diasAtras = (n) => { const d = new Date(hojeISO() + 'T12:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  // ritmo dos últimos 30 dias: lucro por hunt, por hora e hunts por semana
  function ritmo() {
    const desde = diasAtras(30), hs = (S.hunts || []).filter((h) => h.data >= desde);
    if (hs.length < 2) return null;
    const lucro = hs.reduce((t, h) => t + (h.profit || 0), 0), min = hs.reduce((t, h) => t + (h.duracao_min || 0), 0);
    const dias = new Set(hs.map((h) => h.data)).size, primeiro = hs.reduce((m, h) => (h.data < m ? h.data : m), hojeISO());
    const semanas = Math.max(1, (new Date(hojeISO()) - new Date(primeiro)) / 6048e5);
    return { porHunt: lucro / hs.length, porHora: min ? (lucro * 60) / min : null, huntsSemana: hs.length / semanas, porDia: lucro / Math.max(1, (new Date(hojeISO()) - new Date(primeiro)) / 864e5 + 1), hunts: hs.length, dias };
  }
  // "No seu ritmo você junta isso em ~N hunts (~D dias)"
  window.previsaoGold = function (falta) {
    if (!(falta > 0)) return '';
    const r = ritmo();
    if (!r) return ' Registre algumas hunts para eu prever em quanto tempo você junta esse gold.';
    if (r.porHunt <= 0) return ' Nos últimos 30 dias suas hunts deram prejuízo em média, então ainda não dá para prever quando você junta esse gold.';
    const hunts = Math.ceil(falta / r.porHunt), dias = Math.ceil(falta / Math.max(1, r.porDia)), horas = r.porHora > 0 ? Math.ceil(falta / r.porHora) : null;
    const quando = new Date(hojeISO() + 'T12:00'); quando.setDate(quando.getDate() + dias);
    return ` 📅 No seu ritmo dos últimos 30 dias (${fmtC(Math.round(r.porHunt))} de lucro por hunt), você junta isso em <b>~${fmt(hunts)} hunt${hunts > 1 ? 's' : ''}</b>${horas ? ` (~${fmt(horas)} h de hunt)` : ''}, por volta de <b>${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</b>.`;
  };

  // lista de passos: [id, ícone, texto, botão [rótulo, página]]
  function passos() {
    const p = S.perfil || {}, out = [], lvl = p.level || 0, an = p.analista || {}, voc = String(p.vocacao || '').toLowerCase();
    const vk = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'].find((v) => voc.includes(v));
    if (!p.personagem) out.push(['char', '🧙', 'Coloque o nome do seu personagem para o site buscar level, vocação e mundo sozinho.', ['Abrir conta', 'conta']]);
    if (!(S.hunts || []).length) out.push(['hunt1', '🗡️', 'Registre sua primeira hunt. O jeito mais rápido é colar o Hunt Analyzer do jogo: o site lê loot, XP e onde vender cada item.', ['Registrar hunt', 'hunts']]);
    else if ((S.hunts || []).length < 5) out.push(['hunt5', '📈', `Você tem ${S.hunts.length} hunt${S.hunts.length > 1 ? 's' : ''} registrada${S.hunts.length > 1 ? 's' : ''}. Com 5 ou mais, o painel mostra seu lucro por hora e o ritmo para as suas metas.`, ['Ver hunts', 'hunts']]);
    if (!p.meta_diaria) out.push(['meta', '🎯', 'Defina uma meta de lucro por dia: o painel mostra se você bateu e quanto falta.', ['Definir meta', 'metas']]);
    if (lvl && lvl < 51) out.push(['roda51', '☸️', `A Roda do Destino libera no level 51 (com Premium). Faltam ${fmt(51 - lvl)} levels: até lá, foque em skill e numa hunt segura para o seu level.`, ['Ver hunts da comunidade', 'comunidade']]);
    else if (vk && !(an.set && an.set[vk] && Object.keys(an.set[vk]).length)) out.push(['oraculo', '🔮', 'Monte o seu set no Oráculo IA: ele calcula o dano das suas magias, sugere imbuements, a roda e as gemas para o seu level.', ['Abrir Oráculo IA', 'magias']]);
    if (vk && an.set && an.set[vk] && !(an.set[vk].arma && (an.set[vk].arma.m || []).length)) out.push(['imb', '✨', 'Sua arma está sem imbuement. Para quem está começando, Vampirism (vida) e Void (mana) na arma economizam muita potion.', ['Ver no Oráculo IA', 'magias']]);
    if (!(S.loot && S.loot.size) && (S.hunts || []).length) out.push(['inv', '🎒', 'Use o Inventário para guardar o loot das hunts e vender no NPC certo sem esquecer nada.', ['Abrir inventário', 'inventario']]);
    if (!p.compartilhar) out.push(['comu', '🤝', 'Ajude a comunidade: compartilhe seus dados anônimos e veja quais hunts estão rendendo para o seu level.', ['Ver Comunidade', 'comunidade']]);
    return out;
  }

  window.renderPassos = function () {
    const el = document.getElementById('passos-app'); if (!el || !S.perfil) return;
    const ok = lerOk(), lista = passos().filter(([id]) => !ok.has(id)), mostra = lista.slice(0, 3);
    if (!mostra.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<section class="card passos" aria-label="Próximos passos"><div class="passos-cab"><h3>🧭 Seus próximos passos</h3><small class="muted">${lista.length > 3 ? `mais ${lista.length - 3} depois destes` : 'feitos para o seu personagem'}</small></div>
      <ol class="passos-lista">${mostra.map(([id, ico, txt, [rot, pag]]) => `<li><span class="passos-ico" aria-hidden="true">${ico}</span><p>${txt}</p>
        <div class="passos-acoes"><button type="button" class="btn mini-btn" data-ir="${esc(pag)}">${esc(rot)}</button><button type="button" class="link" data-passo-ok="${esc(id)}" aria-label="Dispensar esta dica">Já fiz / esconder</button></div></li>`).join('')}</ol></section>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-passo-ok]'); if (!b) return;
    const ok = lerOk(); ok.add(String(b.dataset.passoOk).slice(0, 20)); salvarOk(ok); window.renderPassos();
  });
  // se os dados chegaram antes deste arquivo carregar
  if (typeof S !== 'undefined' && S.perfil) window.renderPassos();
  window.addEventListener('load', () => { if (typeof S !== 'undefined' && S.perfil) window.renderPassos(); });
})();
