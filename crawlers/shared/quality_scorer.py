"""
Systemfehler Quality Score Calculator

Calculates Information Quality Score (IQS) and AI Searchability Score (AIS)
for entries. Ports logic from scripts/calculate_quality_scores.js
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional


class QualityScorer:
    """Calculate quality scores for entries"""
    
    def calculate_iqs(self, entry: Dict[str, Any]) -> float:
        """
        Calculate Information Quality Score (IQS)
        
        Factors:
        - Completeness: % of required/recommended fields populated
        - Freshness: Days since last_seen
        - Provenance: Source reliability
        - Language coverage: Number of translations
        
        Args:
            entry: Entry data
            
        Returns:
            IQS score (0-100)
        """
        scores = []
        
        # Completeness score (40% weight)
        completeness = self._calculate_completeness(entry)
        scores.append(completeness * 0.4)
        
        # Freshness score (30% weight)
        freshness = self._calculate_freshness(entry)
        scores.append(freshness * 0.3)
        
        # Provenance quality (15% weight)
        provenance = self._calculate_provenance_quality(entry)
        scores.append(provenance * 0.15)
        
        # Language coverage (15% weight)
        language_coverage = self._calculate_language_coverage(entry)
        scores.append(language_coverage * 0.15)
        
        iqs = sum(scores)
        return round(iqs, 2)
    
    def calculate_ais(self, entry: Dict[str, Any]) -> float:
        """
        Calculate AI Searchability Score (AIS)
        
        Factors:
        - Structure clarity: Presence of structured data
        - Metadata richness: Topics, tags, target groups
        - Text quality: Length and readability
        - Language availability: Multiple languages
        
        Args:
            entry: Entry data
            
        Returns:
            AIS score (0-100)
        """
        scores = []
        
        # Structure clarity (35% weight)
        structure = self._calculate_structure_score(entry)
        scores.append(structure * 0.35)
        
        # Metadata richness (30% weight)
        metadata = self._calculate_metadata_richness(entry)
        scores.append(metadata * 0.3)
        
        # Text quality (20% weight)
        text_quality = self._calculate_text_quality(entry)
        scores.append(text_quality * 0.2)
        
        # Language availability (15% weight)
        language_availability = self._calculate_language_availability(entry)
        scores.append(language_availability * 0.15)
        
        ais = sum(scores)
        return round(ais, 2)
    
    def calculate_scores(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate both IQS and AIS scores
        
        Args:
            entry: Entry data
            
        Returns:
            Dictionary with iqs, ais, and computedAt
        """
        return {
            'iqs': self.calculate_iqs(entry),
            'ais': self.calculate_ais(entry),
            'computedAt': datetime.now(timezone.utc).isoformat()
        }
    
    def _calculate_completeness(self, entry: Dict[str, Any]) -> float:
        """Calculate field completeness (0-100)"""
        required_fields = ['id', 'title', 'url', 'status', 'provenance']
        recommended_fields = ['summary', 'content', 'topics', 'tags', 'targetGroups']
        
        required_count = sum(1 for field in required_fields if self._has_value(entry, field))
        recommended_count = sum(1 for field in recommended_fields if self._has_value(entry, field))
        
        # Required fields are weighted more heavily
        required_score = (required_count / len(required_fields)) * 70
        recommended_score = (recommended_count / len(recommended_fields)) * 30
        
        return required_score + recommended_score
    
    def _calculate_freshness(self, entry: Dict[str, Any]) -> float:
        """Calculate freshness score based on last_seen (0-100)"""
        last_seen = entry.get('lastSeen')
        if not last_seen:
            return 50.0  # Neutral score if unknown
        
        try:
            last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            days_old = (now - last_seen_dt).days
            
            # Score decreases with age
            if days_old <= 7:
                return 100.0
            elif days_old <= 30:
                return 90.0
            elif days_old <= 90:
                return 75.0
            elif days_old <= 180:
                return 60.0
            elif days_old <= 365:
                return 40.0
            else:
                return 20.0
        except (ValueError, TypeError):
            return 50.0
    
    def _calculate_provenance_quality(self, entry: Dict[str, Any]) -> float:
        """Calculate provenance quality (0-100)"""
        provenance = entry.get('provenance', {})
        
        if not provenance:
            return 0.0
        
        score = 0.0
        
        # Has source
        if provenance.get('source'):
            score += 25.0
        
        # Has crawler info
        if provenance.get('crawler'):
            score += 25.0
        
        # Has crawled timestamp
        if provenance.get('crawledAt'):
            score += 25.0
        
        # Has checksum for change detection
        if provenance.get('checksum'):
            score += 25.0
        
        return score
    
    def _calculate_language_coverage(self, entry: Dict[str, Any]) -> float:
        """Calculate language coverage score (0-100)"""
        multilingual_fields = ['title', 'summary', 'content']
        languages = ['de', 'en', 'easy_de']
        
        total_possible = len(multilingual_fields) * len(languages)
        total_present = 0
        
        for field in multilingual_fields:
            if field in entry and isinstance(entry[field], dict):
                for lang in languages:
                    if entry[field].get(lang):
                        total_present += 1
        
        return (total_present / total_possible) * 100 if total_possible > 0 else 0.0
    
    def _calculate_structure_score(self, entry: Dict[str, Any]) -> float:
        """Calculate structure clarity score (0-100)"""
        score = 0.0
        
        # Has clear title structure
        if self._has_multilingual_field(entry, 'title'):
            score += 30.0
        
        # Has summary
        if self._has_multilingual_field(entry, 'summary'):
            score += 25.0
        
        # Has structured content
        if self._has_multilingual_field(entry, 'content'):
            score += 25.0
        
        # Has temporal fields
        if entry.get('validFrom') or entry.get('validUntil') or entry.get('deadline'):
            score += 20.0
        
        return score
    
    def _calculate_metadata_richness(self, entry: Dict[str, Any]) -> float:
        """Calculate metadata richness (0-100)"""
        score = 0.0
        
        # Has topics
        topics = entry.get('topics', [])
        if topics and len(topics) > 0:
            score += 35.0
        
        # Has tags
        tags = entry.get('tags', [])
        if tags and len(tags) > 0:
            score += 30.0
        
        # Has target groups
        target_groups = entry.get('targetGroups', [])
        if target_groups and len(target_groups) > 0:
            score += 35.0
        
        return score
    
    def _calculate_text_quality(self, entry: Dict[str, Any]) -> float:
        """Calculate text quality score (0-100)"""
        score = 0.0
        
        # Check German content (primary language)
        content_de = self._get_multilingual_field(entry, 'content', 'de')
        if content_de:
            length = len(content_de)
            # Score based on content length (sweet spot: 200-2000 chars)
            if length >= 200:
                score += 50.0
            elif length >= 100:
                score += 30.0
            elif length >= 50:
                score += 15.0
        
        # Has meaningful summary
        summary_de = self._get_multilingual_field(entry, 'summary', 'de')
        if summary_de and len(summary_de) >= 50:
            score += 50.0
        elif summary_de:
            score += 25.0
        
        return score
    
    def _calculate_language_availability(self, entry: Dict[str, Any]) -> float:
        """Calculate language availability score (0-100)"""
        languages = ['de', 'en', 'easy_de']
        available = set()
        
        # Check which languages have content
        for field in ['title', 'summary', 'content']:
            if field in entry and isinstance(entry[field], dict):
                for lang in languages:
                    if entry[field].get(lang):
                        available.add(lang)
        
        # Score based on language diversity
        if len(available) == 3:
            return 100.0
        elif len(available) == 2:
            return 70.0
        elif len(available) == 1:
            return 40.0
        else:
            return 0.0
    
    def _has_value(self, entry: Dict[str, Any], field: str) -> bool:
        """Check if a field has a non-empty value"""
        value = entry.get(field)
        if value is None:
            return False
        if isinstance(value, (str, list, dict)):
            return bool(value)
        return True
    
    def _has_multilingual_field(self, entry: Dict[str, Any], field: str) -> bool:
        """Check if a multilingual field has at least one language"""
        value = entry.get(field)
        if not isinstance(value, dict):
            return False
        return any(value.get(lang) for lang in ['de', 'en', 'easy_de'])
    
    def _get_multilingual_field(self, entry: Dict[str, Any], field: str, lang: str) -> Optional[str]:
        """Get a specific language from a multilingual field"""
        value = entry.get(field)
        if isinstance(value, dict):
            return value.get(lang)
        return None
