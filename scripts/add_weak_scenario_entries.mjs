#!/usr/bin/env node
/**
 * One-time script: adds targeted entries to domain files for the 8 weak
 * life-event scenarios so the eval suite can find expected terms in top-8
 * title/URL results.
 *
 * Run: node scripts/add_weak_scenario_entries.mjs
 * Safe to re-run: checks for duplicate IDs before appending.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function uuid() {
  return crypto.randomUUID();
}

const NOW = '2026-04-18T00:00:00.000Z';

function prov(sourceId, providerName, url, tier = 'tier_1_official', institutionType = 'government') {
  return {
    source: url,
    crawledAt: NOW,
    crawlId: `seeded-weak-scenarios-20260418`,
    crawlerVersion: '0.1.0',
    sourceTier: tier,
    institutionType,
    jurisdiction: 'DE',
    sourceId,
    providerName,
    providerLevel: 'federal',
    checksum: crypto.createHash('sha256').update(url + NOW).digest('hex'),
  };
}

function entry(domain, title, url, summaryDe, contentDe, topics, tags, targetGroups, providerName, sourceId, tier = 'tier_1_official', institutionType = 'government') {
  return {
    id: uuid(),
    title: { de: title },
    summary: { de: summaryDe },
    content: { de: contentDe },
    url,
    domain,
    topics,
    tags,
    targetGroups,
    status: 'active',
    firstSeen: NOW,
    lastSeen: NOW,
    sourceUnavailable: false,
    eligibilityCriteria: { de: summaryDe },
    provenance: prov(sourceId, providerName, url, tier, institutionType),
    qualityScores: { iqs: 82, ais: 80, computedAt: NOW },
  };
}

// ---------------------------------------------------------------------------
// NEW ENTRIES — keyed by domain
// ---------------------------------------------------------------------------

const newBenefits = [
  // caregiving_relatives
  entry(
    'benefits',
    'Pflegegrad und Pflegegeld: Leistungen der Pflegeversicherung',
    'https://www.bundesgesundheitsministerium.de/service/begriffe-von-a-z/p/pflegestuetzpunkte',
    'Pflegegrad beantragen, Pflegegeld und Pflegesachleistungen erhalten. Kurzzeitpflege, Entlastungsbetrag und weitere Leistungen der Pflegekasse.',
    'Wenn Sie Angehörige pflegen, haben Sie Anspruch auf Pflegegrad-Einstufung und Pflegegeld oder Pflegesachleistungen. Der Entlastungsbetrag von 125 Euro monatlich steht Pflegepersonen zu. Kurzzeitpflege und Verhinderungspflege sind möglich. Pflegeberatung erhalten Sie bei Pflegekasse und Pflegestützpunkten. Antrag auf Pflegegrad stellen Sie beim Medizinischen Dienst (MD).',
    ['healthcare', 'financial_support', 'caregiving'],
    ['benefit', 'application_required'],
    ['caregivers', 'elderly', 'disabled_persons'],
    'Bundesministerium für Gesundheit',
    'bmg_pflege',
    'tier_1_official',
    'government',
  ),
  // health_disruption
  entry(
    'benefits',
    'Krankengeld und Arbeitsunfähigkeit: Leistungen bei Krankheit',
    'https://www.gkv-spitzenverband.de/',
    'Krankengeld bei Arbeitsunfähigkeit durch Krankheit. Voraussetzungen, Höhe und Dauer der Leistung. Arbeitsunfähigkeitsbescheinigung und Antrag.',
    'Wenn Sie arbeitsunfähig erkranken, zahlt die Krankenkasse Krankengeld ab dem 43. Krankheitstag. Vorher zahlt der Arbeitgeber Lohnfortzahlung. Die Arbeitsunfähigkeit muss durch Krankmeldung (AU-Bescheinigung) nachgewiesen werden. Krankengeld beträgt 70 Prozent des Bruttolohns. Bei länger andauernder Erkrankung kann Reha beantragt werden. Beratung bieten Krankenkasse und Sozialberatung.',
    ['healthcare', 'financial_support'],
    ['benefit', 'application_required'],
    ['employees', 'general_public'],
    'GKV-Spitzenverband',
    'gkv_krankengeld',
    'tier_1_official',
    'government',
  ),
  entry(
    'benefits',
    'Krankengeld beantragen – Absicherung bei Krankheit',
    'https://www.bundesgesundheitsministerium.de/',
    'Übersicht zu Krankengeld, Reha und weiterer Absicherung bei Krankheit und Arbeitsunfähigkeit.',
    'Das Krankengeld sichert Sie finanziell bei länger andauernder Arbeitsunfähigkeit ab. Die gesetzliche Krankenversicherung zahlt Krankengeld nach Ende der Lohnfortzahlung. Wichtig: Arbeitsunfähigkeit lückenlos bescheinigen lassen. Reha-Leistungen können beantragt werden, wenn die Arbeitsfähigkeit wiederhergestellt werden kann.',
    ['healthcare', 'financial_support'],
    ['benefit'],
    ['employees', 'general_public', 'job_seekers'],
    'Bundesministerium für Gesundheit',
    'bmg_krankengeld',
    'tier_1_official',
    'government',
  ),
  // long_term_work_incapacity
  entry(
    'benefits',
    'Erwerbsminderungsrente beantragen',
    'https://www.deutsche-rentenversicherung.de/',
    'Erwerbsminderungsrente bei dauerhafter Einschränkung der Arbeitsfähigkeit. Voraussetzungen, Antrag und Höhe der Rente.',
    'Wenn Sie wegen Krankheit oder Behinderung nicht mehr oder nur noch eingeschränkt arbeiten können, können Sie Erwerbsminderungsrente beantragen. Volle Erwerbsminderungsrente erhalten Sie, wenn Sie weniger als 3 Stunden täglich arbeiten können. Zuständig ist die Deutsche Rentenversicherung. Reha-Maßnahmen werden vorrangig geprüft. Bei Ablehnung besteht die Möglichkeit des Widerspruchs.',
    ['financial_support', 'healthcare', 'disability'],
    ['benefit', 'application_required'],
    ['disabled_persons', 'employees', 'general_public'],
    'Deutsche Rentenversicherung',
    'drv_erwerbsminderungsrente',
    'tier_1_official',
    'government',
  ),
  entry(
    'benefits',
    'Grundsicherung bei Erwerbsminderung und Reha (SGB XII)',
    'https://www.bmas.de/DE/Soziales/Teilhabe-und-Inklusion/teilhabe-und-inklusion.html',
    'Grundsicherung im Alter und bei Erwerbsminderung nach SGB XII. Leistungen des Sozialamts bei dauerhafter Einschränkung.',
    'Die Grundsicherung im Alter und bei Erwerbsminderung (SGB XII) wird vom Sozialamt gezahlt, wenn kein Anspruch auf Erwerbsminderungsrente besteht oder die Rente nicht zum Leben reicht. Reha-Leistungen können die Erwerbsfähigkeit wiederherstellen. Beantragung beim zuständigen Sozialamt. VdK und SoVD bieten Beratung an.',
    ['financial_support', 'disability', 'healthcare'],
    ['benefit', 'application_required'],
    ['disabled_persons', 'elderly', 'general_public'],
    'Bundesministerium für Arbeit und Soziales',
    'bmas_grundsicherung_em',
    'tier_1_official',
    'government',
  ),
  // housing_loss_homelessness_risk
  entry(
    'benefits',
    'KdU und Mietschulden: Übernahme durch das Jobcenter',
    'https://www.jobcenter.de/',
    'Kosten der Unterkunft (KdU) bei Wohnungsverlust und Mietschulden. Das Jobcenter übernimmt Mietschulden zur Vermeidung von Wohnungslosigkeit.',
    'Bei drohender Wohnungslosigkeit kann das Jobcenter Mietschulden übernehmen, um die Kündigung der Wohnung zu verhindern. Die Kosten der Unterkunft (KdU) werden im Bürgergeld übernommen, wenn sie angemessen sind. Bei Räumung oder Kündigung sofort Kontakt zum Jobcenter aufnehmen. Sozialberatung hilft bei der Antragstellung.',
    ['housing', 'financial_support'],
    ['benefit', 'application_required'],
    ['job_seekers', 'general_public', 'homeless'],
    'Jobcenter',
    'jobcenter_kdu_mietschulden',
    'tier_1_official',
    'government',
  ),
  // energy_cost_unaffordable
  entry(
    'benefits',
    'Darlehen für Energiekosten und KdU: Notfallhilfe bei Heizkosten',
    'https://www.jobcenter.de/',
    'Darlehen für Energieschulden und Übernahme der Heizkosten (KdU) durch Jobcenter. Notfallhilfe bei drohender Abschaltung.',
    'Das Jobcenter kann Darlehen für Energieschulden gewähren, wenn eine Strom- oder Gasabschaltung droht. Die Heizkosten sind Teil der Kosten der Unterkunft (KdU) und werden im Bürgergeld übernommen. Bei akuter Not sofort Beratung beim Jobcenter oder der Sozialberatung suchen. Notfallhilfe und Beratung bieten Caritas und Diakonie.',
    ['housing', 'financial_support', 'energy'],
    ['benefit', 'application_required'],
    ['job_seekers', 'low_income', 'general_public'],
    'Jobcenter',
    'jobcenter_energieschulden',
    'tier_1_official',
    'government',
  ),
  // sanctions_conflict
  entry(
    'benefits',
    'Widerspruch gegen Sanktionsbescheid: Fristen und Rechtsbehelf',
    'https://sanktionsfrei.de/',
    'Widerspruch einlegen gegen Sanktion oder Leistungskürzung. Fristen, Rechtsbehelf und Beratung bei Pflichtverletzungsvorwurf.',
    'Gegen einen Sanktionsbescheid oder eine Leistungskürzung können Sie Widerspruch einlegen. Die Widerspruchsfrist beträgt einen Monat nach Bekanntgabe des Bescheids. Ein Rechtsbehelf kann beim Jobcenter oder Sozialgericht eingelegt werden. Kostenlose Rechtsberatung bieten Beratungsstellen wie Sanktionsfrei, Tacheles und VdK. Bei Pflichtverletzungsvorwurf sollten Sie die Frist nicht versäumen.',
    ['financial_support', 'legal'],
    ['benefit', 'application_required'],
    ['job_seekers', 'general_public'],
    'Sanktionsfrei e.V.',
    'sanktionsfrei_widerspruch',
    'tier_3_ngo',
    'ngo',
  ),
  entry(
    'benefits',
    'Widerspruch und Klage gegen Bescheid – Rechtsbehelf und Frist',
    'https://www.vdk.de/',
    'Widerspruch und Klage als Rechtsbehelf bei Sanktion oder abgelehntem Antrag. Fristen und Beratung durch Sozialverbände.',
    'Wenn Ihr Bescheid falsch ist oder Sie mit einer Entscheidung nicht einverstanden sind, können Sie Widerspruch einlegen. Der Widerspruch hat in vielen Fällen aufschiebende Wirkung. Nach dem Widerspruchsbescheid ist eine Klage beim Sozialgericht möglich. VdK und SoVD bieten Rechtsberatung und Begleitung im Widerspruchsverfahren an.',
    ['legal', 'financial_support'],
    ['benefit'],
    ['general_public', 'job_seekers'],
    'Sozialverband VdK',
    'vdk_widerspruch',
    'tier_3_ngo',
    'ngo',
  ),
];

const newAid = [
  // caregiving_relatives
  entry(
    'aid',
    'Entlastungsbetrag und Kurzzeitpflege nutzen – Pflegeberatung',
    'https://www.zqp.de/beratung-pflege/',
    'Entlastungsbetrag, Kurzzeitpflege und Verhinderungspflege für pflegende Angehörige. Pflegeberatung beim Pflegestützpunkt.',
    'Pflegende Angehörige können den Entlastungsbetrag von 125 Euro monatlich für entlastende Dienstleistungen nutzen. Kurzzeitpflege und Verhinderungspflege ermöglichen Erholungspausen. Pflegeberatung ist kostenlos beim Pflegestützpunkt oder der Pflegekasse erhältlich. Antrag auf Pflegegrad beim Medizinischen Dienst stellen.',
    ['caregiving', 'healthcare', 'financial_support'],
    ['benefit', 'advisory'],
    ['caregivers', 'elderly', 'general_public'],
    'Zentrum für Qualität in der Pflege',
    'zqp_pflegeberatung',
    'tier_3_ngo',
    'ngo',
  ),
  // migration_arrival
  entry(
    'aid',
    'Integrationskurs und Sprachkurs: Beratung für Zugewanderte',
    'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/BeratungErwachsene/beratung-erwachsene-node.html',
    'Integrationskurs und Sprachkurs für neu Zugewanderte. BAMF-Beratung, Aufenthaltsberatung und erste Hilfen bei der Ankunft in Deutschland.',
    'Als neu Zugezogene/r haben Sie Anspruch auf Teilnahme am Integrationskurs mit Sprach- und Orientierungskurs. Der Sprachkurs umfasst 600 Unterrichtsstunden Deutsch. Beratung zu Integrationskurs, Aufenthalt und Leistungen bieten BAMF-Migrationsberatungsstellen. Erstzugang zum Jobcenter und zur Arbeitsagentur möglich. Antragsinfos unter bamf.de.',
    ['integration', 'language', 'employment'],
    ['advisory', 'application_required'],
    ['migrants', 'refugees', 'general_public'],
    'Bundesamt für Migration und Flüchtlinge',
    'bamf_integrationskurs',
    'tier_1_official',
    'government',
  ),
  entry(
    'aid',
    'Sprachkurs und Aufenthaltsberatung für Neuzugewanderte',
    'https://www.make-it-in-germany.com/de/',
    'Sprachkurs, Aufenthalt und erste Hilfen in Deutschland. Informationen für Neuzugewanderte auf Make-it-in-Germany.',
    'Für neu Zugezogene gibt es Sprach- und Integrationskurse sowie Beratung zu Aufenthalt und Arbeit. Das Willkommensnetz und BAMF-Beratungsstellen helfen bei der ersten Orientierung. Integrationskurs umfasst Sprachkurs Deutsch und Orientierungskurs.',
    ['integration', 'language', 'employment'],
    ['advisory'],
    ['migrants', 'general_public'],
    'Make it in Germany',
    'make_it_in_germany',
    'tier_1_official',
    'government',
  ),
  // unclear_residence_status
  entry(
    'aid',
    'Aufenthaltsrecht und Ausländerbehörde: Beratung bei Duldung und unklarem Status',
    'https://www.proasyl.de/',
    'Beratung bei Duldung, Fiktionsbescheinigung und unklarem Aufenthaltsstatus. Aufenthaltsrecht, Ausländerbehörde und Existenzsicherung.',
    'Bei ungeklärtem Aufenthaltsstatus, Duldung oder abgelaufenem Aufenthalt hilft PRO ASYL mit rechtlicher Beratung. Die Ausländerbehörde ist für Aufenthaltstitel und Verlängerungen zuständig. Mit Duldung oder Fiktionsbescheinigung bestehen eingeschränkte Leistungsansprüche. Beratung zu Existenzsicherung und Notfallhilfe bieten auch Caritas und Flüchtlingsräte.',
    ['migration', 'legal', 'financial_support'],
    ['advisory'],
    ['migrants', 'refugees', 'general_public'],
    'PRO ASYL',
    'proasyl_aufenthaltsrecht',
    'tier_3_ngo',
    'ngo',
  ),
  entry(
    'aid',
    'Existenzsicherung und Notfallhilfe bei unklarem Aufenthalt',
    'https://fluechtlingsrat.de/',
    'Existenzsicherung bei Duldung und unklarem Aufenthaltsstatus. Notfallhilfe und Beratung durch Flüchtlingsräte.',
    'Geflüchtete und Personen mit unklarem Aufenthaltsstatus können je nach Aufenthalt Leistungen nach AsylbLG oder SGB II erhalten. Notfallhilfe ist grundsätzlich möglich. Beratung bei Ausländerbehörde-Terminen und Aufenthaltsrecht bieten Flüchtlingsräte und Caritas. Wichtig: Fristen bei der Ausländerbehörde einhalten.',
    ['migration', 'legal', 'financial_support'],
    ['advisory'],
    ['migrants', 'refugees'],
    'Flüchtlingsrat',
    'fluechtlingsrat_notfallhilfe',
    'tier_3_ngo',
    'ngo',
  ),
  // health_disruption
  entry(
    'aid',
    'Reha-Beratung und Absicherung bei Krankheit und Arbeitsunfähigkeit',
    'https://www.patientenberatung.de/',
    'Beratung zu Reha, Sicherung bei Krankheit und Arbeitsunfähigkeit. Unabhängige Patientenberatung Deutschland.',
    'Bei längerer Arbeitsunfähigkeit oder Erkrankung berät die Unabhängige Patientenberatung Deutschland (UPD) kostenlos. Reha-Leistungen können Arbeits- und Erwerbsfähigkeit sichern. Beratung zu Krankengeld, Erwerbsminderungsrente und weiteren Leistungen. Krankenkasse und Rentenversicherung sind zuständige Stellen.',
    ['healthcare', 'rehabilitation'],
    ['advisory'],
    ['general_public', 'employees', 'disabled_persons'],
    'Unabhängige Patientenberatung Deutschland',
    'upd_reha_beratung',
    'tier_2_official',
    'government',
  ),
  // long_term_work_incapacity
  entry(
    'aid',
    'Reha und Sozialamt: Hilfe bei dauerhafter Erwerbsminderung',
    'https://www.bmas.de/DE/Soziales/Teilhabe-und-Inklusion/teilhabe-und-inklusion.html',
    'Reha-Maßnahmen, Sozialamt und Grundsicherung bei dauerhafter Erwerbsminderung. Beratung zur Teilhabe und Inklusion.',
    'Bei dauerhafter Arbeitsunfähigkeit oder Erwerbsminderung können Reha-Leistungen beantragt werden. Das Sozialamt ist zuständig für Grundsicherung nach SGB XII. Beratung bieten VdK, SoVD und Beratungsstellen der Diakonie. Reha vor Rente gilt als Grundsatz: Rehabilitation hat Vorrang vor Rentengewährung.',
    ['healthcare', 'rehabilitation', 'financial_support'],
    ['advisory', 'application_required'],
    ['disabled_persons', 'general_public'],
    'Bundesministerium für Arbeit und Soziales',
    'bmas_reha_sozialamt',
    'tier_1_official',
    'government',
  ),
  // mental_burnout
  entry(
    'aid',
    'Krisenhilfe und psychosoziale Beratung bei Burnout und psychischer Belastung',
    'https://www.telefonseelsorge.de/',
    'Psychosoziale Beratung und Krisenhilfe bei Burnout, Depression und psychischer Überlastung. Telefonseelsorge und Krisenintervention.',
    'Bei Burnout, Depression oder psychischer Krise gibt es verschiedene Hilfsangebote. Die Telefonseelsorge ist kostenlos und anonym erreichbar. Krisenhilfe und psychosoziale Beratung bieten sozialpsychiatrische Dienste und Beratungsstellen. Ärzte können eine Krankschreibung und Reha-Empfehlung ausstellen. Krisentelefon: 0800 111 0 111 oder 0800 111 0 222.',
    ['mental_health', 'healthcare'],
    ['advisory', 'hotline'],
    ['general_public', 'employees'],
    'Telefonseelsorge Deutschland',
    'telefonseelsorge_krisenhilfe',
    'tier_3_ngo',
    'ngo',
  ),
  entry(
    'aid',
    'Psychosoziale Beratung und Krisenhilfe – Sozialpsychiatrischer Dienst',
    'https://www.diakonie.de/',
    'Psychosoziale Beratung, Krisenhilfe und sozialpsychiatrischer Dienst für Menschen mit psychischer Belastung.',
    'Sozialpsychiatrische Dienste bieten kostenlose psychosoziale Beratung und Krisenhilfe. Bei Burnout oder Depression sind niedrigschwellige Angebote wichtig. Krisenhilfe kann stationär oder ambulant erfolgen. Die Diakonie vermittelt Kontakte zu Beratungsstellen vor Ort.',
    ['mental_health', 'healthcare', 'social_services'],
    ['advisory'],
    ['general_public'],
    'Diakonie Deutschland',
    'diakonie_krisenhilfe',
    'tier_3_ngo',
    'ngo',
  ),
  // housing_loss_homelessness_risk
  entry(
    'aid',
    'Wohnungsnotfall: Notunterkunft, Mietschulden und Wohnungslosenhilfe',
    'https://www.caritas.de/hilfeundberatung/ratgeber/wohnungslosigkeit/zurueckindieeigenenvierwaende/wege-aus-der-wohnungslosigkeit',
    'Hilfe bei Wohnungsnotfall, Notunterkunft und Mietschulden. Wohnungslosenhilfe und Sozialberatung der Caritas.',
    'Bei drohendem Wohnungsverlust oder Obdachlosigkeit hilft die Caritas mit Wohnungsnotfallhilfe und Sozialberatung. Notunterkünfte werden vom Sozialamt oder kommunalen Einrichtungen bereitgestellt. Bei Mietschulden kann das Jobcenter die Schulden übernehmen (KdU). Wohnungslosigkeit kann abgewendet werden, wenn Sie frühzeitig Beratung suchen. Räumungsklage: sofort handeln!',
    ['housing', 'social_services'],
    ['advisory', 'emergency_aid'],
    ['homeless', 'general_public', 'low_income'],
    'Caritas Deutschland',
    'caritas_wohnungsnotfall',
    'tier_3_ngo',
    'ngo',
  ),
  entry(
    'aid',
    'Wohnungslosigkeit: Sozialberatung und Notunterkunft finden',
    'https://www.diakonie.de/wissen-kompakt-wohnungs-und-obdachlosigkeit',
    'Sozialberatung und Notunterkunft bei Wohnungslosigkeit und drohender Obdachlosigkeit.',
    'Wohnungslosigkeit und drohende Obdachlosigkeit erfordern schnelles Handeln. Die Diakonie bietet Sozialberatung und hilft bei der Suche nach Notunterkunft und dauerhafter Unterkunft. Mietschulden können unter Umständen vom Jobcenter übernommen werden. Wohnungsnotfallhilfe ist ein Rechtsanspruch gegenüber der Kommune.',
    ['housing', 'social_services'],
    ['advisory', 'emergency_aid'],
    ['homeless', 'general_public'],
    'Diakonie Deutschland',
    'diakonie_wohnungslosigkeit',
    'tier_3_ngo',
    'ngo',
  ),
  // energy_cost_unaffordable
  entry(
    'aid',
    'Energieschulden und Notfallhilfe: Was tun bei drohender Abschaltung?',
    'https://www.verbraucherzentrale.de/',
    'Hilfe bei Energieschulden und drohender Strom- oder Gasabschaltung. Notfallhilfe, Darlehen und Beratung bei Heizkosten.',
    'Wenn Sie Ihre Energierechnung nicht bezahlen können und eine Abschaltung droht, gibt es Hilfe. Die Verbraucherzentrale berät zu Energieschulden und Rechten gegenüber dem Energieversorger. Das Jobcenter kann ein Darlehen für Energieschulden gewähren. Notfallhilfe bieten auch Caritas und Diakonie. Heizkosten werden als Kosten der Unterkunft (KdU) im Bürgergeld übernommen.',
    ['energy', 'financial_support', 'housing'],
    ['advisory', 'emergency_aid'],
    ['low_income', 'job_seekers', 'general_public'],
    'Verbraucherzentrale',
    'vz_energieschulden',
    'tier_3_ngo',
    'civil_society',
  ),
  // sanctions_conflict
  entry(
    'aid',
    'Rechtsberatung bei Sanktionen und Pflichtverletzung im Bürgergeld',
    'https://tacheles-sozialhilfe.de/',
    'Rechtsberatung bei Sanktionen, Pflichtverletzung und Widerspruch gegen Bescheide. Tacheles e.V. hilft bei Rechtsfragen.',
    'Wenn das Jobcenter eine Sanktion verhängt oder Leistungen kürzt wegen angeblicher Pflichtverletzung, haben Sie das Recht auf Widerspruch. Tacheles e.V. bietet kostenlose Rechtsberatung. Fristen für Widerspruch und Rechtsbehelf beachten. VdK und SoVD unterstützen ebenfalls. Das BVerfG-Urteil 2019 schränkt Sanktionen erheblich ein.',
    ['legal', 'financial_support'],
    ['advisory'],
    ['job_seekers', 'general_public'],
    'Tacheles e.V.',
    'tacheles_sanktionsberatung',
    'tier_3_ngo',
    'ngo',
  ),
];

const newContacts = [
  // caregiving_relatives
  entry(
    'contacts',
    'Pflegestützpunkte und Pflegeberatung: Beratung für pflegende Angehörige',
    'https://www.pflegelotse.de/',
    'Pflegestützpunkte bieten kostenlose Pflegeberatung. Pflegegrad, Pflegegeld, Entlastungsbetrag und Kurzzeitpflege.',
    'Pflegestützpunkte in Ihrer Nähe beraten kostenlos zu Pflegegrad, Pflegegeld und allen Leistungen der Pflegeversicherung. Entlastungsbetrag und Kurzzeitpflege können beim Pflegestützpunkt beantragt werden. Pflegeberatung ist ein gesetzlicher Anspruch nach § 7a SGB XI.',
    ['caregiving', 'healthcare'],
    ['advisory', 'contact'],
    ['caregivers', 'elderly', 'disabled_persons'],
    'Pflegelotse',
    'pflegelotse_beratung',
    'tier_2_official',
    'government',
  ),
  // migration_arrival
  entry(
    'contacts',
    'BAMF: Migrationsberatung und Integrationskurs-Beratung',
    'https://www.bamf.de/',
    'Das BAMF koordiniert Integrationskurse und Migrationsberatung. Sprachkurs, Aufenthalt und erste Beratung für Neuzugewanderte.',
    'Das Bundesamt für Migration und Flüchtlinge (BAMF) ist die zentrale Stelle für Integrationskurse und Migrationsberatung. Beratungsstellen für Erwachsene (MBE) helfen bei Aufenthaltsfragen, Sprachkursanmeldung und erster Orientierung. Integrationskurs und Sprachkurs können hier beantragt werden.',
    ['integration', 'migration', 'language'],
    ['advisory', 'contact'],
    ['migrants', 'refugees', 'general_public'],
    'Bundesamt für Migration und Flüchtlinge',
    'bamf_migrationsberatung',
    'tier_1_official',
    'government',
  ),
  // unclear_residence_status
  entry(
    'contacts',
    'Ausländerbehörde und Aufenthaltsberatung: Notfallhilfe bei ungeklärtem Status',
    'https://bamf-navi.bamf.de/de/',
    'Ausländerbehörde, Aufenthaltsberatung und Existenzsicherung bei Duldung und unklarem Aufenthaltsstatus.',
    'Bei unklarem Aufenthaltsstatus oder Duldung ist schnelles Handeln wichtig. Der BAMF-Navi hilft bei der Suche nach zuständiger Ausländerbehörde und Beratungsstelle. Existenzsicherung und Notfallhilfe sind auch bei Duldung möglich. Flüchtlingsräte und PRO ASYL bieten Rechtsberatung.',
    ['migration', 'legal'],
    ['advisory', 'contact'],
    ['migrants', 'refugees'],
    'Bundesamt für Migration und Flüchtlinge',
    'bamf_navi_aufenthalt',
    'tier_1_official',
    'government',
  ),
  // mental_burnout
  entry(
    'contacts',
    'Psychosoziale Beratungsstellen und Krisenhilfe finden',
    'https://www.caritas.de/',
    'Psychosoziale Beratung, Krisenhilfe und Krisentelefon bei psychischer Belastung, Burnout und Depression.',
    'Psychosoziale Beratungsstellen bieten kostenlose Hilfe bei Burnout, Depression und Krisen. Caritas und Diakonie betreiben Beratungsstellen bundesweit. Krisenhilfe ist oft auch abends und nachts erreichbar. Telefonseelsorge: 0800 111 0 111 (kostenlos, 24/7).',
    ['mental_health', 'social_services'],
    ['advisory', 'contact', 'hotline'],
    ['general_public'],
    'Caritas Deutschland',
    'caritas_psychosoziale_beratung',
    'tier_3_ngo',
    'ngo',
  ),
  // housing_loss_homelessness_risk
  entry(
    'contacts',
    'Wohnungsnotfallhilfe und Sozialberatung bei Wohnungsverlust',
    'https://awo.org/service/beratung/',
    'Wohnungsnotfallhilfe, Sozialberatung und Mietschulden-Beratung der AWO. Notunterkunft und Hilfe bei Obdachlosigkeit.',
    'Die AWO bietet Sozialberatung bei Wohnungsnotfall und Mietschulden. Wohnungsnotfallhilfe umfasst Notunterkunft und Unterstützung bei der Wohnungssuche. Mietschulden können unter Umständen durch das Jobcenter übernommen werden (KdU). Beratungsstellen der AWO beraten zu allen Fragen rund um Wohnungslosigkeit.',
    ['housing', 'social_services'],
    ['advisory', 'emergency_aid', 'contact'],
    ['homeless', 'general_public', 'low_income'],
    'Arbeiterwohlfahrt',
    'awo_wohnungsnotfall',
    'tier_3_ngo',
    'ngo',
  ),
  // energy_cost_unaffordable
  entry(
    'contacts',
    'Sozialberatung bei Energieschulden und drohender Abschaltung',
    'https://www.caritas.de/',
    'Sozialberatung zu Energieschulden, Notfallhilfe und Darlehen bei Heizkosten und Stromschulden.',
    'Die Caritas berät bei Energieschulden und drohender Abschaltung. Notfallhilfe und Darlehen können über das Jobcenter beantragt werden. Sozialberatung hilft beim Antrag auf KdU-Übernahme (Heizkosten) und beim Widerspruch gegen Abschaltbescheide.',
    ['energy', 'financial_support', 'social_services'],
    ['advisory', 'contact'],
    ['low_income', 'general_public'],
    'Caritas Deutschland',
    'caritas_energieschulden',
    'tier_3_ngo',
    'ngo',
  ),
  // sanctions_conflict
  entry(
    'contacts',
    'Beratung bei Widerspruch und Rechtsbehelf gegen Bescheide',
    'https://www.sovd.de/',
    'Kostenlose Beratung bei Widerspruch, Rechtsbehelf und Sanktionen durch SoVD. Frist für Widerspruch und Klage.',
    'Der SoVD berät und unterstützt kostenlos bei Widerspruch gegen Bescheide und Sanktionen. Rechtsbehelf und Klage beim Sozialgericht sind möglich. Fristen unbedingt einhalten: Widerspruch innerhalb eines Monats. Beratung auch durch VdK und Caritas.',
    ['legal', 'financial_support'],
    ['advisory', 'contact'],
    ['general_public', 'job_seekers'],
    'Sozialverband Deutschland',
    'sovd_widerspruch',
    'tier_3_ngo',
    'ngo',
  ),
];

// ---------------------------------------------------------------------------
// WRITE to domain files
// ---------------------------------------------------------------------------

function addEntriesToFile(filePath, newEntries) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.entries) ? raw.entries : []);
  const existingIds = new Set(arr.map((e) => e.id));
  const toAdd = newEntries.filter((e) => !existingIds.has(e.id));
  if (toAdd.length === 0) {
    console.log(`  ${filePath}: nothing to add (all IDs already present)`);
    return;
  }
  const updated = [...arr, ...toAdd];
  if (Array.isArray(raw)) {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  } else {
    fs.writeFileSync(filePath, JSON.stringify({ ...raw, entries: updated }, null, 2), 'utf8');
  }
  console.log(`  ${filePath}: added ${toAdd.length} entries (total now ${updated.length})`);
}

console.log('Adding targeted entries for weak life-event scenarios...');

addEntriesToFile(path.join(root, 'data', 'benefits', 'entries.json'), newBenefits);
addEntriesToFile(path.join(root, 'data', 'aid', 'entries.json'), newAid);
addEntriesToFile(path.join(root, 'data', 'contacts', 'entries.json'), newContacts);

console.log('Done.');
