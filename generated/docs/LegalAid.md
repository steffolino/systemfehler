# Class: LegalAid



URI: [https://systemfehler.dev/schema/LegalAid](https://systemfehler.dev/schema/LegalAid)




```mermaid
 classDiagram
    class LegalAid
      Entity <|-- LegalAid
      
      LegalAid : id
        
      LegalAid : keywords
        
      LegalAid : lang
        
          LegalAid --> LanguageCode : lang
        
      LegalAid : last_checked
        
      LegalAid : practice_area
        
      LegalAid : primary_page_id
        
      LegalAid : status
        
          LegalAid --> StatusEnum : status
        
      LegalAid : summary
        
      LegalAid : title
        
      LegalAid : type
        
          LegalAid --> CategoryEnum : type
        
      LegalAid : updated_at
        
      LegalAid : url
        
      
```





## Inheritance
* [Entity](Entity.md) [ [Reviewable](Reviewable.md) [Timestamps](Timestamps.md) [Localized](Localized.md)]
    * **LegalAid**



## Slots

| Name | Cardinality and Range | Description | Inheritance |
| ---  | --- | --- | --- |
| [practice_area](practice_area.md) | 0..1 <br/> [String](String.md) |  | direct |
| [id](id.md) | 1..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [url](url.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [title](title.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [summary](summary.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [lang](lang.md) | 0..1 <br/> [LanguageCode](LanguageCode.md) |  | [Entity](Entity.md), [Localized](Localized.md) |
| [keywords](keywords.md) | 0..* <br/> [String](String.md) |  | [Entity](Entity.md) |
| [type](type.md) | 0..1 <br/> [CategoryEnum](CategoryEnum.md) |  | [Entity](Entity.md) |
| [primary_page_id](primary_page_id.md) | 0..1 <br/> [String](String.md) |  | [Entity](Entity.md) |
| [status](status.md) | 0..1 <br/> [StatusEnum](StatusEnum.md) |  | [Reviewable](Reviewable.md) |
| [last_checked](last_checked.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Reviewable](Reviewable.md) |
| [updated_at](updated_at.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Timestamps](Timestamps.md) |









## Identifier and Mapping Information







### Schema Source


* from schema: https://systemfehler.dev/schema





## Mappings

| Mapping Type | Mapped Value |
| ---  | ---  |
| self | https://systemfehler.dev/schema/LegalAid |
| native | https://systemfehler.dev/schema/LegalAid |





## LinkML Source

<!-- TODO: investigate https://stackoverflow.com/questions/37606292/how-to-create-tabbed-code-blocks-in-mkdocs-or-sphinx -->

### Direct

<details>
```yaml
name: LegalAid
from_schema: https://systemfehler.dev/schema
is_a: Entity
slots:
- practice_area

```
</details>

### Induced

<details>
```yaml
name: LegalAid
from_schema: https://systemfehler.dev/schema
is_a: Entity
attributes:
  practice_area:
    name: practice_area
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: practice_area
    owner: LegalAid
    domain_of:
    - LegalAid
    range: string
  id:
    name: id
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    identifier: true
    alias: id
    owner: LegalAid
    domain_of:
    - StagingEntry
    - Entity
    range: string
    required: true
  url:
    name: url
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: url
    owner: LegalAid
    domain_of:
    - StagingEntry
    - Entity
    range: string
  title:
    name: title
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: title
    owner: LegalAid
    domain_of:
    - StagingEntry
    - Entity
    range: string
  summary:
    name: summary
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: summary
    owner: LegalAid
    domain_of:
    - StagingEntry
    - Entity
    range: string
  lang:
    name: lang
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: lang
    owner: LegalAid
    domain_of:
    - Localized
    - StagingEntry
    - Entity
    - TextVariant
    range: LanguageCode
  keywords:
    name: keywords
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: keywords
    owner: LegalAid
    domain_of:
    - StagingEntry
    - Entity
    range: string
    multivalued: true
  type:
    name: type
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: type
    owner: LegalAid
    domain_of:
    - Entity
    range: CategoryEnum
  primary_page_id:
    name: primary_page_id
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: primary_page_id
    owner: LegalAid
    domain_of:
    - Entity
    range: string
  status:
    name: status
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: status
    owner: LegalAid
    domain_of:
    - Reviewable
    range: StatusEnum
  last_checked:
    name: last_checked
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: last_checked
    owner: LegalAid
    domain_of:
    - Reviewable
    range: datetime
  updated_at:
    name: updated_at
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: updated_at
    owner: LegalAid
    domain_of:
    - Timestamps
    range: datetime

```
</details>