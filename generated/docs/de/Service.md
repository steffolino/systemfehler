# Class: Service



URI: [https://systemfehler.dev/schema/overlay/de/Service](https://systemfehler.dev/schema/overlay/de/Service)




```mermaid
 classDiagram
    class Service
      Entity <|-- Service
      
      Service : application_steps
        
      Service : benefit_amount
        
      Service : eligibility
        
      Service : id
        
      Service : keywords
        
      Service : lang
        
          Service --> LanguageCode : lang
        
      Service : last_checked
        
      Service : primary_page_id
        
      Service : required_documents
        
      Service : status
        
          Service --> StatusEnum : status
        
      Service : summary
        
      Service : title
        
      Service : type
        
          Service --> CategoryEnum : type
        
      Service : updated_at
        
      Service : url
        
      
```





## Inheritance
* [Entity](Entity.md) [ [Reviewable](Reviewable.md) [Timestamps](Timestamps.md) [Localized](Localized.md)]
    * **Service**



## Slots

| Name | Cardinality and Range | Description | Inheritance |
| ---  | --- | --- | --- |
| [eligibility](eligibility.md) | 0..1 <br/> [String](String.md) |  | direct |
| [benefit_amount](benefit_amount.md) | 0..1 <br/> [String](String.md) |  | direct |
| [application_steps](application_steps.md) | 0..1 <br/> [String](String.md) |  | direct |
| [required_documents](required_documents.md) | 0..1 <br/> [String](String.md) |  | direct |
| [id](id.md) | 1..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [url](url.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [title](title.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [summary](summary.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [lang](lang.md) | 0..1 <br/> [LanguageCode](LanguageCode.md) |  | [Localized](Localized.md), [Entity](Entity.md) |
| [keywords](keywords.md) | 0..* <br/> [String](String.md) |  | [Entity](Entity.md) |
| [type](type.md) | 0..1 <br/> [CategoryEnum](CategoryEnum.md) |  | [Entity](Entity.md) |
| [primary_page_id](primary_page_id.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [status](status.md) | 0..1 <br/> [StatusEnum](StatusEnum.md) |  | [Reviewable](Reviewable.md) |
| [last_checked](last_checked.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Reviewable](Reviewable.md) |
| [updated_at](updated_at.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Timestamps](Timestamps.md) |









## Identifier and Mapping Information







### Schema Source


* from schema: https://systemfehler.dev/schema/overlay/de





## Mappings

| Mapping Type | Mapped Value |
| ---  | ---  |
| self | https://systemfehler.dev/schema/overlay/de/Service |
| native | https://systemfehler.dev/schema/overlay/de/Service |





## LinkML Source

<!-- TODO: investigate https://stackoverflow.com/questions/37606292/how-to-create-tabbed-code-blocks-in-mkdocs-or-sphinx -->

### Direct

<details>
```yaml
name: Service
from_schema: https://systemfehler.dev/schema/overlay/de
is_a: Entity
slots:
- eligibility
- benefit_amount
- application_steps
- required_documents

```
</details>

### Induced

<details>
```yaml
name: Service
from_schema: https://systemfehler.dev/schema/overlay/de
is_a: Entity
attributes:
  eligibility:
    name: eligibility
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: eligibility
    owner: Service
    domain_of:
    - Service
    range: string
  benefit_amount:
    name: benefit_amount
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: benefit_amount
    owner: Service
    domain_of:
    - Service
    range: string
  application_steps:
    name: application_steps
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: application_steps
    owner: Service
    domain_of:
    - Service
    range: string
  required_documents:
    name: required_documents
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: required_documents
    owner: Service
    domain_of:
    - Service
    range: string
  id:
    name: id
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    identifier: true
    alias: id
    owner: Service
    domain_of:
    - StagingEntry
    - Entity
    range: string
    required: true
  url:
    name: url
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: url
    owner: Service
    domain_of:
    - StagingEntry
    - Entity
    range: string
  title:
    name: title
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: title
    owner: Service
    domain_of:
    - StagingEntry
    - Entity
    range: string
  summary:
    name: summary
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: summary
    owner: Service
    domain_of:
    - StagingEntry
    - Entity
    range: string
  lang:
    name: lang
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: lang
    owner: Service
    domain_of:
    - Localized
    - StagingEntry
    - Entity
    - TextVariant
    range: LanguageCode
  keywords:
    name: keywords
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: keywords
    owner: Service
    domain_of:
    - StagingEntry
    - Entity
    range: string
    multivalued: true
  type:
    name: type
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: type
    owner: Service
    domain_of:
    - Entity
    range: CategoryEnum
  primary_page_id:
    name: primary_page_id
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: primary_page_id
    owner: Service
    domain_of:
    - Entity
    range: string
  status:
    name: status
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: status
    owner: Service
    domain_of:
    - Reviewable
    range: StatusEnum
  last_checked:
    name: last_checked
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: last_checked
    owner: Service
    domain_of:
    - Reviewable
    range: datetime
  updated_at:
    name: updated_at
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: updated_at
    owner: Service
    domain_of:
    - Timestamps
    range: datetime

```
</details>