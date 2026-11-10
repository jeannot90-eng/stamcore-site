---
status: live
title: Wat betekent mijn PageSpeed-score? | Stam Core
meta: Wat is de betekenis van je PageSpeed score? De vier cijfers, rood-oranje-groen en het verschil tussen test en echte bezoekers, plus waar je begint.
h1: Wat betekent mijn PageSpeed-score, en welke score is genoeg?
zoekwoord: pagespeed score betekenis
datePublished: 2026-11-10
dateModified: 2026-11-10
og: ["Wat betekent mijn", "PageSpeed-score?", "De vier cijfers uitgelegd,", "en welke score genoeg is."]
gerelateerd: ["website-traag-op-mobiel", "seo-en-google-ads"]
faq: [{"vraag": "Telt de SEO-score uit PageSpeed mee voor mijn positie in Google?", "antwoord": "Niet als getal. De SEO-score is een lijstje basiscontroles, zoals of je pagina een title en een beschrijving heeft en of Google hem mag opnemen. Faalt er iets, dan is dat het oplossen waard. Een 100 betekent alleen dat de basis op orde is, niet dat je hoger komt."}, {"vraag": "Is een lage score op Toegankelijkheid erg?", "antwoord": "Het is geen ramp, maar wel iets om op te pakken. Het gaat vaak om kleine dingen: te weinig contrast tussen tekst en achtergrond, knoppen zonder naam of foto's zonder beschrijving. Een oudere klant met slechte ogen merkt dat als eerste, en die zoekt net zo goed een glazenwasser."}, {"vraag": "Waarom zie ik bij mijn site geen gegevens van echte bezoekers?", "antwoord": "Google toont die cijfers pas als er genoeg bezoekers met Chrome op je pagina of je hele site zijn geweest. Bij de meeste sites van kleine servicebedrijven is dat te weinig. Dan zie je alleen de testmeting, en die is dan je beste houvast."}, {"vraag": "Mijn webbouwer zegt dat de score niet belangrijk is. Klopt dat?", "antwoord": "Half. Het getal zelf is geen doel, dat klopt. Maar staat je prestatiescore op mobiel in het rood, dan zegt dat wel iets over hoe je site op een telefoon aanvoelt. Vraag dan welke meetwaarde het laagst scoort en wat eraan te doen is."}]
bronnen: ["https://developer.chrome.com/docs/lighthouse/performance/performance-scoring (prestatiescore = gewogen gemiddelde van FCP 10%, Speed Index 10%, LCP 25%, TBT 30%, CLS 25%; kansen en diagnoses tellen niet direct mee; kleuren 0-49 rood, 50-89 oranje, 90-100 groen; score niet lineair, van 99 naar 100 kost ongeveer evenveel als van 90 naar 94; oorzaken van schommelingen zoals advertenties, netwerk, extensies, virusscanner; aparte scoring voor desktop)", "https://developers.google.com/speed/docs/insights/v5/about (labdata vs velddata van echte Chrome-gebruikers over 28 dagen; Core Web Vitals-beoordeling geslaagd als LCP, INP en CLS op het 75e percentiel goed zijn; terugval op gegevens van de hele site; geen gegevens bij te weinig bezoekers; grenzen LCP 2,5 s, INP 200 ms, CLS 0,1; vier categorieën Prestaties, Toegankelijkheid, Praktische tips, SEO; mobiel gesimuleerd als middenklasse telefoon op mobiel netwerk)", "https://developer.chrome.com/docs/lighthouse/accessibility/scoring (toegankelijkheidsscore = gewogen gemiddelde van audits die slagen of falen, geen gedeeltelijke punten; handmatige controles tellen niet mee)", "https://developer.chrome.com/docs/lighthouse/seo/meta-description (SEO-audits wegen even zwaar; Lighthouse beoordeelt niet de kwaliteit van je beschrijving)", "https://developers.google.com/search/docs/appearance/page-experience (Core Web Vitals worden gebruikt door de rankingsystemen; relevantste inhoud gaat voor)", "https://support.google.com/webmasters/answer/9205520?hl=nl (Search Console Core Web Vitals-rapport: praktijkgegevens, statussen Goed / Verbetering nodig / Slecht, mobiel en desktop apart, 'Geen gegevens beschikbaar' bij weinig verkeer)"]
---
De betekenis van je PageSpeed score is kleiner dan veel mensen denken: het getal van 0 tot 100 is een testmeting van één pagina, op een gesimuleerde telefoon, op één moment. Groen (90 of hoger) is goed, oranje (50 tot 89) kan beter en rood (onder de 50) is traag. Belangrijker dan het getal is welke onderdelen laag scoren, en of echte bezoekers je site als snel ervaren. Hieronder lees je hoe je het rapport leest en waar je begint.

## Wat zie je als je PageSpeed Insights opent?

Je vult je webadres in op PageSpeed Insights en krijgt twee tabbladen: mobiel en desktop. Kijk altijd eerst naar mobiel, want daar zoeken de meeste mensen een glazenwasser. Per tabblad staan er twee soorten informatie onder elkaar, en die worden vaak door elkaar gehaald:

1. **Bovenaan: de ervaring van echte bezoekers.** Dit blok heet de beoordeling van de Core Web Vitals. Het is gebaseerd op bezoekers die met Chrome op je site kwamen, over de afgelopen 28 dagen.
2. **Daaronder: de testmeting.** Dit is de bekende cirkel met een getal, plus drie andere cirkels. Google laadt je pagina één keer in een gecontroleerde omgeving en rekent daar de scores uit.

Die twee hoeven niet hetzelfde te zeggen. Je kunt in de test een 60 halen terwijl je echte bezoekers een prima ervaring hebben, of andersom. Wie alleen naar de cirkel kijkt, mist de helft.

## De vier scores: wat betekent elk getal?

In de testmeting staan vier cirkels. Ze meten heel verschillende dingen.

### Prestaties

Dit is het getal waar iedereen het over heeft als ze "mijn PageSpeed-score" zeggen. Het zegt hoe snel en stabiel je pagina laadt in de test. De andere drie gaan niet over snelheid.

### Toegankelijkheid

Kan iedereen je site gebruiken, ook iemand die slecht ziet of een schermlezer gebruikt? Google controleert onder meer contrast, of knoppen en links een naam hebben en of foto's een beschrijving hebben. Elke controle slaagt of faalt, halve punten bestaan niet. Hebben drie van je tien knoppen geen naam, dan faalt die controle helemaal. Let op: dingen die alleen een mens kan beoordelen, tellen niet mee. Een 100 betekent dus niet dat je site voor iedereen perfect werkt.

### Praktische tips

Hier kijkt Google naar technische netheid: draait je site via een beveiligde verbinding, staan er geen fouten in de browserconsole, gebruik je geen verouderde onderdelen. Een lage score hier is vaak iets voor je webbouwer, niet iets wat je klant merkt.

### SEO

Dit is een lijstje basiscontroles voor zoekmachines: heeft de pagina een title en een beschrijving, mag Google hem opnemen, zijn links leesbaar. Elke controle weegt even zwaar. Wat hier niet in zit, is of je tekst goed is, of je per plaats en dienst een pagina hebt en of je in Google Maps verschijnt. Een 100 op SEO betekent dus dat de basis klopt, niet dat je gevonden wordt. Wat er verder bij komt kijken, lees je bij [lokale SEO voor glazenwassers](/seo-glazenwasser).

## Hoe wordt de prestatiescore berekend?

De prestatiescore is geen losse meting, maar een gewogen gemiddelde van vijf meetwaarden. Dat helpt je om te zien waar de punten verloren gaan:

- **Total Blocking Time (TBT), 30 procent.** Hoe lang de pagina tijdens het laden vastzit omdat er scripts draaien. In die tijd reageert een tik op je scherm niet.
- **Largest Contentful Paint (LCP), 25 procent.** Hoe lang het duurt tot het grootste stuk inhoud zichtbaar is, meestal je bovenste foto of kop.
- **Cumulative Layout Shift (CLS), 25 procent.** Hoeveel de pagina verspringt terwijl hij laadt.
- **First Contentful Paint (FCP), 10 procent.** Wanneer er voor het eerst iets in beeld komt.
- **Speed Index, 10 procent.** Hoe snel de pagina er zichtbaar compleet uitziet.

Die verdeling verklaart veel. Samen tellen blokkerende scripts, de bovenste foto en verspringen voor 80 procent mee. Zie je een rode TBT, dan zit het probleem meestal in scripts en plugins. Is LCP rood, kijk dan naar de foto of slider bovenaan. De verbeterpunten lager in het rapport ("kansen" en "diagnose") tellen niet zelf mee in de score; ze wijzen alleen aan wat je meetwaarden omlaag haalt.

### Waarom is de laatste stap naar 100 zo zwaar?

De score loopt niet gelijk op met de snelheid. Tussen ongeveer 50 en 92 levert elke verbetering een vergelijkbare stijging op. Daarboven wordt elk punt duurder. Google geeft zelf het voorbeeld dat van 99 naar 100 ongeveer evenveel verbetering vraagt als van 90 naar 94. Voor een glazenwasser is jagen op die laatste punten zelden de moeite waard. Van rood naar oranje of van oranje naar groen is waar het verschil zit.

## Waarom verschilt de score per meting?

Doe je de test twee keer achter elkaar, dan krijg je vaak een ander getal. Dat komt doordat de testomgeving niet elke keer precies gelijk is. Google noemt onder meer wisselende advertenties of testversies op de pagina, verschillen in het netwerk, en browserextensies of virusscanners als je zelf meet. Een paar punten verschil zegt dus niets. Een verschil van twintig punten na een aanpassing aan je site wel.

## Welke score is goed genoeg?

Er is geen getal dat je moet halen. Maar dit is een redelijke maatstaf voor de site van een servicebedrijf:

- **De Core Web Vitals-beoordeling bovenaan is geslaagd.** Dat betekent dat bij minstens driekwart van je echte bezoekers drie dingen goed zitten: de grootste inhoud staat binnen 2,5 seconde in beeld (LCP), de pagina reageert binnen 200 milliseconden op een tik (INP) en verspringt nauwelijks (CLS 0,1 of minder).
- **De prestatiescore op mobiel staat in het oranje of groen.** Rood op mobiel is een duidelijk signaal dat er iets zwaars op je pagina staat.
- **Toegankelijkheid en SEO hebben geen gefaalde controles die je zelf kunt oplossen**, zoals een ontbrekende beschrijving of te weinig contrast.

Zie je bovenaan geen beoordeling maar de melding dat er te weinig gegevens zijn? Dat is bij kleine sites heel gewoon. Google toont dan soms de cijfers van je hele site in plaats van die ene pagina, en anders alleen de testmeting. In Search Console vind je hetzelfde in het rapport Core Web Vitals, apart voor mobiel en desktop. Bij weinig verkeer staat daar "Geen gegevens beschikbaar".

## Zo lees je je rapport in vijf minuten

1. **Kies het tabblad mobiel** en meet je homepage en je belangrijkste dienstpagina, bijvoorbeeld die over ramen wassen of zonnepanelen.
2. **Kijk bovenaan of er echte bezoekersdata is.** Is de beoordeling geslaagd, dan is snelheid voor je klanten waarschijnlijk geen groot probleem, ook als de cirkel eronder oranje is.
3. **Lees de prestatiescore en meet nog een of twee keer.** Noteer het gemiddelde, niet het hoogste getal.
4. **Zoek de rode meetwaarde.** Kijk welke van de vijf het laagst scoort. TBT rood: scripts en plugins. LCP rood: de bovenste foto of slider. CLS rood: foto's of banners die later inladen.
5. **Open de verbeterpunten bij die meetwaarde.** Begin bij het bovenste punt met de grootste geschatte winst.
6. **Loop de gefaalde controles bij Toegankelijkheid en SEO na.** Een ontbrekende beschrijving of een knop zonder naam is vaak in een paar minuten opgelost.
7. **Meet opnieuw na elke aanpassing**, zodat je weet wat het heeft opgeleverd.

Welke oorzaken er meestal achter een rode meetwaarde zitten en wat je daar zelf aan doet, staat uitgewerkt in [waarom je website traag is op mobiel](/kennis/website-traag-op-mobiel).

## Wat de score niet zegt

Een PageSpeed-score meet één pagina, niet je hele site en niet je bedrijf. Hij zegt niets over of een klant snel je telefoonnummer vindt, of je werkgebied duidelijk is en of je foto's van echt werk laten zien. Een site met een 95 die niet zegt in welke plaatsen je werkt, levert minder aanvragen op dan een site met een 75 die dat wel doet. Waar een goede site voor glazenwassers verder aan moet voldoen, lees je bij [een website voor glazenwassers](/website-glazenwasser).

Ook voor Google is de score geen doel op zich. De ervaring van echte bezoekers telt mee in de zoekresultaten, maar een pagina die de vraag van de zoeker het best beantwoordt, gaat voor. Ook als je adverteert, speelt de ervaring op je pagina een rol; daar gaat het artikel over [wat SEO doet voor je Google Ads](/kennis/seo-en-google-ads) verder op in.

## Samengevat

Je PageSpeed-score is een testcijfer voor één pagina: groen is goed, oranje kan beter, rood is traag. Kijk eerst of je echte bezoekers een goede ervaring hebben, zoek dan welke meetwaarde punten kost en pak die aan. Wil je niet zelf door het rapport, doe dan de [gratis website-scan](/website-scan): die gebruikt dezelfde meting van Google en zet de belangrijkste verbeterpunten voor je homepage in gewone taal onder elkaar.
