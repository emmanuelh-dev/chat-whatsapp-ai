import { query } from "../db/postgresClient.js";

export async function upsertChatRecord({
  sessionId,
  chatId,
  chatName,
  lastMessage,
  unreadCount,
  lastMessageAt = new Date(),
}) {
  const result = await query(
    `
      INSERT INTO whatsapp_chats (
        session_id,
        chat_id,
        chat_name,
        last_message,
        unread_count,
        last_message_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (session_id, chat_id)
      DO UPDATE SET
        chat_name = COALESCE(EXCLUDED.chat_name, whatsapp_chats.chat_name),
        last_message = COALESCE(EXCLUDED.last_message, whatsapp_chats.last_message),
        unread_count = COALESCE(EXCLUDED.unread_count, whatsapp_chats.unread_count),
        last_message_at = COALESCE(EXCLUDED.last_message_at, whatsapp_chats.last_message_at),
        updated_at = NOW()
      RETURNING *
    `,
    [sessionId, chatId, chatName, lastMessage, unreadCount, lastMessageAt]
  );

  return result.rows[0];
}

export async function listChatRecordsBySession(sessionId) {
  const result = await query(
    `
      SELECT *
      FROM whatsapp_chats
      WHERE session_id = $1
      ORDER BY COALESCE(last_message_at, updated_at) DESC
    `,
    [sessionId]
  );

  return result.rows;
}

export async function createMessageRecord({
  sessionId,
  chatId,
  direction,
  fromNumber,
  toNumber,
  body,
  payload,
}) {
  const result = await query(
    `
      INSERT INTO whatsapp_messages (
        session_id,
        chat_id,
        direction,
        from_number,
        to_number,
        body,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [sessionId, chatId, direction, fromNumber, toNumber, body, payload ?? null]
  );

  return result.rows[0];
}

export async function listMessageRecordsByChat({ sessionId, chatId, limit = 50 }) {
  const result = await query(
    `
      SELECT *
      FROM whatsapp_messages
      WHERE session_id = $1
        AND chat_id = $2
      ORDER BY id DESC
      LIMIT $3
    `,
    [sessionId, chatId, limit]
  );

  return result.rows;
}
