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
- Pendente no painel do Supabase (Auth > Senhas): ligar a proteção contra senhas vazadas (HaveIBeenPwned), se o plano permitir.

## Stack
HTML/CSS/JS puro (sem build) · Supabase (projeto shqwskfijvfndaocaqdv) · Vercel (projeto tibia-controle, publica a partir do GitHub `main`).

## Dados importados
- Magias: Edge Function `importar-magias` (tibiawiki.dev/api/spells?expand=true) → tabela `magias`; cron `magias-semanal` (quarta 11:35 UTC) via disparar_func.
- Roda do Destino: roda.js (RODA_OF) tirado do planejador oficial do tibia.com (community/?subtopic=wheelofdestinyplanner): posição das 36 fatias por vocação, dedicação por ponto, Conviction/Revelation Perks, geometria e imagens hotlink de static.tibia.com (fonte citada). Para atualizar: abrir o planejador no navegador do Luis e chamar createModule() → SkillwheelPlanner(voc).getSkillParameters() / getCornerParameters(); textos em SkillwheelStringsJsonLibrary.json. Textos PT escritos por nós.
- Combos: dados próprios em combos.js (COMBOS por vocação/situação; RODA.prioridade usada pela build recomendada).
- Analista da roda (analista.js): regras no navegador, sem IA paga. Lê profiles.analista (jsonb ≤ 4 KB, só o dono edita: ML/skill e set por vocação), itens_equip, imbuements e magias.base_poder (importador lê `basepower` da tibiawiki.dev). Força = base power × melhoria da roda × crítico médio. Dano: fórmulas do Tibia 15.25 com base power (comunidade, conferidas com exemplos publicados): magia de ML = B(L) + bp/25×ML + bp/6; magia de arma = B(L) + bp/1000×skill×ataque + bp/6; mín ⌊×0,9⌋ / máx ⌈×1,1⌉; ataque básico o=⌊6×atk/5⌋×(skill+4)/28, médio B+o×r (r=2 monk). Magias de arma e ataque básico saem nos elementos da arma (itens_equip.ataque_el) e dos imbuements de dano; contra monstro aplica criaturas.detalhes.mods e a armadura média no físico de arma. Comparação da roda: sem roda / recomendada / roda salva (profiles.analista.rodas[voc], 36 números). Ajuste manual por hit é opcional (cal). BP_GUIA cobre runas e magias sem basepower na wiki. Dano/cura do level: fórmula fechada S = ⌊(√(2L+2025)+5)/10⌋, B = ⌊(L+1000)/S⌋+50S−450 (igual à regra +1/5 até 500, +1/6 até 1100… conferida do level 1 ao 3999).
- Gemas (gemas.js): Basic/Supreme Mods da TibiaWiki (páginas Basic_Mod e Supreme_Mod, lidas pela API do fandom via net.http_get no Supabase, já que o navegador é barrado pelo Cloudflare). Valor do grau I × [1; 1,1; 1,2; 1,5]; ressonância = fatias Vaso cheias no domínio (1º mod nv1, 2º nv2, supreme nv3); +1/+2 dano/cura se a ressonância = tamanho da gema. Salvo em profiles.analista.gemas[voc].
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
