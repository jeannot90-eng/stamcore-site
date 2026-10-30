---
status: live
title: Website traag op mobiel? Dit zijn de oorzaken | Stam Core
meta: Is je website traag op mobiel? De zes meest voorkomende oorzaken in gewone taal, hoe je het zelf meet en wat je vandaag al kunt verbeteren.
h1: Waarom is mijn website traag op mobiel?
zoekwoord: website traag op mobiel
datePublished: 2026-10-30
dateModified: 2026-10-30
og: ["Waarom is mijn website", "traag op mobiel?", "De oorzaken in gewone taal,", "en wat je er zelf aan doet."]
gerelateerd: ["seo-en-google-ads", "google-bedrijfsprofiel-glazenwasser"]
faq: [{"vraag": "Heb ik een PageSpeed-score van 100 nodig?", "antwoord": "Nee. Een score in het groen is mooi, maar het gaat erom dat een klant op zijn telefoon snel ziet wat je doet en hoe hij je bereikt. Kijk vooral of je drie Core Web Vitals in het groen staan en of de pagina op je eigen telefoon vlot opent."}, {"vraag": "Waarom geeft PageSpeed elke keer een andere score?", "antwoord": "De meting is een simulatie en hangt af van het netwerk en de belasting van de testcomputer op dat moment. Een paar punten verschil tussen twee metingen is normaal, ook als er aan je site niets veranderd is. Meet daarom een paar keer en kijk naar de lijn, niet naar één uitschieter."}, {"vraag": "Kom ik hoger in Google als mijn site sneller is?", "antwoord": "Dat valt niet te beloven. Google gebruikt de Core Web Vitals in zijn ranking, maar zegt er zelf bij dat relevantie voorgaat: de pagina die de zoekvraag het best beantwoordt, wint. Een snelle site helpt vooral om bezoekers vast te houden die je al vinden."}, {"vraag": "Ligt het misschien aan mijn telefoon of mijn internet?", "antwoord": "Dat kan. Test daarom ook met PageSpeed Insights, die meet los van jouw toestel en verbinding. Is de site daar ook traag, dan ligt het aan de site. Is hij daar snel en op jouw telefoon niet, kijk dan eerst naar je eigen verbinding."}]
bronnen: ["https://developers.google.com/speed/docs/insights/v5/about (PageSpeed Insights: scores 90-100 goed, 50-89 verbetering nodig, 0-49 slecht; labdata vs velddata over 28 dagen; te weinig gebruikersdata bij kleine of nieuwe sites; mobiel gesimuleerd als middenklasse telefoon op mobiel netwerk, desktop met vaste verbinding; scores schommelen per meting)", "https://web.dev/articles/vitals (Core Web Vitals: LCP 2,5 seconde of minder, INP 200 milliseconden of minder, CLS 0,1 of minder, gemeten per mobiel en desktop)", "https://developers.google.com/search/docs/appearance/page-experience (Core Web Vitals worden gebruikt door de rankingsystemen; geen enkel los signaal; relevantste inhoud gaat voor, ook bij minder goede paginaervaring)", "https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing (Google gebruikt de mobiele versie van een site voor indexering en ranking)", "https://web.dev/articles/optimize-lcp (oorzaken trage LCP: te grote afbeeldingen, WebP/AVIF, LCP-afbeelding nooit lazy-loaden, blokkerende CSS en scripts, trage serverreactie)", "https://web.dev/articles/optimize-cls (verspringen: afbeeldingen zonder breedte en hoogte, embeds, laat ingeladen banners, webfonts)"]
---
Een website is traag op mobiel door een handvol vaste oorzaken: foto's die veel te groot zijn, een slider of video bovenaan, te veel plugins en scripts, en een server die traag reageert. Een telefoon heeft minder rekenkracht dan een laptop en zit vaak op mobiel internet, dus elk overbodig onderdeel merk je daar als eerste. De meeste oorzaken vind je zelf binnen een kwartier, en een flink deel kun je ook zelf oplossen.

## Waarom een trage site op mobiel je aanvragen kost

Wie een glazenwasser zoekt, pakt bijna altijd zijn telefoon. Even zoeken op de bank of in de pauze, twee of drie bedrijven openen, en kijken wie er betrouwbaar uitziet. Laadt jouw pagina dan langzaam, of springt de tekst heen en weer terwijl iemand op je telefoonnummer wil tikken, dan is de kans groot dat hij terug gaat naar de zoekresultaten en de volgende probeert.

Ook voor Google telt de mobiele versie. Google gebruikt de mobiele versie van je site om je pagina's op te nemen en te rangschikken. De snelheid en stabiliteit van een pagina, samengevat in de zogenoemde Core Web Vitals, worden volgens Google gebruikt in de rankingsystemen. Google zegt er wel duidelijk bij dat relevantie voorgaat: een trage pagina die precies antwoord geeft, kan nog steeds bovenaan staan. Snelheid is dus geen wondermiddel, maar wel iets wat je bezoekers vasthoudt die je al vinden.

## Waarom is mijn website traag op mobiel en op de laptop niet?

Dat verschil is normaal. Een laptop heeft een snellere processor en hangt meestal aan wifi of een kabel. Een telefoon moet dezelfde pagina verwerken met minder rekenkracht, vaak via 4G of 5G met wisselend bereik. Zware onderdelen die op de laptop niet opvallen, gaan op de telefoon ineens seconden kosten.

Google PageSpeed Insights, de bekendste snelheidsmeter, rekent daar ook mee. De mobiele meting simuleert een middenklasse telefoon op een mobiel netwerk, de desktopmeting een computer met een vaste verbinding. Daarom valt de mobiele score bijna altijd lager uit. Dat is geen fout in de meting, maar precies de situatie waarin je klant je site bekijkt.

## De zes meest voorkomende oorzaken

### 1. Foto's die veel te groot zijn

Dit is bij sites van servicebedrijven de grootste boosdoener. Een foto die rechtstreeks van je telefoon of camera komt, is vaak duizenden pixels breed en meerdere megabytes groot. Op een telefoonscherm wordt hij maar een paar honderd pixels breed getoond, maar de bezoeker downloadt wel het hele bestand.

**Wat je doet:** verklein foto's voordat je ze uploadt naar de breedte die echt nodig is, sla ze op als WebP of AVIF in plaats van JPG of PNG, en comprimeer ze. Veel websitebouwers en plugins kunnen dat automatisch, maar controleer of het ook echt gebeurt.

### 2. Een slider, video of grote foto bovenaan

Het grootste element dat bij het openen in beeld komt, bepaalt hoe snel je pagina voelt. Google meet dat als LCP: de tijd tot het grootste stuk inhoud zichtbaar is. Een slider met vijf grote foto's of een video op de achtergrond maakt dat moment veel later. Soms staat de bovenste foto ook op "lazy loading", waardoor de browser hem pas laat ophaalt. Voor de bovenste afbeelding is dat precies verkeerd.

**Wat je doet:** kies bovenaan één goede foto in plaats van een slider, en laat een achtergrondvideo op mobiel weg. Gebruik lazy loading alleen voor afbeeldingen lager op de pagina.

### 3. Te veel plugins en scripts

Elke extra functie brengt code mee die de telefoon moet laden en uitvoeren: een paginabouwer, een chatknop, een animatie, een pop-up, statistieken, een social-mediafeed. Sommige scripts houden het tonen van de pagina tegen tot ze klaar zijn. Op een snelle laptop merk je daar weinig van, op een telefoon telt het op.

**Wat je doet:** loop je plugins en ingebouwde extra's na en zet alles uit wat je niet echt gebruikt. Vraag bij elk onderdeel: levert dit een aanvraag op, of staat het er omdat het kon?

### 4. Een trage of overvolle server

Voordat er iets in beeld komt, moet de server de pagina eerst versturen. Bij goedkope gedeelde hosting delen honderden sites dezelfde server, en dan kan alleen die eerste reactie al lang duren. Hetzelfde gebeurt als er geen caching is ingesteld en de server elke pagina bij elk bezoek opnieuw in elkaar zet.

**Wat je doet:** vraag je hostingpartij of caching aanstaat en of je site op een server in Europa draait. Blijft de eerste reactie traag terwijl de pagina zelf licht is, dan is overstappen vaak de snelste winst.

### 5. Een pagina die verspringt

Je kent het: je wilt op een knop tikken en net op dat moment schuift alles naar beneden, omdat er bovenaan nog een foto, banner of lettertype binnenkomt. Google meet dat als CLS. Het maakt de pagina niet trager, maar wel onrustig, en een klant tikt zo per ongeluk op het verkeerde.

**Wat je doet:** zorg dat afbeeldingen een vaste breedte en hoogte hebben, zodat de browser alvast ruimte vrijhoudt. Laat een cookiemelding of actiebalk over de pagina heen vallen in plaats van de inhoud weg te duwen.

### 6. Ingesloten kaarten, feeds en widgets

Een kaartje van Google Maps, een Instagram-feed of een reviewwidget lijkt klein, maar haalt op de achtergrond een complete extra pagina binnen, met eigen scripts. Op veel sites van servicebedrijven staan er twee of drie onder elkaar in de footer.

**Wat je doet:** vervang een ingesloten kaart door een vermelding van je werkgebied en een link naar je Bedrijfsprofiel. Hoe je dat profiel goed neerzet, lees je in [je Google Bedrijfsprofiel inrichten](/kennis/google-bedrijfsprofiel-glazenwasser). Een feed of widget die je echt wilt houden, kun je vaak pas laten laden als iemand erop tikt.

## Zo meet je zelf hoe snel je site op mobiel is

1. **Open je site op je eigen telefoon, met wifi uit.** Tel hoe lang het duurt tot je ziet wat je doet en hoe iemand je belt. Doe dat ook met je belangrijkste dienstpagina, niet alleen met je homepage.
2. **Meet met PageSpeed Insights.** Vul je webadres in en kies het tabblad voor mobiel. De score van 0 tot 100 staat in het rood (0–49), oranje (50–89) of groen (90–100).
3. **Kijk naar de drie Core Web Vitals.** Als vuistregel van Google: het grootste element is binnen 2,5 seconde zichtbaar (LCP), de pagina reageert binnen 200 milliseconden op een tik (INP) en verspringt nauwelijks (CLS 0,1 of minder).
4. **Schrik niet van ontbrekende gebruikersdata.** Bovenaan staan soms meetgegevens van echte bezoekers. Bij een kleine of nieuwe site zijn er daar vaak te weinig van, en dan toont Google alleen de gesimuleerde meting. Dat is normaal.
5. **Meet een paar keer.** De score schommelt per meting, ook als er niets veranderd is. Kijk naar de lijn, niet naar één uitschieter.
6. **Lees de verbeterpunten van boven naar beneden.** PageSpeed laat zien welke afbeeldingen en scripts de meeste tijd kosten. Zo weet je waar je begint.

Wil je het eenvoudiger, doe dan de [gratis website-scan](/website-scan). Die meet je homepage op mobiel en desktop en zet de belangrijkste verbeterpunten in gewone taal onder elkaar.

## Dit kun je vandaag al doen

- Vervang de grootste foto's op je homepage door verkleinde WebP-versies.
- Zet een slider bovenaan om naar één vaste foto.
- Schakel plugins en widgets uit die je de afgelopen maanden niet hebt gebruikt.
- Haal een ingesloten kaart uit je footer en zet er je werkgebied in tekst neer.
- Controleer of je telefoonnummer en een knop voor WhatsApp of een offerte meteen in beeld staan, zonder dat iemand hoeft te scrollen.
- Meet daarna opnieuw met PageSpeed Insights en noteer de score, zodat je ziet wat het heeft opgeleverd.

## Wanneer je het beter laat doen

Sommige sites zijn gebouwd op een zwaar thema of een paginabouwer die op elke pagina veel code meestuurt. Dan kun je foto's verkleinen wat je wilt, de basis blijft traag. Ook de server en caching instellen is werk waar je niet elke week mee bezig wilt zijn.

Laat je het oplossen, vraag dan vooraf wat er precies verandert en meet voor en na. Een goede webbouwer kan je vertellen welk onderdeel de meeste tijd kost en wat het oplevert om dat aan te pakken. Soms is een nieuwe, lichte site goedkoper dan blijven sleutelen aan een oude. Waar een site voor glazenwassers verder aan moet voldoen, lees je bij [een website voor glazenwassers](/website-glazenwasser). En als je wilt weten hoe een snelle pagina ook je advertenties helpt, lees dan [wat SEO doet voor je Google Ads](/kennis/seo-en-google-ads).

## Samengevat

Een trage site op mobiel komt meestal door te grote foto's, een zware bovenkant, te veel scripts of een trage server. Meet het op je eigen telefoon en met PageSpeed Insights, pak eerst de grootste foto's en overbodige plugins aan, en meet opnieuw. Wil je weten waar jouw site staat, doe dan de [gratis website-scan](/website-scan), of lees hoe je met [lokale SEO voor glazenwassers](/seo-glazenwasser) beter gevonden wordt.
