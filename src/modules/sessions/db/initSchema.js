import { query } from "./postgresClient.js";

export async function initializeSessionsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      qr_code TEXT,
      phone_number TEXT,
      last_connected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_chats (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      chat_name TEXT,
      last_message TEXT,
      last_message_at TIMESTAMPTZ,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, chat_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      from_number TEXT,
      to_number TEXT,
      body TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
