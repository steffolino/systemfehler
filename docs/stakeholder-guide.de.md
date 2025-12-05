# Systemfehler – Leitfaden für Stakeholder

Willkommen. Dieses Dokument ist für Sie gedacht, wenn Ihnen soziale Dienste, Datentransparenz oder barrierefreie Informationen wichtig sind – und Sie Systemfehler verstehen oder unterstützen möchten, ohne technische Kenntnisse zu benötigen.

---

## 1. Das Problem

Informationen über soziale Unterstützung in Deutschland sind verstreut, fragmentiert und fragil.

- **Sie sind schwer zu finden.** Anspruchsvoraussetzungen, Fristen, Leistungsbeträge und Antragsprozesse sind auf Dutzenden von Websites von Behörden verteilt, oft in komplexer Sprache.
- **Sie verschwinden.** Wenn Behörden ihre Websites aktualisieren, verschwindet alte Information – auch wenn sie für das Verständnis von Anspruchsvoraussetzungen oder historischem Kontext wichtig war.
- **Sie sind nicht barrierefrei.** Begrenzte Verfügbarkeit in mehreren Sprachen und Leichter Sprache bedeutet, dass viele Menschen ihre Optionen nicht verstehen können.
- **Sie sind nicht strukturiert.** Jede Behörde präsentiert Informationen unterschiedlich, was es schwierig macht, zu vergleichen, zu analysieren oder programmatisch zu nutzen.

Dies schafft Hürden für:

- **Menschen, die Unterstützung suchen** – sie haben Schwierigkeiten, herauszufinden, worauf sie Anspruch haben.
- **NGOs und Berater** – sie wenden Ressourcen auf, um Informationsbeschaffung zu duplizieren.
- **Forscher und politische Entscheidungsträger** – ihnen fehlen strukturierte Daten zur Analyse, wie sich Dienste entwickeln und wer versorgt wird.
- **Öffentliche Verwaltung** – sie haben begrenzte Sichtbarkeit in die fragmentierte Landschaft, die sie verwaltet.

---

## 2. Was ist Systemfehler?

Systemfehler ist eine **langfristige, offene Dateninfrastruktur**, die Informationen über soziale Dienste sammelt, normalisiert, erhält und teilt.

Denken Sie daran als **lebendes Archiv und Referenzdatenbank** statt als verbrauchergerichtete Website (obwohl verbrauchergerichtete Schnittstellen darauf aufgebaut werden könnten).

### Kernprinzipien

**Bewahrung**: Informationen werden mit Zeitstempeln gespeichert. Wenn offizielle Quellen Inhalte ändern oder entfernen, behält Systemfehler frühere Versionen. Dies macht es möglich, zu untersuchen, wie sich Dienste entwickelt haben.

**Transparenz**: Alle Daten sind offen zugänglich. Sie können sehen, welche Informationen wir haben, wie sie sich geändert haben, und woher sie stammen.

**Barrierefreiheit**: Die Plattform unterstützt von Anfang an mehrere Sprachen und Leichte Sprache. Informationen sollten nicht hinter komplexer Sprache verborgen sein.

**Interoperabilität**: Daten sind mit klaren Schemas und Taxonomien strukturiert. Dies ermöglicht eine Wiederverwendung – durch NGOs, Behördenportale, Chatbots, Forschungsprojekte und zukünftige Werkzeuge, die wir uns noch nicht vorgestellt haben.

**Menschliche Aufsicht**: Informationen werden niemals direkt von automatisierten Crawlern veröffentlicht. Jede Änderung durchläuft eine Moderation durch menschliche Experten, um Qualität und Genauigkeit zu gewährleisten.

---

## 3. Wer profitiert?

### Nutzer sozialer Dienste und Befürworter

- Eine **einzige, vereinheitlichte Quelle**, um verfügbare Leistungen und Unterstützungsprogramme zu verstehen.
- **Mehrsprachige, barrierefreie** Informationen auf Deutsch, Englisch und Leichter Sprache.
- **Historische Ansichten**, um zu verstehen, welche Programme es gab und wie sie sich geändert haben.
- **Zukünftige Werkzeuge** (Suchmaschinen, Chatbots, Berater), die auf Systemfehler-Daten aufgebaut sind.

### NGOs, Berater und Unterstützungsorganisationen

- **Reduzierte Duplizierung**: Statt dass jede Organisation unabhängig soziale Dienste verfolgt, können sie sich auf Systemfehler als Referenz verlassen.
- **Gemeinsame Infrastruktur**: Möglichkeiten, Systemfehler-Daten in Ihre eigenen Werkzeuge, Websites oder Beratungsprozesse zu integrieren.
- **Qualitätsstandard**: Zu wissen, dass Informationen aktiv gepflegt, moderiert und bewahrt werden.
- **Fachwissen erforderlich**: Ihre Einblicke und Rückmeldungen verbessern direkt die Datengenauigkeit.

### Forscher und Politikanalysten

- **Historischer Datensatz**: Verfolgen Sie, wie sich die Landschaft der sozialen Dienste im Laufe der Zeit entwickelt hat.
- **Strukturierte Daten**: Informationen, die für Analyse, Vergleich und Kombination mit anderen Datensätzen formatiert sind.
- **Zeitliche Analyse**: Verstehen Sie, wann Dienste eingeführt, geändert oder eingestellt wurden.
- **Offener Zugang**: Daten sind für akademische und politische Forschung frei verfügbar.

### Öffentliche Verwaltung und Regierung

- **Gemeinsame Referenzinfrastruktur**: Ein überparteilicher, transparenter Blick auf die Dienstlandschaft.
- **Änderungsüberwachung**: Sehen Sie die Auswirkungen von Website-Updates und Politikänderungen auf die Informationslandschaft.
- **Backend für Portale**: Systemfehler kann als Datenquelle für verbrauchergerichtete Behördenwebsites dienen.
- **Behördenübergreifende Koordination**: Ein gemeinsamer Bezugspunkt zum Verständnis des gesamten Ökosystems sozialer Dienste.

### Technologen und Werkzeugentwickler

- **API und Datenexport**: Verwenden Sie strukturierte, versionierte Daten, um Beratungswerkzeuge, Suchmaschinen oder Entscheidungsunterstützungssysteme zu erstellen.
- **LLM-bereite Daten**: Strukturierte Informationen, die sich für KI-gestützte Abfrage und Fragenbeantwortung eignen.
- **Open Source**: Architektur, Werkzeuge und Workflows sind offen dokumentiert.

---

## 4. Wie funktioniert es? (Grundlagen)

1. **Sammlung**: Automatisierte Crawler rufen regelmäßig Informationen von Websites öffentlicher Behörden und anderen vertrauenswürdigen Quellen ab.

2. **Normalisierung**: Roh-HTML wird mit klaren Regeln in strukturierte Daten konvertiert (z. B. Leistungsbeträge, Anspruchsvoraussetzungen, Fristen extrahieren).

3. **Vergleich und Kennzeichnung**: Neue Informationen werden mit dem verglichen, was wir bereits wissen. Änderungen werden erkannt und zur Überprüfung gekennzeichnet.

4. **Menschliche Moderation**: Fachexperten und Moderatoren überprüfen vorgeschlagene Änderungen. Sie genehmigen, lehnen ab oder passen Einträge an. Ein Audit-Protokoll dokumentiert alle Entscheidungen.

5. **Speicherung und Versionierung**: Genehmigte Daten werden mit Zeitstempeln gespeichert. Frühere Versionen werden archiviert, niemals gelöscht.

6. **Bewertung und Qualität**: Jeder Eintrag erhält Qualitätsbewertungen, um unvollständige, veraltete oder unstrukturierte Informationen zu identifizieren.

7. **Veröffentlichung und Wiederverwendung**: Daten werden in mehreren Formaten (JSON, CSV, API) exportiert, um von NGOs, Forschern, Werkzeugen und Behördenportalen verwendet zu werden.

**Sie müssen die technischen Details nicht verstehen.** Der Schlüsselpunkt: Informationen durchlaufen menschliche Überprüfung vor der Veröffentlichung, und nichts wird stillschweigend verworfen.

---

## 5. Wie können Sie sich beteiligen?

### Wenn Sie ein Fachexperte oder Berater sind

- **Datengenauigkeit überprüfen**: Überprüfen Sie, ob die Informationen, die wir sammeln, Ihrer Erfahrung und Ihrem Wissen entsprechen.
- **Fehlende Quellen identifizieren**: Teilen Sie uns wichtige Organisationen, Programme oder Ressourcen mit, die wir verfolgen sollten.
- **Verbesserungen vorschlagen**: Helfen Sie uns zu verstehen, welche Felder, Sprachen oder Formate am nützlichsten wären.
- **Einträge moderieren**: Falls interessiert, können Sie dem Moderationsteam beitreten, um Informationsänderungen zu überprüfen und zu genehmigen.

### Wenn Sie eine Organisation oder eine Behörde vertreten

- **Daten teilen**: Geben Sie strukturierte Informationen über Ihre Dienste bereit. Dies beschleunigt die Genauigkeit und reduziert redundante Datenbeschaffung.
- **Rückmeldung geben**: Teilen Sie uns mit, wenn unsere gesammelten Informationen veraltet oder unvollständig sind.
- **Integrieren**: Verwenden Sie Systemfehler als Backend für Ihre eigenen verbrauchergerichteten Werkzeuge oder Portale.
- **Zusammenarbeiten**: Arbeiten Sie mit uns zusammen, um Datenqualität und Abdeckung sicherzustellen.

### Wenn Sie in Forschung oder Politik tätig sind

- **Datenexporte anfordern**: Wir können maßgeschneiderte Datensätze für spezifische Analysen bereitstellen.
- **Erkenntnisse beitragen**: Teilen Sie Forschungserkenntnisse und politische Empfehlungen auf der Grundlage von Systemfehler-Daten.
- **Plattform erweitern**: Schlagen Sie neue Bereiche vor (z. B. Wohnen, Energie, Gesundheit) oder zeitliche Analysen.
- **Wirkung verstärken**: Verwenden Sie Systemfehler, um evidenzbasierte Politikentwicklung zu unterstützen.

### Wenn Sie ein Werkzeugentwickler oder Technologe sind

- **Darauf aufbauen**: Erstellen Sie mit Systemfehler-Daten barrierefreie Schnittstellen, Suchtools oder Entscheidungsunterstützungssysteme.
- **Code beitragen**: Helfen Sie, Datenbeschaffung, Qualitätsbewertung oder API-Endpunkte zu verbessern.
- **Integrationen vorschlagen**: Empfehlen Sie APIs oder Exportformate, die nachgelagerte Werkzeuge unterstützen würden.
- **Implementierungen teilen**: Veröffentlichen Sie Beispiele für Werkzeuge oder Schnittstellen, die auf Systemfehler aufgebaut sind.

### Wenn Ihnen Zugang und Inklusion wichtig sind

- **Barrierefreiheit testen**: Helfen Sie uns sicherzustellen, dass Informationen wirklich in mehreren Sprachen und Leichter Sprache barrierefrei sind.
- **Rückmeldung geben**: Teilen Sie uns mit, was für verschiedene Zielgruppen funktioniert und was nicht.
- **Ihre Geschichte teilen**: Helfen Sie uns zu verstehen, wie sich der Informationszugang auf Ihre Gemeinschaft auswirkt.
- **Advocacy betreiben**: Helfen Sie, das Bewusstsein für das Projekt unter Gleichgesinnten, Organisationen oder Netzwerken zu schärfen.

---

## 6. Aktueller Status und nächste Schritte

### Heute

Systemfehler ist in der **frühen Design- und Implementierungsphase**. Wir:

- Definieren die Datenschemas und Struktur.
- Erstellen erste Crawler für Schlüsselbereiche (Leistungen, Hilfsprogramme, Organisationen, Werkzeuge, Kontakte).
- Richten Moderationsworkflows und Qualitätssicherungsprozesse ein.
- Dokumentieren die Architektur für Mitwirkende und Partner.

### Kurzfristig (nächste 6–12 Monate)

- Start mit initialen Bereichen und Daten.
- Etablierung von Moderationsworkflows und Qualitätsmetriken.
- Veröffentlichung offener APIs und Datenexporte.
- Rekrutierung und Schulung von Moderatoren und Fachexperten.

### Mittelfristig (1–2 Jahre)

- Erweiterung auf neue Bereiche (Wohnen, Energie, Gesundheit, Bildung).
- Erstellung von Referenzimplementierungen von Werkzeugen (Suche, Beratungs-Chatbots, Dashboards).
- Vertiefung von Partnerschaften mit NGOs, Behörden und Forschungsinstitutionen.
- Etablierung eines Nachhaltigkeitsmodells (Finanzierung, Governance, Gemeinschaft).

### Langfristig

- Werden zu weit genutzter Infrastruktur zum Verständnis und zur Navigation sozialer Dienste.
- Ermögliche neue Formen der Politikanalyse, Bürgerberatung und Innovation sozialer Dienste.
- Diene als Modell für andere Länder und Bereiche, die mit ähnlichen Fragmentierungsproblemen konfrontiert sind.

---

## 7. Governance und Werte

Systemfehler ist mit folgenden Verpflichtungen konzipiert:

- **Offen als Standard**: Daten, Code und Entscheidungen sind öffentlich zugänglich.
- **Gemeinnützig und überparteilich**: Das Projekt dient dem öffentlichen Interesse, nicht kommerziellen oder politischen Agenden.
- **Gemeinschaftsgesteuert**: Entscheidungen beziehen Moderatoren, Fachexperten, Partnerorganisationen und Nutzer ein.
- **Bewahrungsfokussiert**: Historische Versionen werden beibehalten; nichts wird stillschweigend gelöscht oder geändert.
- **Qualitätsorientiert**: Menschliche Aufsicht und Moderation gewährleisten Genauigkeit und Vertrauenswürdigkeit.
- **Erweiterbar**: Neue Bereiche, Sprachen und Anwendungsfälle können hinzugefügt werden, ohne den Kern neu zu gestalten.

---

## 8. Wie Sie beginnen

### Mehr erfahren

- Lesen Sie `docs/vision.md` für strategische und langfristige Ziele.
- Lesen Sie `docs/architecture.md`, wenn Sie das technische Design verstehen möchten (keine Codierung erforderlich).
- Besuchen Sie das GitHub-Projektboard, um aktuelle Arbeiten und Prioritäten zu sehen.

### Verbinden

- **GitHub Issues**: Überprüfen Sie offene Issues, um zu sehen, wie Sie beitragen können. Viele erfordern keine Codierung.
- **Diskussionen**: Beteiligen Sie sich an Gesprächen über Daten, Prioritäten und Partnerschaften.
- **E-Mail oder Kontakt**: [Wird bereitgestellt, wenn das Projekt seine Kommunikationskanäle klärt.]

### Nächste Schritte

1. **Stellen Sie sich vor**: Teilen Sie uns mit, wer Sie sind, was Sie hierher bringt, und wie Sie beitragen möchten.
2. **Wählen Sie einen Startpunkt**: Ob es um Datenüberprüfung, Quellenvorschläge, Moderation von Einträgen oder Werkzeugentwicklung geht – es gibt eine Rolle für Sie.
3. **Verbinden Sie sich mit anderen**: Treten Sie der Gemeinschaft von Fachexperten, Forschern, Entwicklern und Befürwortern bei.

---

## 9. Fragen?

- **"Ist das etwas für mich?"** → Falls Ihnen Informationszugang, soziale Dienste, Datentransparenz oder eine der oben beschriebenen Rollen wichtig ist, ja.
- **"Muss ich programmieren können?"** → Nein. Wir brauchen Fachexperten, Berater, Forscher, Tester und Befürworter genauso wie Entwickler.
- **"Kann ich diesen Daten vertrauen?"** → Daten durchlaufen vor der Veröffentlichung menschliche Moderation. Wir führen ein Audit-Protokoll aller Änderungen und Entscheidungen. Sie können immer die Quelle und Herkunft sehen.
- **"Wie unterscheidet sich das von [anderem Projekt]?"** → Wir betonen Bewahrung (Geschichte behalten), mehrsprachige Barrierefreiheit, menschliche Moderation und strukturierte Daten für nachgelagerte Werkzeuge. Wir werden als langfristige Infrastruktur konzipiert, nicht als spezifisches Verbraucherprodukt.
- **"Wird dies nachhaltig sein?"** → Das ist eine Priorität. Wir erkunden Partnerschaften, Finanzierungsmodelle und Community-Governance, um sicherzustellen, dass Systemfehler der Öffentlichkeit Jahrzehnte, nicht nur Jahre, dienen kann.

---

## 10. Vielen Dank

Ob Sie hier sind, um zu lernen, beizutragen, zu partnern oder einfach zu kümmern, dass soziale Dienste transparenter und barrierefreier werden – vielen Dank. Je mehr Stimmen, Fachwissen und Perspektiven wir zusammenbringen, desto besser kann Systemfehler dienen.

Wir bauen das zusammen.
