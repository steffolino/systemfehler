export type GlossaryLocale = 'de' | 'en';

export type GlossaryTermId =
  | 'ai_guided_search'
  | 'article_search'
  | 'life_event_context'
  | 'direct_search'
  | 'hybrid_search'
  | 'official_only_sources'
  | 'helpful_answer'
  | 'evidence_entries'
  | 'search_focus'
  | 'matched_topic_profiles'
  | 'technical_details'
  | 'answer_service'
  | 'provider'
  | 'bot_protection'
  | 'retrieval_mode'
  | 'official_filter'
  | 'external_retrieval'
  | 'editorial_review'
  | 'review_notes'
  | 'weak_evidence'
  | 'official_baseline'
  | 'assistive_support'
  | 'direct_contacts'
  | 'language_source'
  | 'source_role'
  | 'source_tier'
  | 'institution_type'
  | 'jurisdiction'
  | 'content_domain';

export type GlossaryTerm = {
  id: GlossaryTermId;
  title: Record<GlossaryLocale, string>;
  short: Record<GlossaryLocale, string>;
  body: Record<GlossaryLocale, string>;
};

export const glossaryTerms: Record<GlossaryTermId, GlossaryTerm> = {
  ai_guided_search: {
    id: 'ai_guided_search',
    title: { de: 'Begleitete Suche', en: 'Guided search' },
    short: {
      de: 'Eine Frage-Antwort-Suche, die passende Belege sucht und daraus Orientierung formuliert.',
      en: 'A question-answer search that retrieves matching evidence and turns it into orientation.',
    },
    body: {
      de: 'Die begleitete Suche ist für offene Fragen gedacht. Sie sucht zuerst passende Einträge, erstellt daraus eine Antwort und zeigt, welche Belege dahinterstehen.',
      en: 'Guided search is for open questions. It first retrieves matching entries, then creates an answer and shows the evidence behind it.',
    },
  },
  article_search: {
    id: 'article_search',
    title: { de: 'Artikel-Suche', en: 'Article search' },
    short: {
      de: 'Eine klassische Suche direkt in den gespeicherten Einträgen.',
      en: 'A classic search directly across stored entries.',
    },
    body: {
      de: 'Die Artikel-Suche ist sinnvoll, wenn du schon ein Stichwort, eine Leistung, eine Stelle oder einen konkreten Eintrag suchst.',
      en: 'Article search is useful when you already know a keyword, benefit, institution, or concrete entry you want to find.',
    },
  },
  life_event_context: {
    id: 'life_event_context',
    title: { de: 'Lebenssituation', en: 'Life event context' },
    short: {
      de: 'Ein optionaler Kontext, der die Suche auf typische Fragen in einer Lebenslage ausrichtet.',
      en: 'Optional context that steers retrieval toward common questions in a situation.',
    },
    body: {
      de: 'Lebenssituationen sind kuratierte Routen wie Arbeitslosigkeit, Familie oder Schulden. Sie helfen dem System, relevante Quellen und Beispiel-Fragen besser zu priorisieren.',
      en: 'Life events are curated routes such as unemployment, family, or debt. They help the system prioritize relevant sources and starter questions.',
    },
  },
  direct_search: {
    id: 'direct_search',
    title: { de: 'Direkte Suche', en: 'Direct retrieval' },
    short: {
      de: 'Sucht enger an den eingegebenen Wörtern entlang.',
      en: 'Searches more closely around the words entered.',
    },
    body: {
      de: 'Direkte Suche bevorzugt Treffer, die sprachlich nah an deiner Frage liegen. Das ist gut für konkrete Begriffe, aber weniger flexibel bei Umschreibungen.',
      en: 'Direct retrieval favors entries that are textually close to your question. It is good for concrete terms, but less flexible with paraphrases.',
    },
  },
  hybrid_search: {
    id: 'hybrid_search',
    title: { de: 'Hybrid-Suche', en: 'Hybrid retrieval' },
    short: {
      de: 'Kombiniert Stichwortsuche mit semantischer Suche.',
      en: 'Combines keyword retrieval with semantic retrieval.',
    },
    body: {
      de: 'Hybrid-Suche kann Treffer finden, die nicht exakt dieselben Wörter benutzen, aber inhaltlich zur Frage passen. Sie ist der Standard für offene Fragen.',
      en: 'Hybrid retrieval can find entries that do not use the exact same words, but still match the meaning of the question. It is the default for open questions.',
    },
  },
  official_only_sources: {
    id: 'official_only_sources',
    title: { de: 'Nur amtliche Quellen', en: 'Official-only sources' },
    short: {
      de: 'Filtert die Belege auf amtliche oder amtlich-nahe Quellen.',
      en: 'Filters evidence to official or official-adjacent sources.',
    },
    body: {
      de: 'Dieser Filter ist hilfreich, wenn die Antwort besonders belastbar sein soll. Praktische Hilfsquellen oder NGOs können dadurch aber fehlen.',
      en: 'This filter is useful when the answer needs especially strong authority. Practical support sources or NGOs may be left out.',
    },
  },
  helpful_answer: {
    id: 'helpful_answer',
    title: { de: 'Hilfreiche Antwort', en: 'Helpful answer' },
    short: {
      de: 'Die zusammengefasste Orientierung aus den gefundenen Belegen.',
      en: 'The summarized orientation from retrieved evidence.',
    },
    body: {
      de: 'Die Antwort soll einen Einstieg geben, keine Rechtsberatung ersetzen. Sie ist nur so gut wie die gefundenen und bewerteten Belege.',
      en: 'The answer is meant as orientation, not as a replacement for legal advice. It is only as good as the retrieved and evaluated evidence.',
    },
  },
  evidence_entries: {
    id: 'evidence_entries',
    title: { de: 'Beleg-Einträge', en: 'Evidence entries' },
    short: {
      de: 'Einträge, auf die sich die Antwort stützt.',
      en: 'Entries used as support for the answer.',
    },
    body: {
      de: 'Beleg-Einträge zeigen, welche Datenbankeinträge für eine Antwort herangezogen wurden. Sie machen die Antwort prüfbar.',
      en: 'Evidence entries show which database entries were used for an answer. They make the answer easier to inspect.',
    },
  },
  search_focus: {
    id: 'search_focus',
    title: { de: 'Suchfokus', en: 'Search focus' },
    short: {
      de: 'Die interne Suchfrage, mit der das System passende Belege sucht.',
      en: 'The internal search query used to retrieve matching evidence.',
    },
    body: {
      de: 'Bei Chat- oder Langfragen wird deine Eingabe oft in eine eigenständige Suchfrage umformuliert. Das hilft, mehr passende Belege zu finden.',
      en: 'For chat or long questions, your input is often rewritten as a standalone search query. That helps retrieve better evidence.',
    },
  },
  matched_topic_profiles: {
    id: 'matched_topic_profiles',
    title: { de: 'Erkannte Themenprofile', en: 'Matched topic profiles' },
    short: {
      de: 'Themen, die das System in der Frage erkannt hat.',
      en: 'Topics the system detected in the question.',
    },
    body: {
      de: 'Themenprofile helfen beim Routing: Sie verbinden Nutzerfragen mit Fachbereichen, Zielgruppen und Quellenpaketen.',
      en: 'Topic profiles help routing by connecting user questions to subject areas, target groups, and source packs.',
    },
  },
  technical_details: {
    id: 'technical_details',
    title: { de: 'Technische Details', en: 'Technical details' },
    short: {
      de: 'Diagnosewerte für Betrieb, Abruf und Antwortsystem.',
      en: 'Diagnostics for operations, retrieval, and answer generation.',
    },
    body: {
      de: 'Diese Angaben sind vor allem für Redaktion, Debugging und Qualitätskontrolle gedacht. Nutzerinnen brauchen sie normalerweise nicht.',
      en: 'These values are mainly for editors, debugging, and quality control. Most users will not need them.',
    },
  },
  answer_service: {
    id: 'answer_service',
    title: { de: 'Antwortdienst', en: 'Answer service' },
    short: {
      de: 'Der Backend-Dienst, der KI-Antworten und Abrufdiagnosen bereitstellt.',
      en: 'The backend service that provides AI answers and retrieval diagnostics.',
    },
    body: {
      de: 'Der Antwortdienst verbindet Umschreibung, Belegsuche, Synthese und Sicherheitsprüfungen.',
      en: 'The answer service connects rewrite, evidence retrieval, synthesis, and safety checks.',
    },
  },
  provider: {
    id: 'provider',
    title: { de: 'Anbieter', en: 'Provider' },
    short: {
      de: 'Das KI- oder Modell-Backend, das die Antwort erstellt.',
      en: 'The AI or model backend used to create the answer.',
    },
    body: {
      de: 'Der Anbieter kann je nach Umgebung wechseln, etwa zwischen lokalem Modell, externem API-Anbieter oder Fallback.',
      en: 'The provider can change by environment, for example between a local model, an external API provider, or a fallback.',
    },
  },
  bot_protection: {
    id: 'bot_protection',
    title: { de: 'Bot-Schutz', en: 'Bot protection' },
    short: {
      de: 'Ein Schutz gegen automatisierte Massenanfragen.',
      en: 'Protection against automated high-volume requests.',
    },
    body: {
      de: 'Cloudflare Turnstile prüft, ob eine Anfrage wahrscheinlich von einem echten Browser kommt. Das schützt Kosten und Verfügbarkeit.',
      en: 'Cloudflare Turnstile checks whether a request likely comes from a real browser. This protects cost and availability.',
    },
  },
  retrieval_mode: {
    id: 'retrieval_mode',
    title: { de: 'Abrufmodus', en: 'Retrieval mode' },
    short: {
      de: 'Die Strategie, mit der passende Belege aus dem Datenbestand geholt werden.',
      en: 'The strategy used to retrieve matching evidence from the dataset.',
    },
    body: {
      de: 'Der Abrufmodus steuert, ob die Suche eher direkt, semantisch kombiniert oder mit externen Quellen arbeitet.',
      en: 'Retrieval mode controls whether search works more directly, semantically, or with external sources.',
    },
  },
  official_filter: {
    id: 'official_filter',
    title: { de: 'Amtliche Filterung', en: 'Official filter' },
    short: {
      de: 'Zeigt an, ob die Antwort auf amtliche Quellen beschränkt wurde.',
      en: 'Shows whether the answer was restricted to official sources.',
    },
    body: {
      de: 'Amtliche Filterung erhöht die Verbindlichkeit der Belege, kann aber nützliche Beratungs- und Hilfsangebote ausblenden.',
      en: 'Official filtering increases source authority, but can hide useful counselling and support resources.',
    },
  },
  external_retrieval: {
    id: 'external_retrieval',
    title: { de: 'Externer Abruf', en: 'External retrieval' },
    short: {
      de: 'Abruf aus Quellen außerhalb des lokalen Datenbestands.',
      en: 'Retrieval from sources outside the local dataset.',
    },
    body: {
      de: 'Externer Abruf kann helfen, Lücken zu schließen. Solche Ergebnisse brauchen oft mehr redaktionelle Prüfung.',
      en: 'External retrieval can help fill gaps. These results often need more editorial review.',
    },
  },
  editorial_review: {
    id: 'editorial_review',
    title: { de: 'Redaktionelle Prüfung', en: 'Editorial review' },
    short: {
      de: 'Eine Markierung, dass Menschen den Fall oder die Quelle ansehen sollten.',
      en: 'A marker that humans should inspect the case or source.',
    },
    body: {
      de: 'Redaktionelle Prüfung wird wichtig, wenn Belege schwach, neu, extern oder fachlich heikel sind.',
      en: 'Editorial review matters when evidence is weak, new, external, or sensitive.',
    },
  },
  review_notes: {
    id: 'review_notes',
    title: { de: 'Review-Hinweise', en: 'Review notes' },
    short: {
      de: 'Gründe, warum eine Antwort oder Quelle geprüft werden sollte.',
      en: 'Reasons why an answer or source should be reviewed.',
    },
    body: {
      de: 'Review-Hinweise geben der Redaktion konkrete Spuren, zum Beispiel schwache Belege, externe Treffer oder unklare Quellenstufen.',
      en: 'Review notes give editors concrete clues, such as weak evidence, external hits, or unclear source tiers.',
    },
  },
  weak_evidence: {
    id: 'weak_evidence',
    title: { de: 'Schwache Belege', en: 'Weak evidence' },
    short: {
      de: 'Die gefundenen Treffer passen nur unsicher oder unvollständig zur Frage.',
      en: 'The retrieved matches are uncertain or incomplete for the question.',
    },
    body: {
      de: 'Bei schwachen Belegen sollte die Antwort vorsichtig gelesen werden. Das System sollte dann eher Lücken benennen als raten.',
      en: 'When evidence is weak, the answer should be read cautiously. The system should identify gaps instead of guessing.',
    },
  },
  official_baseline: {
    id: 'official_baseline',
    title: { de: 'Amtliche Grundlage', en: 'Official baseline' },
    short: {
      de: 'Der Teil der Antwort, der auf amtlichen Quellen basiert.',
      en: 'The part of the answer based on official sources.',
    },
    body: {
      de: 'Die amtliche Grundlage priorisiert Behörden, Ministerien und andere offizielle Quellen. Sie ist oft verbindlicher, aber nicht immer praktisch genug.',
      en: 'The official baseline prioritizes public authorities, ministries, and other official sources. It is often more authoritative, but not always practical enough.',
    },
  },
  assistive_support: {
    id: 'assistive_support',
    title: { de: 'NGO-/Praktische Hilfe', en: 'NGO / practical support' },
    short: {
      de: 'Hilfs- und Beratungsquellen, die praktische nächste Schritte ergänzen.',
      en: 'Support and counselling sources that add practical next steps.',
    },
    body: {
      de: 'Diese Quellen sind nicht immer amtlich, können aber erklären, begleiten oder konkrete Anlaufstellen nennen.',
      en: 'These sources are not always official, but can explain, accompany, or point to concrete places to contact.',
    },
  },
  direct_contacts: {
    id: 'direct_contacts',
    title: { de: 'Direkte Kontakte', en: 'Direct contacts' },
    short: {
      de: 'Konkrete Stellen, Telefonnummern, E-Mails oder Links für den nächsten Schritt.',
      en: 'Concrete offices, phone numbers, emails, or links for the next step.',
    },
    body: {
      de: 'Direkte Kontakte sollen Nutzerinnen schneller von der Orientierung zur Handlung bringen.',
      en: 'Direct contacts help users move from orientation to action more quickly.',
    },
  },
  language_source: {
    id: 'language_source',
    title: { de: 'Sprachfassung', en: 'Language source' },
    short: {
      de: 'Zeigt, woher die vereinfachte Sprachversion stammt.',
      en: 'Shows where the simplified language version comes from.',
    },
    body: {
      de: 'Eine Sprachfassung kann redaktionell geprüft, automatisch vorgeschlagen oder aus Standard-Belegen abgeleitet sein.',
      en: 'A language version can be editor-reviewed, system-suggested, or derived from standard evidence.',
    },
  },
  source_role: {
    id: 'source_role',
    title: { de: 'Rolle der Quelle', en: 'Source role' },
    short: {
      de: 'Ordnet ein, welche Aufgabe eine Quelle im System hat.',
      en: 'Classifies what job a source has in the system.',
    },
    body: {
      de: 'Die Rolle unterscheidet zum Beispiel amtliche Information, geprüfte Hilfsangebote und Kontextquellen. Sie hilft einzuschätzen, wie eine Quelle in Antworten verwendet werden sollte.',
      en: 'The role distinguishes official information, reviewed support resources, and context sources. It helps judge how a source should be used in answers.',
    },
  },
  source_tier: {
    id: 'source_tier',
    title: { de: 'Quellenstufe', en: 'Source tier' },
    short: {
      de: 'Eine Vertrauens- und Nähe-Einstufung für Quellen.',
      en: 'A trust and proximity classification for sources.',
    },
    body: {
      de: 'Quellenstufen unterscheiden etwa amtliche Quellen, amtlich-nahe Quellen, NGO-Quellen, wissenschaftlichen Kontext und sonstige Kontextquellen.',
      en: 'Source tiers distinguish official sources, official-adjacent sources, NGO sources, academic context, and other context sources.',
    },
  },
  institution_type: {
    id: 'institution_type',
    title: { de: 'Institutionstyp', en: 'Institution type' },
    short: {
      de: 'Beschreibt, welche Art Organisation hinter einer Quelle steht.',
      en: 'Describes what kind of organization stands behind a source.',
    },
    body: {
      de: 'Institutionstypen sind zum Beispiel Behörde, öffentlicher Dienst, NGO, Beratung, Forschung oder Medien. Das ist ein Kontextsignal, kein automatisches Qualitätsurteil.',
      en: 'Institution types include government, public service, NGO, advisory service, research, or media. This is a context signal, not an automatic quality judgment.',
    },
  },
  jurisdiction: {
    id: 'jurisdiction',
    title: { de: 'Zuständigkeit', en: 'Jurisdiction' },
    short: {
      de: 'Zeigt, für welchen Rechts- oder Verwaltungsraum eine Quelle gilt.',
      en: 'Shows which legal or administrative area a source applies to.',
    },
    body: {
      de: 'DE steht für Deutschland, EU für die Europäische Union. Bei Sozialleistungen ist die Zuständigkeit wichtig, weil Regeln je nach Ebene unterschiedlich sein können.',
      en: 'DE means Germany, EU means the European Union. For social benefits, jurisdiction matters because rules can differ by administrative level.',
    },
  },
  content_domain: {
    id: 'content_domain',
    title: { de: 'Inhaltsbereich', en: 'Content domain' },
    short: {
      de: 'Der Bereich, in dem Einträge dieser Quelle genutzt werden.',
      en: 'The area where entries from this source are used.',
    },
    body: {
      de: 'Inhaltsbereiche wie Leistungen, Hilfen, Kontakte, Tools und Organisationen zeigen, für welche Art von Orientierung eine Quelle im Datenbestand vorkommt.',
      en: 'Content domains such as benefits, aid, contacts, tools, and organizations show what kind of orientation a source supports in the dataset.',
    },
  },
};
