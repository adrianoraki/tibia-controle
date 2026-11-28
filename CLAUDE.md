# TibiaHub — regras do projeto

## Toda atualização publicada tem versão e novidade (obrigatório)
Sempre que uma mudança for publicada no site (Vercel), no MESMO commit:
1. Acrescente uma entrada **no topo** de `novidades.json` com a versão nova:
   `{ "versao": "X.Y.Z", "data": "<ISO com fuso -03:00>", "tipo": "novo|melhoria|correcao|aviso", "titulo": "...", "texto": "..." }`
2. Versão (semver): **X** muda grande/incompatível · **Y** funcionalidade nova · **Z** correção ou ajuste pequeno.
3. Escreva título e texto para o jogador (português do Brasil, sem termos técnicos).

O site lê a versão atual da primeira entrada de `novidades.json` (rodapé e cartão da conta) e mostra o aviso
"Nova versão disponível" para quem está com o site aberto. Por isso novidade e site são publicados juntos — nunca separados.

## Segurança (não negociável)
- Todo texto vindo do usuário ou de APIs passa por `esc()` antes de ir para `innerHTML`.
- Nada de `onclick=`/`<script>` inline: a Content-Security-Policy (vercel.json) bloqueia.
- Tabelas novas: RLS ligado, `revoke all ... from anon`, políticas por `auth.uid()`, limites de tamanho (`check`).
- Funções SECURITY DEFINER com `set search_path = ''` e checagem de dono/admin dentro da função.
- Nunca dar TRUNCATE/REFERENCES/TRIGGER para anon/authenticated (TRUNCATE ignora RLS). Tabela só de leitura: só SELECT.
- Dados de outros jogadores (ex.: avisos do Yasir) saem por função que não devolve user_id.
- Yasir em tempo real: gatilho tg_yasir_avisar manda só {} no canal privado `yasir:<mundo>` (realtime.send); política em realtime.messages só deixa logados ESCUTAR (sem insert). O site rebusca por yasir_hoje().
- Online do site: tabelas site_online/site_recorde sem acesso direto; o site chama ping_online() a cada minuto e recebe só {online, recorde, recorde_em}.
- O aviso "PARE!" do console fica em tema.js; tokens de e-mail são tirados do endereço em app.js (onAuthStateChange).
- Limite de linhas por conta (gatilho limite_linhas_usuario): compras_market 3.000, historico_precos/gastos_extras/loot_guardado 20.000, hunts 50.000 (além do limite do plano grátis).
- Senhas vazadas: o recurso do Supabase é só do plano Pro; o site faz a checagem por conta própria (ui.js window.senhaVazada: k-anonimato na api.pwnedpasswords.com, liberada no connect-src) no cadastro, na troca e na recuperação de senha. Se a API não responder, não bloqueia.

## Visual
- visual.css (depois de tema.css): temas medieval e moderno (data-tema; lista em tema.js + ui.js TEMAS), botão 🎨 no topo, paginação padrão paginar(id, lista, tam, redesenhar) em app.js (classe .paginacao, data-pg="id:n"), barra de baixo no celular (lateral.js .nav-baixo, ≤700px), menu em ícones no tablet (901–1200px).
- Pré-visualização local: /home/claude/w/prev (stub do Supabase) + shot.sh (Chrome headless).

- Comunidade (comunidade.js): profiles.compartilhar (opt-in, update só do dono); RPCs comunidade_hunts(voc, lvl_min, lvl_max), comunidade_market(mundo), comunidade_builds(voc, lvl_min, lvl_max): SECURITY DEFINER, só médias de grupos com 3+ user_id distintos, nunca devolvem user_id/nome; só authenticated.

- Próximos passos e previsão de gold (passos.js): regras no navegador; window.renderPassos() (chamado em renderPainel, #passos-app), dicas escondidas em localStorage tc_passos_ok; window.previsaoGold(falta) usado nas Metas (ritmo dos últimos 30 dias).

- Minha guild (guild.js): TibiaData /character (guild do personagem) e /guild/{nome}; nada no servidor, nome da guild em localStorage tc_guild; atualiza a cada 3 min com a página aberta. Divisão de loot (ferramentas.js lerPartyTexto): lê o Copy to clipboard do Party Hunt Analyser no navegador.

- Metas: só a diária é editável; metasDe(p) dá semana = diária×7 e mês = diária×dias do mês (também gravadas em meta_semanal/meta_mensal ao salvar).
- Meta diária com saldo (renderPainel): saldo do mês = soma de (profit do dia − meta) só nos dias com hunt; a meta de hoje vira meta − saldo anterior (mín. 0); zera todo mês.

- Menu: grupos colapsáveis (lateral.js, localStorage tc_menu_grupos; grupo da página ativa sempre aberto; no trilho de ícones tudo aparece). Lista VIP (guild.js, tc_vip ≤30 nomes, tc_vip_lv levels por dia; TibiaData /character e /world). Previsão de level (app.js previsaoLevel: XP das hunts dos últimos 14 dias). Rashid × inventário (app.js rashidMeu: inventario × npc_itens onde npc = Rashid). Custo do set (analista.js cartaoCusto + ferramentas.js window.custoImbTH com os preços anotados).
- Todas as metas usam a mesma regra: meta diária × dias com hunt (Metas, Este mês, Desempenho e gráfico acumulado).

- NPCs (npcs.js): tabela npcs (posições TibiaWiki), compra = npc_itens (npc + npcs), vende = itens_info.compra_de via npc_vende(npc); mapa: window.abrirMapaNpc({nome,x,y,z}) em mapa.js. Inventário por categoria (itens_info.tipo = primarytype, via tipos_dos_itens) e por NPC (window.inventarioPorNpc). itens_info é preenchida pelo importar-itens (v12).

## Stack
HTML/CSS/JS puro (sem build) · Supabase (projeto shqwskfijvfndaocaqdv) · Vercel (projeto tibia-controle, publica a partir do GitHub `main`).

## Dados importados
- Magias: Edge Function `importar-magias` (tibiawiki.dev/api/spells?expand=true) → tabela `magias`; cron `magias-semanal` (quarta 11:35 UTC) via disparar_func.
- Roda do Destino: roda.js (RODA_OF) tirado do planejador oficial do tibia.com (community/?subtopic=wheelofdestinyplanner): posição das 36 fatias por vocação, dedicação por ponto, Conviction/Revelation Perks, geometria e imagens hotlink de static.tibia.com (fonte citada). Para atualizar: abrir o planejador no navegador do Luis e chamar createModule() → SkillwheelPlanner(voc).getSkillParameters() / getCornerParameters(); textos em SkillwheelStringsJsonLibrary.json. Textos PT escritos por nós.
- Combos: dados próprios em combos.js (COMBOS por vocação/situação; RODA.prioridade usada pela build recomendada).
- Analista da roda (analista.js): regras no navegador, sem IA paga. Lê profiles.analista (jsonb ≤ 4 KB, só o dono edita: ML/skill e set por vocação), itens_equip, imbuements e magias.base_poder (importador lê `basepower` da tibiawiki.dev). Força = base power × melhoria da roda × crítico médio. Dano: fórmulas do Tibia 15.25 com base power (comunidade, conferidas com exemplos publicados): magia de ML = B(L) + bp/25×ML + bp/6; magia de arma = B(L) + bp/1000×skill×ataque + bp/6; mín ⌊×0,9⌋ / máx ⌈×1,1⌉; ataque básico o=⌊6×atk/5⌋×(skill+4)/28, médio B+o×r (r=2 monk). Magias de arma e ataque básico saem nos elementos da arma (itens_equip.ataque_el) e dos imbuements de dano; contra monstro aplica criaturas.detalhes.mods e a armadura média no físico de arma. Comparação da roda: sem roda / recomendada / roda salva (profiles.analista.rodas[voc], 36 números). Ajuste manual por hit é opcional (cal). BP_GUIA cobre runas e magias sem basepower na wiki. Dano/cura do level: fórmula fechada S = ⌊(√(2L+2025)+5)/10⌋, B = ⌊(L+1000)/S⌋+50S−450 (igual à regra +1/5 até 500, +1/6 até 1100… conferida do level 1 ao 3999).
- Gemas (gemas.js): Basic/Supreme Mods da TibiaWiki (páginas Basic_Mod e Supreme_Mod, lidas pela API do fandom via net.http_get no Supabase, já que o navegador é barrado pelo Cloudflare). Valor do grau I × [1; 1,1; 1,2; 1,5]; ressonância = fatias Vaso cheias no domínio (1º mod nv1, 2º nv2, supreme nv3); +1/+2 dano/cura se a ressonância = tamanho da gema. Salvo em profiles.analista.gemas[voc].
- Nome visível do analista: "Oráculo IA" (desde v1.46.1); arquivos/variáveis continuam analista.
- Plano de gemas (analista.js caminhosVaso/planoGemas/blocoPlano): para cada domínio acha o caminho mais barato (do zero, regra de vizinha cheia) até 1/2/3 fatias Vaso; testa as 256 combinações de tamanho por domínio dentro dos pontos da roda (nota Lesser 3, Regular 5, Greater 10; desempate pelo menor custo). Mods: hp (mana para mago, mit no boss), 2º r_physical, supreme = o que mais aumenta o combo (sem Strike os de crítico dão 0). Botão data-an-gplano grava as gemas. Revisar no Winter Update (8 vasos).
- Descrição das magias em português: coluna `magias.efeito_pt` (traduzida à mão; o importador não mexe nela). Magia nova fica com o texto em inglês até ganhar tradução.
- Meu inventário (tabelas inventario/inventario_mov, só leitura no navegador): entra por inventario_hunt() (leitor do Hunt Analyzer, 1x por hunt), gatilho tg_inv_market (qtd_comprada − qtd_vendida), sai em vender_loot_npc; ajuste manual por inventario_ajustar(); preço de Market por item em inventario.preco_market via inventario_preco(item, preço|null) (tem prioridade sobre a última compra); apagar hunt desfaz o loot dela. Núcleo _inv_mexer (não exposto, nunca negativo, ignora moedas).
- Skill do personagem: a página do personagem (e a TibiaData /character) não mostra skills. O analista busca no Highscores via TibiaData /v4/highscores/{mundo}/{magiclevel|swordfighting|axefighting|clubfighting|distancefighting|fistfighting}/{knights|paladins|sorcerers|druids|monks}/{1..20} (top 1000 da vocação no mundo; valor = skill base sem itens), no navegador, e guarda em profiles.analista; roda sozinho 1x por dia ao abrir o analista da vocação do personagem.
- Ataque da arma: itens_equip.ataque (físico + elemental) e ataque_el ("ice 44"), lidos pelo importar-itens (campos attack e <elemento>_attack da tibiawiki.dev).
- Inventário do personagem no jogo: não existe API (tibia.com não publica inventário/depot; só o Char Bazaar mostra itens de personagens à venda). Não ler arquivos/memória do client (regras da CipSoft/BattlEye).

## Pendências (combinadas com o Luis)
- **Mais de um personagem na mesma conta (VIP)**: mexe em hunts, XP e coleta automática; fazer numa etapa separada.
- **Plano Apoiador (antigo VIP)**: preços aprovados Mensal R$ 9,90 · Trimestral R$ 24,90 · Anual R$ 79,90; Pix via Mercado Pago (conta do Luis) ainda a ligar.
  Regra da CipSoft (resposta de 23/11/2026): pode haver recursos pagos para cobrir custos, desde que a maior parte seja grátis,
  não se cobre pelo conteúdo do jogo e o foco não seja lucro. Por isso: **conteúdo do jogo é sempre grátis** (mapa, Boss Tracker,
  locais de caça, NPCs, fichas, eventos, notícias); o Apoiador só ganha ferramentas pessoais do jogador.
- **Programa de fansites**: recusado em 23/11/2026 por ser recente, ter muita ajuda de IA e pouco conteúdo original. Pode tentar no futuro,
  com tempo de site, comunidade própria e conteúdo original do Luis.
- **Imagens do tibia.com**: CipSoft liberou usar imagens e textos do jogo/site citando www.tibia.com (feito no rodapé e no Quem somos);
  o download automático segue bloqueado pelo Cloudflare — se for copiar, usar o kit de fãs ou baixar pelo navegador do Luis.
- **Winter Update (dez/2026)**: reler a roda no planejador oficial pelo navegador do Luis (ver "Dados importados") e atualizar roda.js; revisar prioridades em combos.js, as regras do analista (gemas/vasos) e as magias novas sem `efeito_pt`.
- **Domínio tibiahub.com.br**: quando o Luis registrar, ligar na Vercel.
- **Sobras no Supabase**: bucket vazio "imagens" e Edge Function "copiar-imagens" (apagar pelo painel se a CipSoft não liberar as imagens).
