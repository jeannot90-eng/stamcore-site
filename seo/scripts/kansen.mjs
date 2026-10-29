/* Kansen in het Maps-scanblok: per regel minimaal 4 inhoudelijk verschillende varianten.
   Elke variant is één zin met de stadsnaam, een wijk/kern of het scancijfer erin, zodat
   geen zin van 12+ woorden letterlijk op twee stadspagina's staat.

   Toewijzing: live steden op volgorde van publicatie (dan slug), daarna concepten. Per regel
   krijgt een stad de eerste variant die nog niet bij een eerdere stad staat; zijn ze allemaal
   gebruikt, dan de minst gebruikte. Een nieuwe stad verandert dus niets aan bestaande pagina's.
   Formuleer nooit als belofte. */

const GENERIEK = new Set(['centrum', 'binnenstad', 'noord', 'oost', 'zuid', 'west', 'zuidoost', 'noordwest', 'zuidwest', 'noordoost']);

export const VARIANTEN = {
  // k = aantal van de top 3 zonder pagina's per wijk/kern (≥ 2)
  plaats: [
    (x) => `${x.Kv} bedrijven bovenaan in ${x.stad} hebben geen pagina's per wijk of kern, dus wie op "glazenwasser ${x.w1}" zoekt, vindt bij hen hooguit een algemene pagina over de stad.`,
    (x) => `Een eigen pagina voor ${x.w1} of ${x.w2} ontbreekt bij ${x.kv} koplopers in ${x.stad}, en daarmee laten ze zoekopdrachten op wijkniveau liggen.`,
    (x) => `Wie in ${x.w1} woont en een glazenwasser zoekt, vindt bij ${x.kv} bedrijven bovenaan geen pagina over die wijk; daar kun je in ${x.stad} het verschil maken.`,
    (x) => `In ${x.stad} ${x.k === 1 ? 'heeft' : 'hebben'} ${x.kv} bedrijven in de ${x.top} geen aparte pagina voor een kern als ${x.w2}, dus daar ligt de weg nog open.`,
    (x) => `Pagina's per wijk ontbreken bij ${x.kv} bedrijven bovenaan, terwijl ${x.stad} wijken en kernen heeft als ${x.w1}, ${x.w2} en ${x.w3}.`,
  ],
  // Vanaf hier geen wijknamen: een wijk staat in hooguit één kans per pagina (die over pagina's per wijk, of de basiskans).
  // k = aantal dat niet reageert op reviews (≥ 2)
  reageert: [
    (x) => `${x.Kv} bedrijven bovenaan in ${x.stad} reageren niet op hun reviews, terwijl een korte, vriendelijke reactie nieuwe klanten laat zien wie er achter het profiel zit.`,
    (x) => `Bij ${x.kv} koplopers in ${x.stad} blijven reviews onbeantwoord; reageer jij waar je iets toe te voegen hebt, zeker op kritiek, dan zien nieuwe klanten meteen het verschil.`,
    (x) => `Wie in ${x.stad} de reviews van de ${x.top} doorleest, ziet bij ${x.kv} geen reacties van de eigenaar.`,
    (x) => `${x.Kv} profielen bovenaan in ${x.stad} hebben geen antwoorden van de eigenaar onder hun reviews, terwijl juist een rustige reactie op kritiek vertrouwen geeft.`,
    (x) => `Reageren op reviews laten ${x.kv} koplopers in ${x.stad} over, en juist dat laat zien dat er een vakman achter het profiel zit.`,
  ],
  // k = gemiddeld aantal reviews top 3 (< 30)
  reviewsLaag: [
    (x) => `De ${x.drie} bovenaan in ${x.stad} hebben gemiddeld ${x.k} reviews; met een vaste reviewroutine na elke ronde is dat een gat dat je in maanden kunt dichten, niet in jaren.`,
    (x) => `Gemiddeld ${x.k} reviews bij de koplopers in ${x.stad}: vraag na elke ronde om een review, en dat niveau komt binnen bereik.`,
    (x) => `${x.k} reviews is het gemiddelde bovenaan in ${x.stad}; begin bij klanten die je al jaren helpt, want die schrijven het makkelijkst een paar zinnen over je werk.`,
    (x) => `Het aantal reviews bovenaan in ${x.stad} is bescheiden, gemiddeld ${x.k}, dus elke review die je na een ronde binnenhaalt, valt hier op.`,
    (x) => `Met een QR-code op de bus en een appje na de ronde werk je in ${x.stad} toe naar de ${x.k} reviews die de ${x.top} gemiddeld heeft.`,
    (x) => `Bovenaan in ${x.stad} staan profielen met gemiddeld ${x.k} reviews, een aantal dat met een vast moment voor reviewverzoeken na elke ronde haalbaar wordt.`,
    (x) => `Een voorsprong van gemiddeld ${x.k} reviews is in ${x.stad} niet groot: wie elke tevreden klant een directe link stuurt, ziet zijn eigen aantal gestaag oplopen.`,
  ],
  // k = gemiddeld aantal reviews top 3 (≥ 30)
  reviewsHoog: [
    (x) => `De ${x.drie} bovenaan in ${x.stad} hebben gemiddeld ${x.k} reviews; dat haal je niet in één seizoen in, dus begin met pagina's per wijk en een volledig profiel terwijl je reviews groeien.`,
    (x) => `Met gemiddeld ${x.k} reviews ligt de lat in ${x.stad} hoog, maar reviews zijn niet het enige: wijkpagina's bouw je in weken, reviews in seizoenen.`,
    (x) => `${x.k} reviews gemiddeld bij de koplopers in ${x.stad} vraagt geduld; zet een vaste routine neer en werk intussen aan wat sneller gaat, zoals je profiel en wijkpagina's.`,
    (x) => `In ${x.stad} heeft de ${x.top} gemiddeld ${x.k} reviews, dus zoek je eerst ruimte op wijkniveau, waar een eigen pagina meer zegt dan een algemene stadspagina.`,
    (x) => `Tegen gemiddeld ${x.k} reviews bovenaan in ${x.stad} begin je niet met reviews alleen; combineer een reviewroutine met pagina's per wijk en kijk elke maand wat er beweegt.`,
    (x) => `De koplopers in ${x.stad} bouwden hun gemiddeld ${x.k} reviews over jaren op; jouw kortere route loopt via een compleet profiel en pagina's voor de wijken waar je al komt.`,
  ],
  // k = aantal met minder dan 10 foto's (≥ 2)
  fotos: [
    (x) => `${x.Kv} profielen bovenaan in ${x.stad} hebben minder dan 10 foto's; een paar echte foto's van je bus en je werk maken jouw profiel meteen levendiger.`,
    (x) => `Foto's zijn schaars bij de koplopers in ${x.stad}: ${x.kv} blijven onder de 10, dus met beelden van je eigen rondes val je op.`,
    (x) => `Wie door de profielen in ${x.stad} bladert, ziet bij ${x.kv} bedrijven bovenaan minder dan 10 foto's.`,
    (x) => `Met tien goede foto's van telescoopsteel, bus en schone ruiten heb je in ${x.stad} al meer beeld dan ${x.kv} bedrijven in de ${x.top}.`,
  ],
  // k = aantal zonder eigen website (≥ 1)
  website: [
    (x) => `${x.Kv} bedrijven bovenaan in ${x.stad} ${x.k === 1 ? 'heeft' : 'hebben'} geen eigen website, dus een klant die meer wil weten dan een telefoonnummer, vindt daar niets.`,
    (x) => `In ${x.stad} ${x.k === 1 ? 'mist' : 'missen'} ${x.kv} bedrijven bovenaan een eigen website, terwijl een site met je diensten en werkgebied Google en klanten meer houvast geeft.`,
    (x) => `Wie in ${x.stad} wil zien wat een glazenwasser precies doet, vindt bij ${x.kv} koplopers geen eigen website.`,
    (x) => `Een eigen website ontbreekt bij ${x.kv} bedrijven bovenaan in ${x.stad}; met een site met je diensten en werkgebied heb je daar een voorsprong.`,
  ],
  // Alleen als er minder dan 2 andere kansen zijn; komt dus nooit samen met de kans over wijkpagina's voor.
  basis: [
    (x) => `In ${x.stad} begint het bij de basis: "Glazenwasser" als hoofdcategorie, losse diensten en een werkgebied dat ${x.w1} en ${x.w2} echt dekt.`,
    (x) => `Ook waar de ${x.top} in ${x.stad} veel goed doet, maakt een compleet Bedrijfsprofiel met diensten en een werkgebied tot in ${x.w1} het verschil.`,
    (x) => `Voor ${x.stad} kijk ik als eerste naar je Bedrijfsprofiel: hoofdcategorie, diensten en een werkgebied dat aansluit op wijken als ${x.w2}.`,
    (x) => `De koplopers in ${x.stad} hebben hun basis op orde; jouw ruimte zit in een profiel en website die per wijk laten zien waar je rijdt, van ${x.w1} tot ${x.w2}.`,
  ],
};

/** records: [{ c, scan }], al gesorteerd. Zet rec.kansen. De gekozen variant per regel staat in
    c.kansvarianten ({ regel: index }) en blijft daarna vast; geeft de records terug waarvan die keuze nieuw is. */
export function kiesKansen(records) {
  const gebruik = Object.fromEntries(Object.keys(VARIANTEN).map((r) => [r, new Map()]));
  const tel = (regel, idx) => gebruik[regel].set(idx, (gebruik[regel].get(idx) || 0) + 1);
  // Eerst de vastgelegde keuzes reserveren, zodat nieuwe steden daaromheen kiezen.
  for (const rec of records) for (const { regel } of rec.scan.regels) {
    const vast = rec.c.kansvarianten?.[regel];
    if (Number.isInteger(vast) && vast < VARIANTEN[regel].length) tel(regel, vast);
  }
  const gewijzigd = [];
  for (const rec of records) {
    const wijken = (rec.c.wijken || []).filter((w) => !GENERIEK.has(w.toLowerCase()));
    const kand = wijken.length ? wijken : [rec.c.stad];
    const keuze = {};
    rec.kansen = rec.scan.regels.map(({ regel, k }, i) => {
      const lijst = VARIANTEN[regel];
      const teller = gebruik[regel];
      let idx = rec.c.kansvarianten?.[regel];
      if (!(Number.isInteger(idx) && idx < lijst.length)) {
        idx = lijst.findIndex((_, j) => !teller.has(j));
        if (idx < 0) idx = [...lijst.keys()].sort((a, b) => (teller.get(a) - teller.get(b)) || a - b)[0];
        tel(regel, idx);
      }
      keuze[regel] = idx;
      const w = (o) => kand[(i + o) % kand.length];
      const n = rec.scan.n;
      const kv = k === n ? (n === 3 ? 'alle drie' : n === 2 ? 'beide' : `alle ${n}`) : `${k} van de ${n}`;
      const drie = n === 3 ? 'drie' : n === 2 ? 'twee' : String(n);
      return lijst[idx]({ stad: rec.c.stad, n, k, kv, Kv: kv.replace(/^./, (ch) => ch.toUpperCase()), drie, top: `top ${n}`, w1: w(0), w2: w(1), w3: w(2) });
    });
    if (JSON.stringify(keuze) !== JSON.stringify(rec.c.kansvarianten || {})) { rec.c.kansvarianten = keuze; gewijzigd.push(rec); }
  }
  return gewijzigd;
}
