// TibiaHub — cartão do usuário no topo: conta, admin, trocar senha, cores e sair
(() => {
  const btn = $('#btn-usuario'); if (!btn) return;
  const ICO = {
    conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    admin: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    senha: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cores: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/>',
    tc: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5h6M12 9.5V16"/>',
    novidades: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  const iniciais = (t) => String(t || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  const nomeExib = () => S.perfil?.primeiro_nome || S.perfil?.personagem || (S.user?.email || '').split('@')[0] || 'Minha conta';

  function atualizarBotao() {
    if (!S.perfil) return;
    $('#usuario-av').textContent = iniciais(S.perfil.primeiro_nome || S.perfil.personagem);
    $('#usuario-nome').textContent = nomeExib();
  }

  let card = null;
  const fechar = () => { card?.remove(); card = null; btn.setAttribute('aria-expanded', 'false'); };
  function abrir() {
    const p = S.perfil || {}, tema = document.documentElement.getAttribute('data-tema');
    const plano = p.admin ? '<span class="selo selo-adm">Master</span>' : emTeste() ? `<span class="selo" title="Teste grátis de apoiador">Apoiador · ${diasVip()}d</span>` : premium() ? '<span class="selo">Apoiador</span>' : '<span class="selo selo-free">Free</span>';
    card = document.createElement('div'); card.className = 'card-usuario'; card.setAttribute('role', 'menu');
    card.innerHTML = `<div class="cu-topo"><span class="av av-g">${esc(iniciais(p.primeiro_nome || p.personagem))}</span><div class="cu-id"><b>${esc(nomeExib())}</b>` +
      `<small>${p.personagem ? esc(p.personagem) + (p.mundo ? ' · ' + esc(p.mundo) : '') : 'sem personagem'}</small><small class="muted">${esc(S.user?.email || '')}</small></div>${plano}</div>` +
      `<button type="button" role="menuitem" data-cu="novidades">${svg('novidades')}<span>Novidades</span>${window.NOV?.naoLidas ? `<small class="cu-pill">${NOV.naoLidas} nova${NOV.naoLidas > 1 ? 's' : ''}</small>` : ''}</button>` +
      `<button type="button" role="menuitem" data-cu="conta">${svg('conta')}<span>Minha conta e plano</span></button>` +
      (p.admin ? `<button type="button" role="menuitem" data-cu="admin">${svg('admin')}<span>Painel Admin</span></button>` : '') +
      `<button type="button" role="menuitem" data-cu="senha">${svg('senha')}<span>Trocar senha</span></button>` +
      `<button type="button" role="menuitem" data-cu="tc">${svg('tc')}<span>Preço da Tibia Coin</span><small class="cu-valor">${p.preco_tc ? fmt(p.preco_tc) + ' gp' : 'definir'}</small></button>` +
      `<div class="cu-cores">${svg('cores')}<span>Cores</span><div class="cu-temas">` +
        (window.TEMAS_TC || []).map((t) => `<button type="button" class="cu-tema ${t.id === tema ? 'ativo' : ''}" data-cu-tema="${t.id}" title="${t.nome}" aria-label="${t.nome}" style="background:linear-gradient(135deg,${t.cores[0]} 50%,${t.cores[1]} 50%)"></button>`).join('') +
      `</div></div>` +
      `<button type="button" role="menuitem" class="cu-sair" data-cu="sair">${svg('sair')}<span>Sair</span></button>` +
      (window.NOV?.versao ? `<div class="cu-versao">TibiaHub v${esc(NOV.versao)}</div>` : '');
    document.body.appendChild(card); btn.setAttribute('aria-expanded', 'true');
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); card ? fechar() : abrir(); });
  document.addEventListener('click', async (e) => {
    if (!card) return;
    const tm = e.target.closest('[data-cu-tema]');
    if (tm) { window.aplicarTema?.(tm.dataset.cuTema); $$('.cu-tema', card).forEach((b) => b.classList.toggle('ativo', b === tm)); return; }
    const it = e.target.closest('[data-cu]');
    if (!it) { if (!e.target.closest('.card-usuario')) fechar(); return; }
    const acao = it.dataset.cu; fechar();
    if (acao === 'conta') $('#menu [data-pag=conta]').click();
    if (acao === 'admin') $('#menu [data-pag=admin]').click();
    if (acao === 'senha') trocarSenha();
    if (acao === 'novidades') window.abrirNovidades?.();
    if (acao === 'tc') definirTC();
    if (acao === 'sair') {
      if (!await confirmar('Sair da conta?', 'Você vai voltar para a tela de login.', { ok: 'Sair' })) return;
      await sb.auth.signOut(); location.reload();   // recarrega para não sobrar nenhum dado na memória da página
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-definir-tc]')) definirTC(); });

  // preço da Tibia Coin no Market do seu mundo (muda todo dia; não existe API pública com esse valor)
  async function definirTC() {
    const v = await dialogo({ titulo: 'Preço da Tibia Coin', texto: 'Quanto 1 Tibia Coin está custando no Market do seu mundo? Com ele o site mostra quantas TC cada valor rende.',
      ok: 'Salvar', campo: { valor: S.perfil?.preco_tc ? fmt(S.perfil.preco_tc) : '', placeholder: 'ex: 42.500', gold: true },
      validar: (x) => { const n = gold(x); return n == null || n < 1 || n > 1e7 ? 'Digite o preço de 1 TC em gold (ex: 42.500).' : ''; } });
    if (!v) return;
    const { data, error } = await sb.from('profiles').update({ preco_tc: gold(v) }).eq('id', S.user.id).select().single();
    if (error) return erro(error);
    S.perfil = data; renderPersonagem(); toast(`Tibia Coin: ${fmt(data.preco_tc)} gp`);
  }

  // trocar senha: confirma a senha atual antes de gravar a nova
  function trocarSenha() {
    const d = document.createElement('div'); d.className = 'dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<form class="dlg-caixa form-senha" novalidate><div class="dlg-ico" aria-hidden="true">🔑</div><h3 class="dlg-tit">Trocar senha</h3>` +
      `<p class="dlg-txt">Use 8 ou mais caracteres. Não use a senha da sua conta do Tibia.</p>` +
      `<input type="password" name="atual" placeholder="Senha atual" autocomplete="current-password" required>` +
      `<input type="password" name="nova" placeholder="Nova senha" autocomplete="new-password" minlength="8" required>` +
      `<input type="password" name="conf" placeholder="Repita a nova senha" autocomplete="new-password" minlength="8" required>` +
      `<small class="dlg-dica erro"></small><div class="dlg-botoes"><button type="button" class="btn sec" data-x>Cancelar</button><button type="submit" class="btn">Salvar nova senha</button></div></form>`;
    document.body.appendChild(d);
    const f = $('form', d), msg = $('.dlg-dica', d), sair = () => d.remove();
    setTimeout(() => f.atual.focus(), 30);
    d.addEventListener('mousedown', (e) => { if (e.target === d) sair(); });
    $('[data-x]', d).onclick = sair;
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') sair(); });
    f.onsubmit = async (e) => {
      e.preventDefault(); msg.textContent = '';
      const atual = f.atual.value, nova = f.nova.value, conf = f.conf.value, low = nova.toLowerCase();
      if (nova.length < 8) return (msg.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.');
      if (nova !== conf) return (msg.textContent = 'As duas senhas novas não são iguais.');
      if (nova === atual) return (msg.textContent = 'A nova senha precisa ser diferente da atual.');
      const p = S.perfil || {};
      if ([p.primeiro_nome, p.personagem, ...String(p.personagem || '').split(/\s+/)].some((x) => x && x.length >= 3 && low.includes(x.toLowerCase())))
        return (msg.textContent = 'Por segurança, não use seu nome nem o nome do personagem na senha.');
      const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Salvando...';
      const r1 = await sb.auth.signInWithPassword({ email: S.user.email, password: atual });
      if (r1.error) { b.disabled = false; b.textContent = 'Salvar nova senha'; return (msg.textContent = 'Senha atual incorreta.'); }
      const r2 = await sb.auth.updateUser({ password: nova });
      if (r2.error) { b.disabled = false; b.textContent = 'Salvar nova senha'; return (msg.textContent = r2.error.message); }
      sair(); toast('Senha alterada com sucesso!');
    };
  }

  const contaOriginal = window.renderConta;
  window.renderConta = function () { contaOriginal(); atualizarBotao(); };
  atualizarBotao();   // se os dados já chegaram antes deste arquivo carregar
})();
