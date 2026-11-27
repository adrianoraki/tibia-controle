// TibiaHub — dados próprios dos Combos e da Roda do Destino (sugestões do TibiaHub, montadas a partir das regras do jogo).
// Regras da Wheel of Destiny: TibiaWiki (CC BY-SA). Cada passo do combo lista magias em ordem de preferência;
// o site usa a primeira que o seu level já libera.
const COMBOS = {
  knight: {
    solo: { postura: 'Blood Rage', ideia: 'Junte os monstros em volta (box) e gire as magias de área. Troque para Protector se a vida cair rápido.',
      passos: [['Fierce Berserk', 'Berserk'], ['Groundshaker'], ['Berserk'], ['Front Sweep']],
      cura: [['Fair Wound Cleansing', 'Wound Cleansing', 'Bruise Bane'], ['Intense Recovery', 'Recovery']], emergencia: [['Intense Wound Cleansing']] },
    time: { postura: 'Protector', ideia: 'Você segura os monstros para o time. Puxe com challenge, mantenha todos em você e use área nos intervalos.',
      passos: [['Chivalrous Challenge', 'Challenge'], ['Groundshaker'], ['Fierce Berserk', 'Berserk'], ['Shield Slam']],
      cura: [['Fair Wound Cleansing', 'Wound Cleansing'], ['Intense Recovery', 'Recovery']], emergencia: [['Intense Wound Cleansing']] },
    boss: { postura: 'Blood Rage', ideia: 'Dano em um alvo só. Abra com o ferimento e use os golpes fortes sempre que voltarem.',
      passos: [['Inflict Wound'], ['Annihilation', 'Brutal Strike'], ["Executioner's Throw"], ['Shield Bash', 'Brutal Strike']],
      cura: [['Fair Wound Cleansing', 'Wound Cleansing'], ['Intense Recovery', 'Recovery']], emergencia: [['Intense Wound Cleansing'], ['Avatar of Steel']] },
  },
  paladin: {
    solo: { postura: 'Divine Defiance', ideia: 'Junte os monstros e use as magias sagradas de área; a postura transforma parte da distância em magic level sagrado.',
      passos: [['Divine Empowerment'], ['Divine Caldera'], ['Divine Barrage', 'Ethereal Barrage', 'Divine Caldera'], ['Divine Grenade']],
      cura: [['Salvation', 'Divine Healing', 'Intense Healing'], ['Intense Recovery', 'Recovery']], emergencia: [] },
    time: { postura: 'Divine Defiance', ideia: 'Dano em área no meio do grupo. Use Divine Dazzle para tirar monstros de cima de quem está apanhando.',
      passos: [['Divine Empowerment'], ['Divine Caldera'], ['Divine Barrage', 'Ethereal Barrage'], ['Divine Dazzle']],
      cura: [['Salvation', 'Divine Healing', 'Intense Healing'], ['Intense Recovery', 'Recovery']], emergencia: [] },
    boss: { postura: 'Sharpshooter', ideia: 'Um alvo só: a postura dá distance fighting e as lanças fazem o dano principal.',
      passos: [['Holy Flash'], ['Strong Ethereal Spear', 'Ethereal Spear', 'Lesser Ethereal Spear'], ['Divine Missile'], ['Ethereal Spear']],
      cura: [['Salvation', 'Divine Healing', 'Intense Healing']], emergencia: [['Avatar of Light']] },
  },
  sorcerer: {
    solo: { postura: 'Master of Flames', ideia: 'Na postura de fogo, a magia depois de uma de fogo vira fogo também: alterne fogo e energia. Use a magia focus para terminar o grupo.',
      passos: [['Great Fire Wave', 'Fire Wave', 'Scorch'], ['Energy Wave', 'Energy Beam'], ['Great Fire Wave', 'Fire Wave'], ['Great Energy Beam', 'Energy Beam'], ['Death Echo'], ["Hell's Core"]],
      cura: [['Ultimate Healing', 'Intense Healing', 'Light Healing']], emergencia: [['Restoration']], extra: [['Aura of Exposed Weakness']] },
    time: { postura: 'Master of Flames', ideia: 'Ligue Expose Weakness (o time inteiro bate mais) e gire as magias de área.',
      passos: [['Aura of Exposed Weakness'], ['Great Fire Wave', 'Fire Wave'], ['Energy Wave'], ['Great Energy Beam', 'Energy Beam'], ['Death Echo'], ['Rage of the Skies', "Hell's Core"]],
      cura: [['Ultimate Healing', 'Intense Healing']], emergencia: [['Restoration']] },
    boss: { postura: 'Master of Thunder', ideia: 'Um alvo só: abra com a magia de dano contínuo e use os strikes do mais forte para o mais fraco. Troque o elemento pela fraqueza do boss.',
      passos: [['Electrify'], ['Ultimate Energy Strike', 'Strong Energy Strike', 'Energy Strike', 'Buzz'], ['Lightning', 'Energy Strike'], ['Strong Energy Strike', 'Energy Strike'], ['Great Death Beam', 'Great Energy Beam', 'Energy Beam']],
      cura: [['Ultimate Healing', 'Intense Healing']], emergencia: [['Restoration'], ['Avatar of Storm']], extra: [['Aura of Sapped Strength']] },
  },
  druid: {
    solo: { postura: 'Elemental Synthesis', ideia: 'As magias "forked" pulam sozinhas entre os monstros. Alterne gelo e terra e use as ondas quando todos estiverem na frente.',
      passos: [['Forked Glacier', 'Strong Ice Wave', 'Ice Wave', 'Chill Out'], ['Forked Thorns', 'Terra Wave'], ['Ice Burst', 'Terra Burst', 'Strong Ice Wave'], ['Strong Ice Wave', 'Ice Wave'], ['Eternal Winter', 'Wrath of Nature']],
      cura: [['Ultimate Healing', 'Intense Healing', 'Light Healing']], emergencia: [['Restoration']] },
    time: { postura: 'Shared Conservation', ideia: 'Você é a cura do grupo: a postura faz a cura em alguém curar outro aliado também. Ataque só quando todos estiverem bem.',
      passos: [["Nature's Embrace", 'Heal Friend'], ['Mass Healing'], ['Heal Friend'], ['Forked Glacier', 'Strong Ice Wave', 'Ice Wave']],
      cura: [['Ultimate Healing', 'Intense Healing']], emergencia: [['Restoration']] },
    boss: { postura: 'Elemental Synthesis', ideia: 'Um alvo só: dano contínuo de terra e strikes de gelo e terra. Troque pelo elemento fraco do boss.',
      passos: [['Envenom'], ['Ultimate Ice Strike', 'Strong Ice Strike', 'Ice Strike'], ['Ultimate Terra Strike', 'Strong Terra Strike', 'Terra Strike'], ['Strong Ice Strike', 'Ice Strike']],
      cura: [['Ultimate Healing', 'Intense Healing']], emergencia: [['Restoration'], ['Avatar of Nature']] },
  },
  monk: {
    solo: { postura: '', ideia: 'Construa Harmony com as magias "builder" e gaste com as de área. Mantenha a virtude ativa.',
      passos: [['Thousand Fist Blows', 'Chained Penance', 'Double Jab', 'Swift Jab'], ['Greater Flurry of Blows', 'Flurry of Blows'], ['Chained Penance', 'Double Jab'], ['Spiritual Outburst', 'Sweeping Takedown', 'Flurry of Blows']],
      cura: [['Spirit Mend', 'Intense Healing', 'Light Healing']], emergencia: [] },
    time: { postura: '', ideia: 'As virtudes também fortalecem o grupo. Construa Harmony, gaste em área e cure o time com Mass Spirit Mend.',
      passos: [['Thousand Fist Blows', 'Chained Penance', 'Double Jab'], ['Mass Spirit Mend'], ['Greater Flurry of Blows', 'Flurry of Blows'], ['Spiritual Outburst', 'Sweeping Takedown']],
      cura: [['Spirit Mend', 'Intense Healing']], emergencia: [['Mass Spirit Mend']] },
    boss: { postura: '', ideia: 'Um alvo só: junte Harmony com os jabs e gaste tudo no golpe mais forte.',
      passos: [['Double Jab', 'Swift Jab'], ['Chained Penance', 'Double Jab'], ['Mystic Repulse', 'Lesser Mystic Repulse'], ['Devastating Knockout', 'Greater Tiger Clash', 'Tiger Clash'], ['Forceful Uppercut']],
      cura: [['Spirit Mend', 'Intense Healing']], emergencia: [['Avatar of Balance']] },
  },
};

// Roda do Destino: cada vocação tem 4 Revelation Perks (um por domínio de 1.000 pontos).
// Estágios: 250 / 500 / 1.000 pontos no domínio. Cada estágio também dá +4 / +9 / +20 de dano e cura.
const RODA = {
  comum: {
    'Gift of Life': 'Quando um golpe seria fatal, cura você e dá uma segunda chance. Fica mais forte a cada estágio.',
  },
  knight: { avatar: 'Avatar of Steel', perks: {
    "Executioner's Throw": 'Joga a arma no alvo e salta para 2/3/4 inimigos perto. +100/125/150% de dano em alvos com menos de 30% de vida. Recarga 18/14/10 s.',
    'Combat Mastery': 'Você recebe menos dano quanto menor a sua vida (1% a cada 14/12/10% perdidos), dobrado com escudo; e causa mais dano quanto menor a vida do alvo, dobrado com arma de duas mãos.' } },
  paladin: { avatar: 'Avatar of Light', perks: {
    'Divine Grenade': 'Marca o chão do alvo e explode depois de 3 s com dano sagrado (+16% por estágio). Recarga 26/20/14 s.',
    'Divine Empowerment': 'Cria um campo 3x3 de 5 s: enquanto estiver nele você causa +8/10/12% de dano. Recarga 32/28/24 s.' } },
  sorcerer: { avatar: 'Avatar of Storm', perks: {
    'Beam Mastery': 'Os beams acertam também as casas do lado (25/40/70% do dano). Cada alvo no centro do beam dá +10/12/14% de dano ao beam e −1 s em todas as recargas (até 3).',
    'Lord of Destruction': 'Melhora as posturas: Flames +2/3/4% de poder em fogo; Thunder +2/3/4% de crítico em energia; Decay +15/25,5/30% de dano crítico em morte.' } },
  druid: { avatar: 'Avatar of Nature', perks: {
    'Blessing of the Grove': 'Heal Friend e Nature\'s Embrace podem curar com crítico. Cura +5/7,5/10% em alvos com 30–60% de vida e +10/15/20% abaixo de 30%.',
    'Twin Bursts': 'Ice Burst e Terra Burst em anel ao seu redor, +20/40/60% de dano em alvos com mais de 60% de vida. Recarga 22/18/14 s.' } },
  monk: { avatar: 'Avatar of Balance', perks: {
    'Spiritual Outburst': 'Gasta Harmony e acerta o alvo e mais 7 inimigos em cadeia. Com Harmony cheia, repete depois de 1 s com 37,5/50/62,5% do dano. Recarga 24/20/16 s.',
    'Ascetic': 'Harmony base +1/2/3% e seus ataques normais causam dano extra igual a 100/200/300% do seu Mantra.' } },
  avatarTxt: 'Vira avatar por 15 s: todos os ataques são críticos, com +5/10/15% de redução de dano e +5/10/15% de dano crítico. Recarga 120/90/60 min.',
  // ordem de prioridade sugerida pelo TibiaHub para cada jeito de jogar
  prioridade: {
    knight: { solo: ['Gift of Life', 'Avatar of Steel', "Executioner's Throw", 'Combat Mastery'], time: ['Gift of Life', 'Combat Mastery', 'Avatar of Steel', "Executioner's Throw"], boss: ['Combat Mastery', 'Avatar of Steel', "Executioner's Throw", 'Gift of Life'] },
    paladin: { solo: ['Divine Empowerment', 'Divine Grenade', 'Gift of Life', 'Avatar of Light'], time: ['Divine Empowerment', 'Gift of Life', 'Avatar of Light', 'Divine Grenade'], boss: ['Avatar of Light', 'Gift of Life', 'Divine Grenade', 'Divine Empowerment'] },
    sorcerer: { solo: ['Beam Mastery', 'Lord of Destruction', 'Gift of Life', 'Avatar of Storm'], time: ['Beam Mastery', 'Lord of Destruction', 'Avatar of Storm', 'Gift of Life'], boss: ['Avatar of Storm', 'Lord of Destruction', 'Gift of Life', 'Beam Mastery'] },
    druid: { solo: ['Twin Bursts', 'Gift of Life', 'Blessing of the Grove', 'Avatar of Nature'], time: ['Blessing of the Grove', 'Gift of Life', 'Twin Bursts', 'Avatar of Nature'], boss: ['Avatar of Nature', 'Blessing of the Grove', 'Twin Bursts', 'Gift of Life'] },
    monk: { solo: ['Spiritual Outburst', 'Ascetic', 'Gift of Life', 'Avatar of Balance'], time: ['Ascetic', 'Gift of Life', 'Spiritual Outburst', 'Avatar of Balance'], boss: ['Avatar of Balance', 'Ascetic', 'Spiritual Outburst', 'Gift of Life'] },
  },
};
// Melhorias de magia (Conviction Perks): cada uma aparece 2 vezes na roda; a 1ª fatia completa dá o estágio I, a 2ª dá o II.
RODA.conv = {
  knight: [['Fierce Berserk', '−30 de mana', '+10% de dano base'], ['Intense Wound Cleansing', '+125% de cura base', '−60 s de recarga'], ['Shield Slam', '+15% de roubo de vida', '+25% de redução de dano (75% no total)'], ['Groundshaker', '−2 s de recarga', '+12,5% de dano base'], ['Front Sweep', '+40% de poder base', '+2 casas de alcance']],
  paladin: [['Divine Caldera', '−20 de mana', '+10% de dano base'], ['Divine Barrage', '+8% de dano base', '+12% de dano base'], ['Divine Dazzle', '+2 alvos', '+4 s de duração e −8 s de recarga'], ['Strong Ethereal Spear', '−2 s de recarga', '+380% de dano base'], ['Ethereal Barrage', '+10% de roubo de vida', '+10% de chance de crítico']],
  sorcerer: [['Great Fire Wave', '+10% de chance e +15% de dano crítico', '+5% de dano base'], ['Energy Wave', 'área maior', '+10% de dano base'], ['Death Echo', '−2 s de recarga', '+12% de dano base'], ['Magias especiais (strikes ultimate)', '−4 s de recarga', '+50% de dano base'], ['Magias focus', '+5% de dano base', '−4 s na recarga secundária']],
  druid: [['Heal Friend', '+4% de cura base', '+6% de cura base'], ['Terra Wave', '+6,5% de dano base', '+10% de roubo de vida'], ['Mass Healing', '+4% de cura base', 'área maior'], ['Strong Ice Wave', '+6% de dano base', 'área maior'], ['Forked (Glacier e Thorns)', '−2 s de recarga', '+1 alvo']],
  monk: [['Mass Spirit Mend', '+8% de cura base', '−4 s de recarga'], ['Flurry of Blows', 'área maior', '+15% de dano base'], ['Mystic Repulse', '−6 s de recarga', '+40% de dano base'], ['Thousand Fist Blows', '+40% de dano crítico', '−6 s de recarga'], ['Chained Penance', '+1 alvo na corrente', '+18% de dano base']],
};
RODA.passivas = {
  knight: [['Battle Instinct', 'Cura +10%, triplicada com escudo.'], ['Battle Healing', 'Cura +10%, triplicada com escudo.']],
  paladin: [['Positional Tactics', '+3 distance sem monstro colado; senão +3 magic level de holy e cura.'], ['Ballistic Mastery', 'Crossbow: +10% de dano crítico. Bow: +4% de pierce físico e sagrado.']],
  sorcerer: [['Focus Mastery', 'Depois de Hell\'s Core ou Rage of the Skies, a próxima magia de dano faz +35% (12 s).'], ['Runic Mastery', '25% de chance de +10% de magic level na runa (+20% se for runa da sua vocação).']],
  druid: [['Healing Link', 'Ao curar alguém com Heal Friend ou Nature\'s Embrace, você também se cura em 10%.'], ['Runic Mastery', '25% de chance de +10% de magic level na runa (+20% se for runa da sua vocação).']],
  monk: [['Guiding Presence', 'Aura que divide o seu mantra com o grupo e aumenta os bônus de grupo em 33%.'], ['Sanctuary', 'Gastar Harmony cria um campo de 5 s: +2% de dano e cura por Harmony.']],
};
