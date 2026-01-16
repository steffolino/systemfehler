"""
Systemfehler Diff Generator

Generates field-by-field differences between entry versions.
Used for moderation queue to highlight changes.
"""

from typing import Dict, Any, List, Optional


class DiffGenerator:
    """Generate structured diffs between entries"""
    
    def generate_diff(self, old_entry: Optional[Dict[str, Any]], 
                     new_entry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a structured diff between two entries
        
        Args:
            old_entry: Existing entry (None for new entries)
            new_entry: New/updated entry
            
        Returns:
            Diff structure with added, modified, removed, and unchanged fields
        """
        if old_entry is None:
            return self._generate_create_diff(new_entry)
        
        return self._generate_update_diff(old_entry, new_entry)
    
    def _generate_create_diff(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Generate diff for a new entry"""
        return {
            'type': 'create',
            'added': self._flatten_entry(entry),
            'modified': {},
            'removed': {},
            'unchanged': {}
        }
    
    def _generate_update_diff(self, old_entry: Dict[str, Any], 
                             new_entry: Dict[str, Any]) -> Dict[str, Any]:
        """Generate diff for an updated entry"""
        diff = {
            'type': 'update',
            'added': {},
            'modified': {},
            'removed': {},
            'unchanged': {}
        }
        
        # Get all unique keys from both entries
        old_flat = self._flatten_entry(old_entry)
        new_flat = self._flatten_entry(new_entry)
        
        all_keys = set(old_flat.keys()) | set(new_flat.keys())
        
        for key in all_keys:
            old_value = old_flat.get(key)
            new_value = new_flat.get(key)
            
            if key not in old_flat:
                # Field was added
                diff['added'][key] = new_value
            elif key not in new_flat:
                # Field was removed
                diff['removed'][key] = old_value
            elif old_value != new_value:
                # Field was modified
                diff['modified'][key] = {
                    'old': old_value,
                    'new': new_value
                }
            else:
                # Field unchanged
                diff['unchanged'][key] = old_value
        
        return diff
    
    def _flatten_entry(self, entry: Dict[str, Any], prefix: str = '') -> Dict[str, Any]:
        """
        Flatten nested entry structure for easier comparison
        
        Args:
            entry: Entry to flatten
            prefix: Key prefix for nested fields
            
        Returns:
            Flattened dictionary
        """
        flat = {}
        
        for key, value in entry.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                # Recursively flatten nested dicts
                nested = self._flatten_entry(value, full_key)
                flat.update(nested)
            elif isinstance(value, list):
                # Convert lists to string representation
                flat[full_key] = str(value)
            elif value is not None:
                flat[full_key] = str(value)
        
        return flat
    
    def format_diff_text(self, diff: Dict[str, Any]) -> str:
        """
        Format diff as human-readable text
        
        Args:
            diff: Diff structure
            
        Returns:
            Formatted text representation
        """
        lines = []
        
        if diff['type'] == 'create':
            lines.append("NEW ENTRY")
            lines.append("=" * 60)
            for key, value in diff['added'].items():
                lines.append(f"+ {key}: {value}")
        else:
            lines.append("ENTRY UPDATE")
            lines.append("=" * 60)
            
            if diff['added']:
                lines.append("\nAdded Fields:")
                lines.append("-" * 60)
                for key, value in diff['added'].items():
                    lines.append(f"+ {key}: {value}")
            
            if diff['modified']:
                lines.append("\nModified Fields:")
                lines.append("-" * 60)
                for key, change in diff['modified'].items():
                    lines.append(f"~ {key}:")
                    lines.append(f"  OLD: {change['old']}")
                    lines.append(f"  NEW: {change['new']}")
            
            if diff['removed']:
                lines.append("\nRemoved Fields:")
                lines.append("-" * 60)
                for key, value in diff['removed'].items():
                    lines.append(f"- {key}: {value}")
        
        return '\n'.join(lines)
    
    def get_diff_summary(self, diff: Dict[str, Any]) -> Dict[str, int]:
        """
        Get summary statistics for a diff
        
        Args:
            diff: Diff structure
            
        Returns:
            Summary with counts
        """
        return {
            'type': diff['type'],
            'added_count': len(diff['added']),
            'modified_count': len(diff['modified']),
            'removed_count': len(diff['removed']),
            'unchanged_count': len(diff['unchanged']),
            'total_changes': len(diff['added']) + len(diff['modified']) + len(diff['removed'])
        }
    
    def highlight_important_changes(self, diff: Dict[str, Any]) -> List[str]:
        """
        Identify important changes that need attention
        
        Args:
            diff: Diff structure
            
        Returns:
            List of important change descriptions
        """
        important = []
        
        # Check for critical field changes
        critical_fields = [
            'title.de', 'url', 'status', 'benefitAmount', 
            'eligibilityCriteria', 'deadline', 'validUntil'
        ]
        
        for field in critical_fields:
            if field in diff['added']:
                important.append(f"Added critical field: {field}")
            elif field in diff['modified']:
                important.append(f"Modified critical field: {field}")
            elif field in diff['removed']:
                important.append(f"Removed critical field: {field}")
        
        # Check for translation losses
        for key in diff['removed']:
            if any(lang in key for lang in ['.en', '.easy_de']):
                important.append(f"Translation removed: {key}")
        
        # Check for status changes
        if 'status' in diff['modified']:
            old_status = diff['modified']['status']['old']
            new_status = diff['modified']['status']['new']
            important.append(f"Status changed: {old_status} → {new_status}")
        
        return important
