#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

const enrichmentByUrl = {
  'https://www.arbeitsagentur.de/arbeitslosengeld-2': {
    summary: 'Bürgergeld ist eine Leistung der Grundsicherung für erwerbsfähige Menschen mit zu geringem Einkommen oder ohne Arbeit und deckt Regelbedarf sowie angemessene Wohnkosten ab.',
    content: 'Die Informationsseite der Bundesagentur für Arbeit erläutert Anspruch, Antrag und zentrale Rahmenbedingungen für Bürgergeld. Sie verweist auf Zuständigkeiten der Jobcenter und auf Pflichten sowie Mitwirkungsanforderungen im Leistungsbezug.'
  },
  'https://www.arbeitsagentur.de/kurzarbeitergeld': {
    summary: 'Kurzarbeitergeld unterstützt Betriebe und Beschäftigte bei vorübergehendem Arbeitsausfall, um Beschäftigung zu stabilisieren.',
    content: 'Die BA-Seite bündelt Voraussetzungen, Hinweise zur Beantragung und praktische Orientierung für die Umsetzung von Kurzarbeit. Sie ordnet die Leistung in den Kontext der Arbeitslosenversicherung und betrieblicher Krisenbewältigung ein.'
  },
  'https://www.arbeitsagentur.de/familie-und-kinder': {
    summary: 'Die Seite bietet einen zentralen Einstieg zu Kindergeld, Kinderzuschlag und weiteren Unterstützungsangeboten für Familien.',
    content: 'Sie enthält Schnellzugriffe auf eServices, Leistungsinformationen und weiterführende Hilfen für Eltern. Zusätzlich verweist sie auf regionale Familienkassen und ergänzende staatliche Unterstützungsangebote.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/themen/familie/familienleistungen': {
    summary: 'Das BMBFSFJ stellt zentrale Familienleistungen wie Elterngeld, Kindergeld, Kinderzuschlag und weitere Unterstützungen im Überblick dar.',
    content: 'Die Seite strukturiert bundesweite Familienleistungen und verlinkt auf vertiefende Informationen zu Anspruch, Zweck und Antrag. Damit dient sie als offizieller Orientierungspunkt für Familien in unterschiedlichen Lebenslagen.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/themen/familie/familienleistungen/kindergeld/kindergeld-73892': {
    summary: 'Kindergeld ist eine zentrale familienpolitische Leistung zur finanziellen Entlastung von Familien in Deutschland.',
    content: 'Die Ministeriumsseite ordnet das Kindergeld im Gesamtsystem der Familienleistungen ein und verweist auf weiterführende Informationen. Sie unterstützt die erste Orientierung zu Zweck, Anspruchsrahmen und Zuständigkeiten.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/themen/familie/familienleistungen/kinderzuschlag-und-leistungen-fuer-bildung-und-teilhabe-73906': {
    summary: 'Kinderzuschlag unterstützt Familien mit kleinerem Einkommen und kann durch Leistungen für Bildung und Teilhabe ergänzt werden.',
    content: 'Die Seite beschreibt den Kinderzuschlag als gezielte Ergänzung zur finanziellen Absicherung von Familien. Zusätzlich werden Zusammenhänge mit Bildungs- und Teilhabeleistungen für Kinder erläutert.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/themen/familie/familienleistungen/unterhaltsvorschuss/unterhaltsvorschuss-73558': {
    summary: 'Unterhaltsvorschuss hilft Kindern von Alleinerziehenden, wenn Unterhalt ausbleibt oder unregelmäßig gezahlt wird.',
    content: 'Die Informationsseite erklärt den Charakter der Leistung als verlässliche Unterstützung in Ausfallsituationen. Sie gibt einen offiziellen Einstieg in Anspruchskontext und Verfahrenslogik.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/themen/familie/familienleistungen/mutterschaftsleistungen/mutterschutz-und-mutterschaftsleistungen-73754': {
    summary: 'Mutterschutz und Mutterschaftsleistungen sichern Gesundheit, Beschäftigungsschutz und finanzielle Stabilität rund um die Geburt.',
    content: 'Die Seite beschreibt Schutzrechte im Arbeitsverhältnis und ordnet ergänzende Leistungen im Zeitraum vor und nach der Geburt ein. Sie dient als offizieller Überblick für Beschäftigte, Familien und Arbeitgeber.'
  },
  'https://www.arbeitsagentur.de/familie-und-kinder/informationen-zum-bildungspaket': {
    summary: 'Leistungen für Bildung und Teilhabe unterstützen Kinder und Jugendliche bei schulischen, kulturellen und sozialen Aktivitäten.',
    content: 'Die BA-Seite erklärt, wie Familien mit bestimmten Leistungsbezügen Zugang zum Bildungspaket erhalten. Sie verweist auf typische Förderbereiche und auf zuständige Stellen für die Umsetzung.'
  },
  'https://www.arbeitsagentur.de/familie-und-kinder/weitere-hilfen-fuer-eltern': {
    summary: 'Die Seite bündelt staatliche Unterstützungsangebote für Eltern über Kindergeld und Kinderzuschlag hinaus.',
    content: 'Sie dient als strukturierter Einstieg in ergänzende Hilfen und verweist auf offizielle Informations- und Beratungsangebote. Damit hilft sie Familien bei der Orientierung über verschiedene Zuständigkeiten hinweg.'
  },
  'https://www.arbeitsagentur.de/eservices': {
    summary: 'Die eServices der Bundesagentur ermöglichen digitale Antragstellung, Dokumentenübermittlung und Statusprozesse über ein Benutzerkonto.',
    content: 'Die Plattform deckt Anliegen zu Arbeitslosigkeit, Jobcenter-Leistungen, Familienkasse sowie Aus- und Weiterbildung ab. Sie reduziert Behördengänge und unterstützt standardisierte Online-Prozesse für Bürgerinnen und Bürger.'
  },
  'https://www.arbeitsagentur.de/jobsuche/': {
    summary: 'Die Jobsuche der BA bietet bundesweite Stellensuche mit Filtern nach Berufsfeld, Ort, Arbeitszeit und weiteren Kriterien.',
    content: 'Das Tool unterstützt sowohl schnelle Einstiege als auch detaillierte Suchstrategien. Es ist ein zentraler digitaler Zugang zu offenen Stellen im öffentlichen Vermittlungssystem.'
  },
  'https://www.familienportal.de/familienportal/rechner-antraege/elterngeldrechner': {
    summary: 'Der Elterngeldrechner im Familienportal ermöglicht eine unverbindliche Einschätzung des möglichen Elterngeldanspruchs.',
    content: 'Das Angebot führt strukturiert durch relevante Angaben und zeigt orientierende Ergebnisse für die persönliche Planung. Es unterstützt Familien bei der Vorbereitung auf einen späteren Antrag.'
  },
  'https://www.arbeitsagentur.de/familie-und-kinder/infos-rund-um-kindergeld/kindergeld-anspruch-hoehe-dauer/kindergeld-antrag-starten': {
    summary: 'Über den digitalen Startpunkt kann Kindergeld für neugeborene Kinder online beantragt werden.',
    content: 'Die Seite bietet einen direkten Zugang zum Antragsverfahren der Familienkasse und erleichtert den Einstieg in den Prozess. Damit wird die formale Antragstellung zeitnah und medienbrucharm unterstützt.'
  },
  'https://www.arbeitsagentur.de/familie-und-kinder/kinderzuschlag-verstehen/kiz-lotse': {
    summary: 'Der KiZ-Lotse hilft bei der Vorprüfung, ob ein Anspruch auf Kinderzuschlag bestehen könnte.',
    content: 'Das digitale Prüftool führt durch zentrale Kriterien und bietet eine erste Orientierung vor der eigentlichen Antragstellung. Es unterstützt Familien bei der schnellen Einschätzung ihrer Ausgangslage.'
  },
  'https://www.arbeitsagentur.de/ueber-uns': {
    summary: 'Die Organisationsseite der BA stellt Aufgaben, Struktur, Leitungsorgane und zentrale Dienststellen der Behörde vor.',
    content: 'Sie erläutert die Rolle der Bundesagentur im deutschen Arbeitsmarkt- und Leistungssystem sowie deren föderale Organisationslogik. Zusätzlich verweist sie auf spezialisierte Einrichtungen und weitere Servicebereiche.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj': {
    summary: 'Die Startseite des BMBFSFJ bündelt Themen, Programme, Serviceangebote und politische Schwerpunkte des Ministeriums.',
    content: 'Sie dient als zentraler Einstieg für Familien-, Jugend- und Gleichstellungsthemen sowie zugehörige Services. Nutzerinnen und Nutzer erhalten von dort aus Zugang zu Fachinformationen, Kontakt und Publikationen.'
  },
  'https://www.bundesregierung.de/breg-de/bundesregierung/bundesministerien': {
    summary: 'Die Bundesregierung stellt hier alle Bundesministerien mit Zuständigkeitsbereichen im Überblick dar.',
    content: 'Die Seite beschreibt die Rolle der Ministerien bei Gesetzgebung, Fachpolitik und Behördenaufsicht. Sie bietet einen offiziellen Einstieg in die Organisationsstruktur der Bundesverwaltung.'
  },
  'https://www.bmas.de/DE/Startseite/start.html': {
    summary: 'Die BMAS-Startseite bietet zentrale Informationen zu Arbeit, Soziales, Service und ministeriellen Themenfeldern.',
    content: 'Sie verknüpft fachpolitische Inhalte mit praktischen Zugängen wie Kontaktmöglichkeiten und Bürgerinformationen. Dadurch entsteht ein zentraler Einstieg in arbeits- und sozialpolitische Bundesangebote.'
  },
  'https://www.fitko.de/produktmanagement/115': {
    summary: 'Die FITKO-Seite beschreibt das Produktmanagement der Behördennummer 115 im föderalen Kontext.',
    content: 'Sie erklärt organisatorische Zuständigkeiten und die Weiterentwicklung der 115 als verwaltungsübergreifenden Service. Damit wird die Einordnung der 115 im digitalen Verwaltungsverbund transparent gemacht.'
  },
  'https://www.arbeitsagentur.de/service-bereich/so-erreichen-sie-uns': {
    summary: 'Die BA-Kontaktseite enthält Servicetelefone, Erreichbarkeiten und spezialisierte Ansprechpartner für unterschiedliche Anliegen.',
    content: 'Sie bietet Kontaktwege für Privatpersonen, Unternehmen und besondere Themenbereiche einschließlich Familienkasse. Damit ist sie ein zentraler Zugangspunkt für direkte Kommunikation mit der Bundesagentur.'
  },
  'https://www.bmbfsfj.bund.de/bmbfsfj/service/kontakt': {
    summary: 'Die Kontaktseite des BMBFSFJ bietet E-Mail, Postanschrift, Servicetelefon und ergänzende Hinweise zur Behördennummer 115.',
    content: 'Sie strukturiert die offiziellen Kommunikationskanäle des Ministeriums und verweist auf rechtliche Informationsrechte. Dadurch erhalten Bürgerinnen und Bürger klare Wege für Anfragen und Rückmeldungen.'
  },
  'https://www.115.de/': {
    summary: 'Die 115 ist die zentrale Behördenrufnummer für allgemeine Verwaltungsfragen von Bund, Ländern und Kommunen.',
    content: 'Die Seite erläutert Serviceversprechen, Erreichbarkeit und den Nutzen eines einheitlichen Zugangs zur Verwaltung. Sie unterstützt Bürgerinnen und Bürger bei der schnellen Orientierung in Verwaltungsanliegen.'
  },
  'https://www.bmas.de/DE/Service/Kontakt/kontakt.html': {
    summary: 'Die BMAS-Kontaktseite stellt Kontaktformular, Bürgertelefon und ergänzende Informationsangebote bereit.',
    content: 'Sie bietet konkrete Kontaktwege für Fragen an das Bundesministerium für Arbeit und Soziales und enthält Hinweise in Leichter Sprache. Damit wird der Zugang zu ministeriellen Auskünften strukturiert erleichtert.'
  },
  'https://www.gebaerdentelefon.de/115': {
    summary: 'Das Gebärdentelefon 115 erweitert den Zugang zur Behördennummer 115 um barrierearme Kommunikation für hörbeeinträchtigte Menschen.',
    content: 'Das Angebot ergänzt den regulären 115-Service um einen inklusiven Zugangskanal. Dadurch wird die Erreichbarkeit von Behördeninformationen für eine wichtige Zielgruppe verbessert.'
  }
};

const domainFiles = [
  'data/benefits/entries.json',
  'data/aid/entries.json',
  'data/tools/entries.json',
  'data/organizations/entries.json',
  'data/contacts/entries.json'
];

for (const relativePath of domainFiles) {
  const filePath = join(ROOT, relativePath);
  const payload = JSON.parse(readFileSync(filePath, 'utf-8'));
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  for (const entry of entries) {
    const enrichment = enrichmentByUrl[entry.url];
    if (!enrichment) {
      continue;
    }

    entry.summary = {
      ...(entry.summary || {}),
      de: enrichment.summary
    };

    entry.content = {
      ...(entry.content || {}),
      de: enrichment.content
    };
  }

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

console.log('Enriched summaries/content for real entries across all domains.');
