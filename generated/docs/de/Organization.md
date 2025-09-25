# Class: Organization



URI: [https://systemfehler.dev/schema/overlay/de/Organization](https://systemfehler.dev/schema/overlay/de/Organization)




```mermaid
 classDiagram
    class Organization
      Entity <|-- Organization
      
      Organization : address
        
      Organization : email
        
      Organization : id
        
      Organization : keywords
        
      Organization : lang
        
          Organization --> LanguageCode : lang
        
      Organization : last_checked
        
      Organization : org_name
        
      Organization : phone
        
      Organization : primary_page_id
        
      Organization : status
        
          Organization --> StatusEnum : status
        
      Organization : summary
        
      Organization : title
        
      Organization : type
        
          Organization --> CategoryEnum : type
        
      Organization : updated_at
        
      Organization : url
        
      
```





## Inheritance
* [Entity](Entity.md) [ [Reviewable](Reviewable.md) [Timestamps](Timestamps.md) [Localized](Localized.md)]
    * **Organization**



## Slots

| Name | Cardinality and Range | Description | Inheritance |
| ---  | --- | --- | --- |
| [org_name](org_name.md) | 0..1 <br/> [String](String.md) |  | direct |
| [email](email.md) | 0..1 <br/> [String](String.md) |  | direct |
| [phone](phone.md) | 0..1 <br/> [String](String.md) |  | direct |
| [address](address.md) | 0..1 <br/> [String](String.md) |  | direct |
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
| self | https://systemfehler.dev/schema/overlay/de/Organization |
| native | https://systemfehler.dev/schema/overlay/de/Organization |





## LinkML Source

<!-- TODO: investigate https://stackoverflow.com/questions/37606292/how-to-create-tabbed-code-blocks-in-mkdocs-or-sphinx -->

### Direct

<details>
```yaml
name: Organization
from_schema: https://systemfehler.dev/schema/overlay/de
is_a: Entity
slots:
- org_name
- email
- phone
- address

```
</details>

### Induced

<details>
```yaml
name: Organization
from_schema: https://systemfehler.dev/schema/overlay/de
is_a: Entity
attributes:
  org_name:
    name: org_name
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: org_name
    owner: Organization
    domain_of:
    - Organization
    range: string
  email:
    name: email
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: email
    owner: Organization
    domain_of:
    - Organization
    range: string
  phone:
    name: phone
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: phone
    owner: Organization
    domain_of:
    - Organization
    range: string
  address:
    name: address
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: address
    owner: Organization
    domain_of:
    - Organization
    range: string
  id:
    name: id
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    identifier: true
    alias: id
    owner: Organization
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
    owner: Organization
    domain_of:
    - StagingEntry
    - Entity
    range: string
  title:
    name: title
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: title
    owner: Organization
    domain_of:
    - StagingEntry
    - Entity
    range: string
  summary:
    name: summary
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: summary
    owner: Organization
    domain_of:
    - StagingEntry
    - Entity
    range: string
  lang:
    name: lang
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: lang
    owner: Organization
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
    owner: Organization
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
    owner: Organization
    domain_of:
    - Entity
    range: CategoryEnum
  primary_page_id:
    name: primary_page_id
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: primary_page_id
    owner: Organization
    domain_of:
    - Entity
    range: string
  status:
    name: status
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: status
    owner: Organization
    domain_of:
    - Reviewable
    range: StatusEnum
  last_checked:
    name: last_checked
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: last_checked
    owner: Organization
    domain_of:
    - Reviewable
    range: datetime
  updated_at:
    name: updated_at
    from_schema: https://systemfehler.dev/schema/overlay/de
    rank: 1000
    alias: updated_at
    owner: Organization
    domain_of:
    - Timestamps
    range: datetime

```
</details>