"""
Systemfehler Schema Validator

Validates crawled entries against JSON schemas.
Integrates with existing schema files in data/_schemas/
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

import jsonschema
from jsonschema import Draft7Validator, RefResolver


class SchemaValidator:
    """Validates entries against core and extension schemas"""
    
    def __init__(self, schemas_dir: Optional[str] = None):
        """
        Initialize validator with schema directory
        
        Args:
            schemas_dir: Path to schemas directory (defaults to data/_schemas)
        """
        if schemas_dir is None:
            # Assume we're running from project root
            schemas_dir = os.path.join(os.getcwd(), 'data', '_schemas')
        
        self.schemas_dir = Path(schemas_dir)
        self.core_schema = self._load_schema('core.schema.json')
        self.extension_schemas = self._load_extension_schemas()
    
    def _load_schema(self, schema_file: str) -> Dict[str, Any]:
        """Load a JSON schema file"""
        schema_path = self.schemas_dir / schema_file
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _load_extension_schemas(self) -> Dict[str, Dict[str, Any]]:
        """Load all extension schemas"""
        extensions_dir = self.schemas_dir / 'extensions'
        schemas = {}
        
        for schema_file in extensions_dir.glob('*.schema.json'):
            domain = schema_file.stem.replace('.schema', '')
            schemas[domain] = self._load_schema(f'extensions/{schema_file.name}')
        
        return schemas
    
    def validate_entry(self, entry: Dict[str, Any], domain: str) -> Dict[str, Any]:
        """
        Validate an entry against core and domain-specific schemas
        
        Args:
            entry: Entry data to validate
            domain: Domain type (benefits, aid, tools, etc.)
            
        Returns:
            Validation result with errors and warnings
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        # First validate against core schema
        core_errors = self._validate_against_schema(entry, self.core_schema)
        if core_errors:
            result['valid'] = False
            result['errors'].extend(core_errors)
        
        # Then validate against extension schema if it exists
        if domain in self.extension_schemas:
            extension_errors = self._validate_against_schema(
                entry,
                self.extension_schemas[domain]
            )
            if extension_errors:
                result['valid'] = False
                result['errors'].extend(extension_errors)
        
        # Add warnings for missing recommended fields
        warnings = self._check_recommended_fields(entry, domain)
        if warnings:
            result['warnings'].extend(warnings)
        
        return result
    
    def _validate_against_schema(self, data: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """
        Validate data against a schema
        
        Args:
            data: Data to validate
            schema: JSON schema
            
        Returns:
            List of error messages
        """
        errors = []
        
        try:
            # Create a validator with resolver for $ref support
            resolver = RefResolver(
                base_uri=f"file://{self.schemas_dir}/",
                referrer=schema
            )
            validator = Draft7Validator(schema, resolver=resolver)
            
            # Collect all validation errors
            for error in validator.iter_errors(data):
                error_path = '.'.join(str(p) for p in error.path) if error.path else 'root'
                errors.append(f"{error_path}: {error.message}")
        
        except jsonschema.exceptions.SchemaError as e:
            errors.append(f"Schema error: {e.message}")
        
        return errors
    
    def _check_recommended_fields(self, entry: Dict[str, Any], domain: str) -> List[str]:
        """
        Check for missing recommended fields
        
        Args:
            entry: Entry data
            domain: Domain type
            
        Returns:
            List of warning messages
        """
        warnings = []
        
        # Check for multilingual completeness
        multilingual_fields = ['title', 'summary', 'content']
        languages = ['de', 'en', 'easy_de']

        for field in multilingual_fields:
            if field in entry and isinstance(entry[field], dict):
                for lang in languages:
                    if lang not in entry[field] or not entry[field][lang]:
                        warnings.append(f"Missing {lang} translation for {field}")

        # Check for translations/simplifications (e.g. de-LEICHT)
        if 'translations' not in entry or not isinstance(entry['translations'], dict) or len(entry['translations']) == 0:
            warnings.append("No translations recorded (consider generating de-LEICHT / other languages)")
        else:
            # Prefer presence of Easy German variant for German entries
            if 'de-LEICHT' not in entry['translations'] and 'easy_de' not in entry.get('title', {}):
                warnings.append("Missing Easy German translation (de-LEICHT) in `translations` or `easy_de` in `title`")
        
        # Check for quality scores
        if 'qualityScores' not in entry or not entry['qualityScores']:
            warnings.append("Missing quality scores (run quality_scorer.py)")
        
        # Check for topics and tags
        if not entry.get('topics'):
            warnings.append("No topics specified")
        
        if not entry.get('tags'):
            warnings.append("No tags specified")
        
        # Domain-specific checks
        if domain == 'benefits':
            if not entry.get('benefitAmount'):
                warnings.append("Missing benefit amount")
            if not entry.get('eligibilityCriteria'):
                warnings.append("Missing eligibility criteria")
        
        return warnings
    
    def validate_batch(self, entries: List[Dict[str, Any]], domain: str) -> Dict[str, Any]:
        """
        Validate a batch of entries
        
        Args:
            entries: List of entries to validate
            domain: Domain type
            
        Returns:
            Batch validation summary
        """
        results = {
            'total': len(entries),
            'valid': 0,
            'invalid': 0,
            'entries': []
        }
        
        for i, entry in enumerate(entries):
            entry_id = entry.get('id', f'entry-{i}')
            validation = self.validate_entry(entry, domain)
            
            results['entries'].append({
                'id': entry_id,
                'valid': validation['valid'],
                'errors': validation['errors'],
                'warnings': validation['warnings']
            })
            
            if validation['valid']:
                results['valid'] += 1
            else:
                results['invalid'] += 1
        
        return results
    
    def generate_validation_report(self, results: Dict[str, Any]) -> str:
        """
        Generate a human-readable validation report
        
        Args:
            results: Batch validation results
            
        Returns:
            Formatted report string
        """
        lines = [
            "=" * 60,
            "Schema Validation Report",
            "=" * 60,
            f"Total entries: {results['total']}",
            f"Valid: {results['valid']}",
            f"Invalid: {results['invalid']}",
            ""
        ]
        
        if results['invalid'] > 0:
            lines.append("Validation Errors:")
            lines.append("-" * 60)
            
            for entry_result in results['entries']:
                if not entry_result['valid']:
                    lines.append(f"\nEntry ID: {entry_result['id']}")
                    for error in entry_result['errors']:
                        lines.append(f"  ❌ {error}")
        
        # Show warnings for all entries
        has_warnings = any(e['warnings'] for e in results['entries'])
        if has_warnings:
            lines.append("\nWarnings:")
            lines.append("-" * 60)
            
            for entry_result in results['entries']:
                if entry_result['warnings']:
                    lines.append(f"\nEntry ID: {entry_result['id']}")
                    for warning in entry_result['warnings']:
                        lines.append(f"  ⚠️  {warning}")
        
        lines.append("\n" + "=" * 60)
        
        return '\n'.join(lines)
