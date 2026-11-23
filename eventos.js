// TibiaHub — Calendário de eventos do Tibia (datas da TibiaWiki, CC BY-SA, atualizadas 2x por dia pelo robô).
// Todo texto vindo de fora passa por esc().
(() => {
  const E = { lista: null, mes: null };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  // resumos em português dos eventos mais conhecidos; os outros mostram só o link para a TibiaWiki
  const SOBRE = {
    'Christmas': 'Natal no Tibia: cidades decoradas, presentes e itens natalinos à venda nos NPCs.',
    'Halloween': 'Halloween: abóboras, fantasias e criaturas temáticas pelo mapa.',
    'Tibia Anniversary': 'Aniversário do Tibia: comemoração com bolos, balões e surpresas pelo mundo.',
    'Double Experience and Skill Events': 'Fim de semana de XP e skill em dobro. A data é uma estimativa até a CipSoft anunciar.',
    'Double Daily Reward Month': 'Mês da recompensa diária em dobro.',
    'Masquerade Days': 'Dias de máscaras: fantasias e trajes especiais nos NPCs.',
    "April's Fools": 'Primeiro de abril: brincadeiras da CipSoft dentro do jogo.',
    'Flower Month': 'Mês das flores: flores e decorações de primavera.',
    'Rise of Devovorga': 'Devovorga desperta e os jogadores do mundo se unem para enfrentá-la.',
    'Orcsoberfest': 'Festa dos orcs, com bebidas, diversão e quests temáticas.',
  };
  const linkWiki = (n) => `https://tibia.fandom.com/wiki/${encodeURIComponent(String(n).replace(/ /g, '_'))}`;
  const hojeISO2 = () => hojeISO();   // data local (Brasil)
  const dataBR = (iso) => (iso ? new Date(iso + 'T12:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: iso.slice(0, 4) !== String(new Date().getFullYear()) ? 'numeric' : undefined }) : '');
  const dias = (iso) => Math.round((new Date(iso + 'T12:00Z') - new Date(hojeISO2() + 'T12:00Z')) / 864e5);
  // cor fixa por evento (mesmo nome, mesma cor)
  const cor = (n) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 50%)`; };

  async function carregar() {
    $('#eventos-app').innerHTML = '<div class="card"><div class="bloqueio">Carregando eventos…</div></div>';
    const { data, error } = await sb.from('eventos').select('nome,inicio,fim,status,incerto').order('inicio');
    if (error) return erro(error);
    E.lista = data || []; if (!E.mes) { const d = new Date(); E.mes = [d.getFullYear(), d.getMonth()]; } render();
  }

  function cartao(e) {
    const d = dias(e.inicio), ativo = e.status === 'ativo';
    const quando = ativo ? (e.fim ? `acontecendo agora · termina em ${dataBR(e.fim)} (${Math.max(0, dias(e.fim))} dia${dias(e.fim) === 1 ? '' : 's'})` : 'acontecendo agora')
      : `${e.incerto ? 'pode começar' : 'começa'} em ${dataBR(e.inicio)} · ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `faltam ${d} dias`}`;
    return `<article class="ev-card${ativo ? ' ativo' : ''}" style="--c:${cor(e.nome)}"><div class="ev-cab"><b>${esc(e.nome)}</b>${ativo ? '<span class="ev-tag">● ao vivo</span>' : e.incerto ? '<span class="ev-tag inc">estimado</span>' : ''}</div>` +
      `<small class="muted">${quando}</small>${SOBRE[e.nome] ? `<p>${esc(SOBRE[e.nome])}</p>` : ''}<a href="${linkWiki(e.nome)}" target="_blank" rel="noopener noreferrer">Saiba mais na TibiaWiki ↗</a></article>`;
  }

  function calendario() {
    const [y, m] = E.mes, prim = new Date(Date.UTC(y, m, 1)), nDias = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), off = prim.getUTCDay(), hoje = hojeISO2();
    const iso = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const doDia = (dia) => E.lista.filter((e) => (e.fim ? dia >= e.inicio && dia <= e.fim : dia === e.inicio));
    let cel = Array.from({ length: off }, () => '<div class="ev-dia fora"></div>').join('');
    for (let d = 1; d <= nDias; d++) {
      const dia = iso(d), evs = doDia(dia);
      cel += `<div class="ev-dia${dia === hoje ? ' hoje' : ''}${evs.length ? ' tem' : ''}"><span class="ev-num">${d}</span>${evs.slice(0, 3).map((e) => `<span class="ev-pill" style="--c:${cor(e.nome)}" title="${esc(e.nome)}">${esc(e.nome)}</span>`).join('')}${evs.length > 3 ? `<span class="muted ev-mais">+${evs.length - 3}</span>` : ''}</div>`;
    }
    return `<div class="card"><div class="card-topo"><h2>${MESES[m]} de ${y}</h2><div class="ev-nav"><button type="button" class="btn sec mini-btn" data-ev-mes="-1" aria-label="Mês anterior">‹</button><button type="button" class="btn sec mini-btn" data-ev-mes="0">Hoje</button><button type="button" class="btn sec mini-btn" data-ev-mes="1" aria-label="Próximo mês">›</button></div></div>` +
      `<div class="ev-grade">${SEM.map((s) => `<div class="ev-sem">${s}</div>`).join('')}${cel}</div>` +
      `<p class="dica">Eventos com data de fim aparecem em todos os dias; os outros aparecem no dia em que começam. Datas pelo horário do servidor (10h de Brasília no dia do server save).</p></div>`;
  }

  function render() {
    const el = $('#eventos-app'); if (!el || !E.lista) return;
    const ativos = E.lista.filter((e) => e.status === 'ativo'), prox = E.lista.filter((e) => e.status !== 'ativo' && dias(e.inicio) >= 0 && dias(e.inicio) <= 60), depois = E.lista.filter((e) => e.status !== 'ativo' && dias(e.inicio) > 60);
    el.innerHTML = `<div class="ev-grid"><div class="ev-col">` +
      `<div class="card"><div class="card-topo"><h2>🎉 Acontecendo agora</h2></div>${ativos.length ? `<div class="ev-lista">${ativos.map(cartao).join('')}</div>` : '<p class="muted">Nenhum evento ativo hoje.</p>'}</div>` +
      `<div class="card"><div class="card-topo"><h2>📅 Próximos 60 dias</h2></div>${prox.length ? `<div class="ev-lista">${prox.map(cartao).join('')}</div>` : '<p class="muted">Nada marcado para os próximos 60 dias.</p>'}</div>` +
      `</div><div class="ev-col">${calendario()}` +
      `<div class="card"><div class="card-topo"><h2>Mais adiante</h2></div><div class="ev-mini">${depois.map((e) => `<div class="ev-linha" style="--c:${cor(e.nome)}"><span>${dataBR(e.inicio)}</span><a href="${linkWiki(e.nome)}" target="_blank" rel="noopener noreferrer">${esc(e.nome)}</a></div>`).join('') || '<p class="muted">—</p>'}</div>` +
      `<p class="dica">Datas dos eventos: TibiaWiki (CC BY-SA). A CipSoft pode mudar as datas; o anúncio oficial sai nas Notícias.</p></div></div></div>`;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=eventos]')) { if (!E.lista) carregar(); else render(); return; }
    const b = e.target.closest('[data-ev-mes]'); if (!b || !E.mes) return;
    const k = +b.dataset.evMes;
    if (k === 0) { const d = new Date(); E.mes = [d.getFullYear(), d.getMonth()]; } else { const d = new Date(Date.UTC(E.mes[0], E.mes[1] + k, 1)); E.mes = [d.getUTCFullYear(), d.getUTCMonth()]; }
    render();
  });
})();
