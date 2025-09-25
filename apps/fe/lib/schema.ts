import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../generated/json-schema/systemfehler.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validate<T>(schemaRef: string, data: unknown): T {
  const validateFn: ValidateFunction | undefined = ajv.getSchema(schemaRef) || ajv.compile({ $ref: schemaRef, ...schema });
  if (!validateFn) throw new Error(`Schema ref not found: ${schemaRef}`);
  const valid = validateFn(data);
  if (!valid) {
    const errors = validateFn.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ');
    throw new Error(`Validation failed for ${schemaRef}: ${errors}`);
  }
  return data as T;
}

export { ajv, schema };
