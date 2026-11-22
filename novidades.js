// TibiaHub — Novidades e versão do site.
// A lista vem de novidades.json, que é publicado JUNTO com o site: a versão mostrada e as novidades nunca ficam fora de sincronia.
// Regra (ver CLAUDE.md): toda publicação sobe a versão e acrescenta a novidade no topo de novidades.json.
(() => {
  const TIPOS = { novo: { nome: 'Novo', cor: 'var(--verde)' }, melhoria: { nome: 'Melhoria', cor: 'var(--ouro)' }, correcao: { nome: 'Correção', cor: '#d97706' }, aviso: { nome: 'Aviso', cor: 'var(--verm)' } };
  window.NOV = { lista: [], naoLidas: 0, versao: null };
  const vistoEm = () => (typeof S !== 'undefined' && S.perfil?.novidades_vistas_em ? new Date(S.perfil.novidades_vistas_em) : null);
  const valida = (n) => n && /^\d+\.\d+\.\d+$/.test(n.versao) && !isNaN(new Date(n.data)) && typeof n.titulo === 'string';

  async function buscar() {
    const r = await fetch('/novidades.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('novidades ' + r.status);
    return (await r.json()).filter(valida).slice(0, 100);
  }
  async function carregar() {
    try { NOV.lista = await buscar(); } catch { return; }
    NOV.versao = NOV.lista[0]?.versao || null;
    $$('[data-versao]').forEach((el) => (el.textContent = NOV.versao ? 'v' + NOV.versao : ''));
    contar();
  }
  function contar() {
    const visto = vistoEm();
    // conta nova = sem nada visto ainda: mostra só a última, não o histórico todo
    NOV.naoLidas = !visto ? Math.min(1, NOV.lista.length) : NOV.lista.filter((n) => new Date(n.data) > visto).length;
    $('#btn-usuario')?.classList.toggle('tem-novidade', NOV.naoLidas > 0);
  }

  const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  function html() {
    const visto = vistoEm();
    if (!NOV.lista.length) return '<div class="bloqueio">Nenhuma novidade ainda.</div>';
    return NOV.lista.map((n, i) => {
      const t = TIPOS[n.tipo] || TIPOS.novo, nova = visto ? new Date(n.data) > visto : i === 0;
      return `<article class="nov-item ${nova ? 'nova' : ''}"><div class="nov-cab"><span class="nov-versao">v${esc(n.versao)}</span><span class="nov-tag" style="--t:${t.cor}">${t.nome}</span>` +
        `${nova ? '<span class="nov-bolinha" title="Nova">●</span>' : ''}<span class="nov-data">${dataBR(n.data)}</span></div>` +
        `<h4>${esc(n.titulo)}</h4>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}</article>`;
    }).join('');
  }

  window.abrirNovidades = async function () {
    await carregar();
    const d = document.createElement('div'); d.className = 'dlg nov-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<div class="dlg-caixa nov-caixa"><div class="picker-topo"><h3>✨ Novidades <small class="muted nov-atual">${NOV.versao ? 'versão atual v' + esc(NOV.versao) : ''}</small></h3>` +
      `<button type="button" class="modal-fechar" data-nov-fechar aria-label="Fechar">✕</button></div><div class="nov-lista">${html()}</div></div>`;
    document.body.appendChild(d);
    const fechar = () => { d.remove(); document.removeEventListener('keydown', tecla, true); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', tecla, true);
    d.addEventListener('mousedown', (e) => { if (e.target === d) fechar(); });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-nov-fechar]')) fechar(); });
    if (NOV.naoLidas && typeof S !== 'undefined' && S.user) {   // marca como lidas no perfil (vale em todos os aparelhos)
      const { data } = await sb.from('profiles').update({ novidades_vistas_em: new Date().toISOString() }).eq('id', S.user.id).select().single();
      if (data) { S.perfil = data; contar(); }
    }
  };

  // saiu versão nova com o site aberto? avisa para atualizar (confere a cada 5 minutos e ao voltar para a aba)
  let avisado = false;
  async function conferirVersao() {
    if (avisado || !NOV.versao || document.hidden) return;
    let lista; try { lista = await buscar(); } catch { return; }
    if (lista[0]?.versao && lista[0].versao !== NOV.versao) {
      avisado = true;
      const b = document.createElement('div'); b.className = 'aviso-versao'; b.setAttribute('role', 'status');
      b.innerHTML = `<span>✨ Nova versão <b>v${esc(lista[0].versao)}</b> disponível: ${esc(lista[0].titulo)}</span><button type="button" class="btn">Atualizar</button>`;
      $('button', b).onclick = () => location.reload();
      document.body.appendChild(b);
    }
  }
  setInterval(conferirVersao, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', conferirVersao);

  const contaOriginal = window.renderConta;
  window.renderConta = function () { contaOriginal(); contar(); };
  carregar();
})();
