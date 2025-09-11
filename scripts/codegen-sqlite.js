// Auto-generated from migrations/*.sql
// Run: npm run db:codegen-sqlite

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const OUT_FILE = path.join(__dirname, '../src/types/db.d.ts');

function parseSqlType(sqlType) {
  sqlType = sqlType.toLowerCase();
  if (sqlType.includes('int')) return 'number';
  if (sqlType.includes('real') || sqlType.includes('float') || sqlType.includes('double')) return 'number';
  if (sqlType.includes('text') || sqlType.includes('char') || sqlType.includes('clob')) return 'string';
  if (sqlType.includes('blob')) return 'Buffer';
  return 'any';
}

function extractTables(sql) {
  const tableRegex = /create table if not exists ([^(\s]+) \(([^;]+)\);/gi;
  const tables = [];
  let match;
  while ((match = tableRegex.exec(sql))) {
    const tableName = match[1];
    const columnsRaw = match[2];
    const columns = columnsRaw.split(',').map(col => col.trim()).filter(Boolean);
    const fields = columns.map(col => {
      const parts = col.split(/\s+/);
      const name = parts[0];
      const type = parts[1] ? parseSqlType(parts[1]) : 'any';
      return { name, type };
    });
    tables.push({ tableName, fields });
  }
  return tables;
}

function generateTypes(tables) {
  let out = '// Auto-generated from migrations/*.sql\n\n';
  tables.forEach(({ tableName, fields }) => {
    out += `export interface ${tableName} {\n`;
    fields.forEach(({ name, type }) => {
      out += `  ${name}: ${type};\n`;
    });
    out += '}\n\n';
  });
  out += 'export interface DB {\n';
  tables.forEach(({ tableName }) => {
    out += `  ${tableName}: ${tableName};\n`;
  });
  out += '}\n';
  return out;
}

function main() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  let sql = '';
  files.forEach(f => {
    sql += fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') + '\n';
  });
  const tables = extractTables(sql);
  const types = generateTypes(tables);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, types);
  console.log('TypeScript types generated at', OUT_FILE);
}

if (require.main === module) main();
