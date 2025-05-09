import { Pool } from 'pg';

// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'postgres',
});

export async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const text = strings.reduce((acc, str, i) => {
    return acc + str + (i < values.length ? `$${i + 1}` : '');
  }, '');

  const res = await pool.query(text, values);
  return res;
}

export async function query(text: string, params: any[] = []) {
  const res = await pool.query(text, params);
  return res;
}

export { pool }; 