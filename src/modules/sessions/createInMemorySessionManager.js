import WhatsAppSessionManager from "./WhatsAppSessionManager.js";

export function createInMemorySessionManager(options = {}) {
  const sessions = new Map();
  const chats = new Map();
  const messages = new Map();
  let chatIdSequence = 1;
  let messageIdSequence = 1;

  const sessionRepository = {
    async createSessionRecord({ id, name, status = "created" }) {
      const now = new Date();
      const record = {
        id,
        name,
        status,
        qr_code: null,
        phone_number: null,
        last_connected_at: null,
        created_at: now,
        updated_at: now,
      };

      sessions.set(id, record);
      return clone(record);
    },
    async listSessionRecords() {
      return [...sessions.values()]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(clone);
    },
    async getSessionRecordById(id) {
      const record = sessions.get(id);
      return record ? clone(record) : null;
    },
    async updateSessionStatus(id, status) {
      const record = sessions.get(id);
      if (!record) {
        return null;
      }

      record.status = status;
      record.updated_at = new Date();
      return clone(record);
    },
    async updateSessionQr(id, qrCode) {
      const record = sessions.get(id);
      if (!record) {
        return null;
      }

      record.qr_code = qrCode;
      record.updated_at = new Date();
      return clone(record);
    },
    async markSessionConnected(id, phoneNumber = null) {
      const record = sessions.get(id);
      if (!record) {
        return null;
      }

      record.status = "connected";
      record.phone_number = phoneNumber ?? record.phone_number;
      record.qr_code = null;
      record.last_connected_at = new Date();
      record.updated_at = new Date();
      return clone(record);
    },
    async deleteSessionRecord(id) {
      sessions.delete(id);
      chats.delete(id);
      messages.delete(id);
    },
  };

  const chatRepository = {
    async upsertChatRecord({
      sessionId,
      chatId,
      chatName,
      lastMessage,
      unreadCount,
      lastMessageAt = new Date(),
    }) {
      if (!chats.has(sessionId)) {
        chats.set(sessionId, new Map());
      }

      const sessionChats = chats.get(sessionId);
      const existing = sessionChats.get(chatId);

      const record = {
        id: existing?.id ?? chatIdSequence++,
        session_id: sessionId,
        chat_id: chatId,
        chat_name: chatName ?? existing?.chat_name ?? null,
        last_message: lastMessage ?? existing?.last_message ?? null,
        last_message_at: lastMessageAt ?? existing?.last_message_at ?? null,
        unread_count: unreadCount ?? existing?.unread_count ?? 0,
        created_at: existing?.created_at ?? new Date(),
        updated_at: new Date(),
      };

      sessionChats.set(chatId, record);
      return clone(record);
    },
    async listChatRecordsBySession(sessionId) {
      const sessionChats = chats.get(sessionId);
      if (!sessionChats) {
        return [];
      }

      return [...sessionChats.values()]
        .sort((a, b) => new Date(b.last_message_at ?? b.updated_at) - new Date(a.last_message_at ?? a.updated_at))
        .map(clone);
    },
    async createMessageRecord({
      sessionId,
      chatId,
      direction,
      fromNumber,
      toNumber,
      body,
      payload,
    }) {
      if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
      }

      const record = {
        id: messageIdSequence++,
        session_id: sessionId,
        chat_id: chatId,
        direction,
        from_number: fromNumber,
        to_number: toNumber,
        body,
        payload: payload ?? null,
        created_at: new Date(),
      };

      messages.get(sessionId).push(record);
      return clone(record);
    },
    async listMessageRecordsByChat({ sessionId, chatId, limit = 50 }) {
      const sessionMessages = messages.get(sessionId) ?? [];

      return sessionMessages
        .filter((item) => item.chat_id === chatId)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(clone);
    },
  };

  return new WhatsAppSessionManager({
    sessionRepository,
    chatRepository,
    onIncomingMessage: options.onIncomingMessage,
  });
}

function clone(value) {
  return structuredClone(value);
}
