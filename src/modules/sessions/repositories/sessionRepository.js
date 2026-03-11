import { query } from "../db/postgresClient.js";

export async function createSessionRecord({ id, name, status = "created" }) {
  const result = await query(
    `
      INSERT INTO whatsapp_sessions (id, name, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [id, name, status]
  );

  return result.rows[0];
}

export async function listSessionRecords() {
  const result = await query(
    `
      SELECT *
      FROM whatsapp_sessions
      ORDER BY created_at DESC
    `
  );

  return result.rows;
}

export async function getSessionRecordById(id) {
  const result = await query(
    `
      SELECT *
      FROM whatsapp_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function updateSessionStatus(id, status) {
  const result = await query(
    `
      UPDATE whatsapp_sessions
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] ?? null;
}

export async function updateSessionQr(id, qrCode) {
  const result = await query(
    `
      UPDATE whatsapp_sessions
      SET qr_code = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, qrCode]
  );

  return result.rows[0] ?? null;
}

export async function markSessionConnected(id, phoneNumber = null) {
  const result = await query(
    `
      UPDATE whatsapp_sessions
      SET status = 'connected',
          phone_number = COALESCE($2, phone_number),
          qr_code = NULL,
          last_connected_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, phoneNumber]
  );

  return result.rows[0] ?? null;
}

export async function deleteSessionRecord(id) {
  await query(
    `
      DELETE FROM whatsapp_sessions
      WHERE id = $1
    `,
    [id]
  );
}
