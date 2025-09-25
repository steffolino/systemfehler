# Class: Entity


* __NOTE__: this is an abstract class and should not be instantiated directly


URI: [https://systemfehler.dev/schema/Entity](https://systemfehler.dev/schema/Entity)




```mermaid
 classDiagram
    class Entity
      Reviewable <|-- Entity
      Timestamps <|-- Entity
      Localized <|-- Entity
      

      Entity <|-- Organization
      Entity <|-- Service
      Entity <|-- Tool
      Entity <|-- Form
      Entity <|-- Glossary
      Entity <|-- LegalAid
      Entity <|-- Association
      
      
      Entity : id
        
      Entity : keywords
        
      Entity : lang
        
          Entity --> LanguageCode : lang
        
      Entity : last_checked
        
      Entity : primary_page_id
        
      Entity : status
        
          Entity --> StatusEnum : status
        
      Entity : summary
        
      Entity : title
        
      Entity : type
        
          Entity --> CategoryEnum : type
        
      Entity : updated_at
        
      Entity : url
        
      
```





## Inheritance
* **Entity** [ [Reviewable](Reviewable.md) [Timestamps](Timestamps.md) [Localized](Localized.md)]
    * [Organization](Organization.md)
    * [Service](Service.md)
    * [Tool](Tool.md)
    * [Form](Form.md)
    * [Glossary](Glossary.md)
    * [LegalAid](LegalAid.md)
    * [Association](Association.md)



## Slots

| Name | Cardinality and Range | Description | Inheritance |
| ---  | --- | --- | --- |
| [id](id.md) | 1..1 <br/> [String](String.md) |  | direct |
| [url](url.md) | 0..1 <br/> [String](String.md) |  | direct |
| [title](title.md) | 0..1 <br/> [String](String.md) |  | direct |
| [summary](summary.md) | 0..1 <br/> [String](String.md) |  | direct |
| [lang](lang.md) | 0..1 <br/> [LanguageCode](LanguageCode.md) |  | direct |
| [keywords](keywords.md) | 0..* <br/> [String](String.md) |  | direct |
| [type](type.md) | 0..1 <br/> [CategoryEnum](CategoryEnum.md) |  | direct |
| [primary_page_id](primary_page_id.md) | 0..1 <br/> [String](String.md) |  | direct |
| [status](status.md) | 0..1 <br/> [StatusEnum](StatusEnum.md) |  | [Reviewable](Reviewable.md) |
| [last_checked](last_checked.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Reviewable](Reviewable.md) |
| [updated_at](updated_at.md) | 0..1 <br/> [Datetime](Datetime.md) |  | [Timestamps](Timestamps.md) |









## Identifier and Mapping Information







### Schema Source


* from schema: https://systemfehler.dev/schema





## Mappings

| Mapping Type | Mapped Value |
| ---  | ---  |
| self | https://systemfehler.dev/schema/Entity |
| native | https://systemfehler.dev/schema/Entity |





## LinkML Source

<!-- TODO: investigate https://stackoverflow.com/questions/37606292/how-to-create-tabbed-code-blocks-in-mkdocs-or-sphinx -->

### Direct

<details>
```yaml
name: Entity
from_schema: https://systemfehler.dev/schema
abstract: true
mixins:
- Reviewable
- Timestamps
- Localized
slots:
- id
- url
- title
- summary
- lang
- keywords
- type
- primary_page_id

```
</details>

### Induced

<details>
```yaml
name: Entity
from_schema: https://systemfehler.dev/schema
abstract: true
mixins:
- Reviewable
- Timestamps
- Localized
attributes:
  id:
    name: id
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    identifier: true
    alias: id
    owner: Entity
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
    owner: Entity
    domain_of:
    - StagingEntry
    - Entity
    range: string
  title:
    name: title
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: title
    owner: Entity
    domain_of:
    - StagingEntry
    - Entity
    range: string
  summary:
    name: summary
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: summary
    owner: Entity
    domain_of:
    - StagingEntry
    - Entity
    range: string
  lang:
    name: lang
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: lang
    owner: Entity
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
    owner: Entity
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
    owner: Entity
    domain_of:
    - Entity
    range: CategoryEnum
  primary_page_id:
    name: primary_page_id
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: primary_page_id
    owner: Entity
    domain_of:
    - Entity
    range: string
  status:
    name: status
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: status
    owner: Entity
    domain_of:
    - Reviewable
    range: StatusEnum
  last_checked:
    name: last_checked
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: last_checked
    owner: Entity
    domain_of:
    - Reviewable
    range: datetime
  updated_at:
    name: updated_at
    from_schema: https://systemfehler.dev/schema
    rank: 1000
    alias: updated_at
    owner: Entity
    domain_of:
    - Timestamps
    range: datetime

```
</details>