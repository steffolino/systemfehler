if __name__ == "__main__":
    import sys
    import pprint
    # Example usage: python validator.py <entry_json_file> <domain>
    if len(sys.argv) < 3:
        print("Usage: python validator.py <entry_json_file> <domain>")
        sys.exit(1)
    entry_file = sys.argv[1]
    domain = sys.argv[2]
    with open(entry_file, 'r', encoding='utf-8') as f:
        entry = json.load(f)
    validator = SchemaValidator()
    result = validator.validate_entry(entry, domain)
    print("\nValidation Result:")
    pprint.pprint(result)
    if not result['valid']:
        print("\nErrors:")
        for err in result['errors']:
            print(f"  ❌ {err}")
    if result['warnings']:
        print("\nWarnings:")
        for warn in result['warnings']:
            print(f"  ⚠️  {warn}")
"""
Systemfehler Schema Validator

Validates crawled entries against JSON schemas.
Integrates with existing schema files in data/_schemas/
"""

from encodings import undefined
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

import jsonschema
from jsonschema import Draft7Validator, RefResolver


class SchemaValidator:
    """
    Validates entries against core and extension schemas
    """

    def check_field_name_mismatches(self, entry: Dict[str, Any], domain: str) -> List[str]:
        """
        Warn if entry fields do not match schema fields (case or underscore/camel mismatch).
        """
        errors = []
        allowed = set(self._allowed_core_fields)
        allowed.update(self._allowed_extension_fields.get(domain, set()))
        for key in entry.keys():
            if key not in allowed:
                # Suggest possible match if only case/underscore differs
                for allowed_key in allowed:
                    if key.lower().replace('_', '') == allowed_key.lower().replace('_', ''):
                        errors.append(f"Field name mismatch: entry uses '{key}', schema expects '{allowed_key}'")
        return errors
    
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
        self._allowed_core_fields = set(self.core_schema.get('properties', {}).keys())
        self._allowed_extension_fields = {
            domain: set(schema.get('properties', {}).keys())
            for domain, schema in self.extension_schemas.items()
        }
        # Build a resolver store to avoid remote $ref lookups for known schemas
        self._schema_store = {}
        try:
            core_id = self.core_schema.get('$id')
            if core_id:
                self._schema_store[core_id] = self.core_schema
        except Exception:
            pass
        for s in self.extension_schemas.values():
            try:
                sid = s.get('$id')
                if sid:
                    self._schema_store[sid] = s
            except Exception:
                continue
    
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

        unknown_key_errors = self._validate_unknown_top_level_keys(entry, domain)
        if unknown_key_errors:
            result['valid'] = False
            result['errors'].extend(unknown_key_errors)

        # Field name mismatch check
        mismatch_errors = self.check_field_name_mismatches(entry, domain)
        if mismatch_errors:
            result['valid'] = False
            result['errors'].extend(mismatch_errors)

        structure_errors = self._validate_translations_and_provenance_structure(entry)
        if structure_errors:
            result['valid'] = False
            result['errors'].extend(structure_errors)
        
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

    def _validate_unknown_top_level_keys(self, entry: Dict[str, Any], domain: str) -> List[str]:
        """Reject unknown top-level keys for a domain entry."""
        if not isinstance(entry, dict):
            return ["root: Entry must be an object"]

        allowed = set(self._allowed_core_fields)
        allowed.update(self._allowed_extension_fields.get(domain, set()))

        unknown = sorted(key for key in entry.keys() if key not in allowed)
        if not unknown:
            return []

        return [f"root: Unknown top-level field '{key}'" for key in unknown]

    def _validate_translations_and_provenance_structure(self, entry: Dict[str, Any]) -> List[str]:
        """Run strict structural checks for translations and provenance payloads."""
        errors = []

        provenance = entry.get('provenance')
        if provenance is not None and not isinstance(provenance, dict):
            errors.append("provenance: Must be an object")

        translations = entry.get('translations')
        if translations is not None and translations is not undefined:
            if not isinstance(translations, dict):
                errors.append("translations: Must be an object")
                return errors

            for lang, payload in translations.items():
                if not isinstance(payload, dict):
                    errors.append(f"translations.{lang}: Must be an object")
                    continue

                for required in ('title', 'timestamp', 'provenance'):
                    if required not in payload:
                        errors.append(f"translations.{lang}.{required}: Missing required field")

                t_provenance = payload.get('provenance')
                if t_provenance is not None and not isinstance(t_provenance, dict):
                    errors.append(f"translations.{lang}.provenance: Must be an object")

                allowed_translation_fields = {
                    'title',
                    'summary',
                    'body',
                    'provenance',
                    'method',
                    'generator',
                    'timestamp',
                    'reviewed'
                }
                for key in payload.keys():
                    if key not in allowed_translation_fields:
                        errors.append(f"translations.{lang}: Unknown field '{key}'")

        return errors
    
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
                referrer=schema,
                store=self._schema_store
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
