// TibiaControle — Novidades: atualizações do site, com aviso do que ainda não foi lido (o admin publica pelo próprio site)
(() => {
  const TIPOS = { novo: { nome: 'Novo', cor: 'var(--verde)' }, melhoria: { nome: 'Melhoria', cor: 'var(--ouro)' }, correcao: { nome: 'Correção', cor: '#d97706' }, aviso: { nome: 'Aviso', cor: 'var(--verm)' } };
  window.NOV = { lista: [], naoLidas: 0 };
  let carregado = false;

  async function carregar() {
    if (!S.user) return;
    const { data, error } = await sb.from('novidades').select('id,publicado_em,titulo,texto,tipo').order('publicado_em', { ascending: false }).limit(60);
    if (error) return;
    NOV.lista = data; carregado = true; contar();
  }
  function contar() {
    const visto = S.perfil?.novidades_vistas_em ? new Date(S.perfil.novidades_vistas_em) : null;
    NOV.naoLidas = NOV.lista.filter((n) => !visto || new Date(n.publicado_em) > visto).length;
    $('#btn-usuario')?.classList.toggle('tem-novidade', NOV.naoLidas > 0);
  }

  const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  function html() {
    const visto = S.perfil?.novidades_vistas_em ? new Date(S.perfil.novidades_vistas_em) : null, porDia = new Map();
    for (const n of NOV.lista) { const d = dataBR(n.publicado_em); if (!porDia.has(d)) porDia.set(d, []); porDia.get(d).push(n); }
    const adm = S.perfil?.admin;
    return (adm ? `<form class="nov-form" id="nov-form"><b>Publicar novidade</b><div class="nov-form-linha"><select name="tipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('')}</select>` +
        `<input name="titulo" maxlength="100" required placeholder="Título (ex: Nova calculadora de imbuements)"></div>` +
        `<textarea name="texto" maxlength="1500" rows="3" placeholder="O que mudou, em poucas linhas (opcional)"></textarea><div class="nov-form-linha fim"><button class="btn">Publicar para todos</button></div></form>` : '') +
      (NOV.lista.length ? [...porDia].map(([dia, itens]) => `<div class="nov-dia">${dia}</div>` + itens.map((n) => {
        const t = TIPOS[n.tipo] || TIPOS.novo, nova = !visto || new Date(n.publicado_em) > visto;
        return `<article class="nov-item ${nova ? 'nova' : ''}"><span class="nov-tag" style="--t:${t.cor}">${t.nome}</span>${nova ? '<span class="nov-bolinha" title="Nova">●</span>' : ''}` +
          `<h4>${esc(n.titulo)}</h4>${n.texto ? `<p>${esc(n.texto).replace(/\n/g, '<br>')}</p>` : ''}` +
          (adm ? `<button type="button" class="nov-apagar" data-nov-apagar="${n.id}" title="Apagar esta novidade">✕</button>` : '') + `</article>`;
      }).join('')).join('') : '<div class="bloqueio">Nenhuma novidade ainda.</div>');
  }

  // janela de novidades
  window.abrirNovidades = async function () {
    if (!carregado) await carregar();
    const d = document.createElement('div'); d.className = 'dlg nov-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<div class="dlg-caixa nov-caixa"><div class="picker-topo"><h3>✨ Novidades</h3><button type="button" class="modal-fechar" data-nov-fechar aria-label="Fechar">✕</button></div><div class="nov-lista">${html()}</div></div>`;
    document.body.appendChild(d);
    const fechar = () => { d.remove(); document.removeEventListener('keydown', esc1, true); };
    const esc1 = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc1, true);
    d.addEventListener('mousedown', (e) => { if (e.target === d) fechar(); });
    d.addEventListener('click', async (e) => {
      if (e.target.closest('[data-nov-fechar]')) return fechar();
      const ap = e.target.closest('[data-nov-apagar]'); if (!ap) return;
      if (!await confirmar('Apagar novidade?', 'Ela some para todos os usuários.', { tipo: 'perigo', ok: 'Apagar' })) return;
      const { error } = await sb.from('novidades').delete().eq('id', +ap.dataset.novApagar); if (error) return erro(error);
      NOV.lista = NOV.lista.filter((n) => n.id !== +ap.dataset.novApagar); $('.nov-lista', d).innerHTML = html(); ligarForm(d);
    });
    ligarForm(d);
    // marca como lidas (no perfil, vale para todos os aparelhos)
    if (NOV.naoLidas) {
      const { data } = await sb.from('profiles').update({ novidades_vistas_em: new Date().toISOString() }).eq('id', S.user.id).select().single();
      if (data) { S.perfil = data; contar(); }
    }
  };
  function ligarForm(d) {
    const f = $('#nov-form', d); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const row = { tipo: f.tipo.value, titulo: f.titulo.value.trim().slice(0, 100), texto: f.texto.value.trim().slice(0, 1500) || null };
      if (!row.titulo) return toast('Dê um título à novidade.');
      const { data, error } = await sb.from('novidades').insert(row).select().single();
      if (error) return erro(error);
      NOV.lista.unshift(data); $('.nov-lista', d).innerHTML = html(); ligarForm(d); toast('Novidade publicada!');
    };
  }

  const contaOriginal = window.renderConta;
  window.renderConta = function () { contaOriginal(); carregado ? contar() : carregar(); };
  if (S.perfil) carregar();
})();
