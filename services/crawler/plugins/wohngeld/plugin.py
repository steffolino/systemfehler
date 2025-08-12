from core.base import register
from plugins.generic_sitemap.plugin import GenericSitemap as Base

@register
class Wohngeld(Base):
    name = "wohngeld"
