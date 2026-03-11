import { Pool } from "pg";

const pool = new Pool(buildConnectionConfig());

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function closePool() {
  await pool.end();
}

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: buildSslConfig(),
    };
  }

  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD ?? "postgres",
    database: process.env.PGDATABASE ?? "chat_whatsapp_ai",
    ssl: buildSslConfig(),
  };
}

function buildSslConfig() {
  if (process.env.PGSSL === "true") {
    return { rejectUnauthorized: false };
  }

  return undefined;
}
