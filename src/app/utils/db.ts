import { Pool } from 'pg';

// Create a connection pool
let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const supabasePassword = process.env.SUPABASE_DB_PASSWORD;
    
    if (!supabasePassword) {
      console.error('SUPABASE_DB_PASSWORD is not set. Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
      throw new Error('SUPABASE_DB_PASSWORD environment variable is not set');
    }

    // Use connection pooler as specified by user
    // Format: postgresql://postgres.[ref]:[PASSWORD]@aws-[#]-[region].pooler.supabase.com:6543/postgres
    // Note: Password should be URL-encoded, but some special characters might need different handling
    const encodedPassword = encodeURIComponent(supabasePassword);
    const projectRef = 'wnazcizhbqjxvbyffyhp';
    const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;

    console.log('Creating database pool');
    console.log('Connection string (password hidden):', connectionString.replace(/:[^:@]+@/, ':****@'));
    console.log('Host: aws-1-eu-west-1.pooler.supabase.com');
    console.log('Port: 6543 (connection pooler)');
    console.log('Username: postgres.wnazcizhbqjxvbyffyhp');
    console.log('Password length:', supabasePassword.length);
    console.log('Password encoded length:', encodedPassword.length);

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
}

// Helper function to execute queries
export async function query(text: string, params?: any[]) {
  const db = getDbPool();
  const start = Date.now();
  try {
    const res = await db.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}
