import { randomUUID } from "node:crypto";
import pkg from "whatsapp-web.js";
import QRCode from "qrcode";
import { logger } from "../../utils/logger.js";

const { Client, LocalAuth } = pkg;
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '52';

export default class WhatsAppSessionManager {
  constructor({ sessionRepository, chatRepository, onIncomingMessage }) {
    this.sessionRepository = sessionRepository;
    this.chatRepository = chatRepository;
    this.onIncomingMessage = onIncomingMessage;
    this.clients = new Map();
  }

  async createSession({ name, sessionId }) {
    logger.info('SessionManager.createSession called', { name, sessionId });
    const id = sessionId?.trim() || randomUUID();
    const existingSession = await this.sessionRepository.getSessionRecordById(id);

    if (existingSession) {
      logger.info('Session already exists by id', { sessionId: id });
      return existingSession;
    }

    const created = await this.sessionRepository.createSessionRecord({ id, name: name || `Session ${id.slice(0, 8)}` });
    logger.info('Session created in repository', { sessionId: created.id, name: created.name });
    return created;
  }

  async startSession(sessionId) {
    logger.info('SessionManager.startSession called', { sessionId });
    const session = await this.sessionRepository.getSessionRecordById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (this.clients.has(sessionId)) {
      logger.info('Session already running in memory', { sessionId });
      return session;
    }

    const client = this.createWhatsAppClient(sessionId);
    this.registerClientEvents(client, sessionId);

    this.clients.set(sessionId, client);
    await this.sessionRepository.updateSessionStatus(sessionId, "initializing");
    client.initialize();
    logger.info('Session initialization requested', { sessionId });
    return this.sessionRepository.getSessionRecordById(sessionId);
  }

  async stopSession(sessionId) {
    logger.info('SessionManager.stopSession called', { sessionId });
    const client = this.clients.get(sessionId);
    if (client) {
      await client.destroy();
      this.clients.delete(sessionId);
      logger.info('Session client destroyed', { sessionId });
    }

    return this.sessionRepository.updateSessionStatus(sessionId, "stopped");
  }

  async deleteSession(sessionId) {
    logger.info('SessionManager.deleteSession called', { sessionId });
    await this.stopSession(sessionId);
    await this.sessionRepository.deleteSessionRecord(sessionId);
    logger.info('Session removed from repository', { sessionId });
  }

  async listSessions() {
    return this.sessionRepository.listSessionRecords();
  }

  async getSessionById(sessionId) {
    return this.sessionRepository.getSessionRecordById(sessionId);
  }

  async getSessionQr(sessionId) {
    const session = await this.sessionRepository.getSessionRecordById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session.qr_code;
  }

  async sendMessage({ sessionId, number, message }) {
    logger.info('SessionManager.sendMessage called', { sessionId, number, messageLength: message?.length });
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error("Session is not initialized");
    }

    const chatId = await this.resolveChatId(client, number);
    logger.info('SessionManager.sendMessage resolved chatId', { sessionId, number, chatId });
    const response = await client.sendMessage(chatId, message);

    await this.chatRepository.createMessageRecord({
      sessionId,
      chatId,
      direction: "out",
      fromNumber: sessionId,
      toNumber: chatId,
      body: message,
      payload: response,
    });

    await this.chatRepository.upsertChatRecord({
      sessionId,
      chatId,
      chatName: chatId,
      lastMessage: message,
      unreadCount: 0,
      lastMessageAt: new Date(),
    });

    logger.info('SessionManager.sendMessage completed', { sessionId, chatId });

    return response;
  }

  async resolveChatId(client, rawNumber) {
    if (typeof rawNumber !== 'string' || !rawNumber.trim()) {
      throw new Error('invalid_number');
    }

    if (rawNumber.includes('@')) {
      return rawNumber;
    }

    const normalized = this.normalizeNumber(rawNumber);

    if (!normalized) {
      throw new Error('invalid_number');
    }

    const numberId = await client.getNumberId(normalized);

    if (!numberId?._serialized) {
      throw new Error('number_not_registered_or_invalid');
    }

    return numberId._serialized;
  }

  normalizeNumber(rawNumber) {
    let digits = rawNumber.replace(/\D/g, '');

    if (!digits) {
      return '';
    }

    if (digits.length === 10) {
      digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
    }

    return digits;
  }

  async listChats(sessionId) {
    return this.chatRepository.listChatRecordsBySession(sessionId);
  }

  async listMessages({ sessionId, chatId, limit }) {
    return this.chatRepository.listMessageRecordsByChat({ sessionId, chatId, limit });
  }

  async shutdown() {
    const sessionIds = [...this.clients.keys()];
    await Promise.all(sessionIds.map((sessionId) => this.stopSession(sessionId)));
  }

  createWhatsAppClient(sessionId) {
    const dataPath = process.env.WHATSAPP_AUTH_PATH || ".wwebjs_auth";

    return new Client({
      authStrategy: new LocalAuth({ clientId: sessionId, dataPath }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });
  }

  registerClientEvents(client, sessionId) {
    logger.info('Registering WhatsApp client events', { sessionId });
    client.on("qr", async (qr) => {
      try {
        const qrCode = await QRCode.toDataURL(qr);
        await this.sessionRepository.updateSessionQr(sessionId, qrCode);
        await this.sessionRepository.updateSessionStatus(sessionId, "qr_ready");
        logger.info('QR generated for session', { sessionId });
      } catch (error) {
        logger.error("Failed to generate QR code", error);
      }
    });

    client.on("authenticated", async () => {
      await this.sessionRepository.updateSessionStatus(sessionId, "authenticated");
      logger.info('Session authenticated', { sessionId });
    });

    client.on("ready", async () => {
      const info = client.info;
      const number = info?.wid?._serialized || null;
      await this.sessionRepository.markSessionConnected(sessionId, number);
      logger.info("WhatsApp session ready", { sessionId, number });
    });

    client.on("disconnected", async (reason) => {
      await this.sessionRepository.updateSessionStatus(sessionId, "disconnected");
      this.clients.delete(sessionId);
      logger.warn("WhatsApp session disconnected", { sessionId, reason });
    });

    client.on("auth_failure", async (reason) => {
      await this.sessionRepository.updateSessionStatus(sessionId, "auth_failure");
      logger.error("WhatsApp session auth failure", new Error(String(reason)));
    });

    client.on("message", async (message) => {
      try {
        const chatId = message.from;
        const body = message.body ?? "";

        await this.chatRepository.createMessageRecord({
          sessionId,
          chatId,
          direction: "in",
          fromNumber: message.from,
          toNumber: message.to,
          body,
          payload: message,
        });

        await this.chatRepository.upsertChatRecord({
          sessionId,
          chatId,
          chatName: chatId,
          lastMessage: body,
          unreadCount: 0,
          lastMessageAt: new Date(Number(message.timestamp) * 1000 || Date.now()),
        });

        if (this.onIncomingMessage) {
          logger.info('Dispatching incoming message callback', { sessionId, chatId });
          await this.onIncomingMessage({
            sessionId,
            chatId,
            message,
          });
        }
      } catch (error) {
        logger.error("Failed to persist incoming message", error);
      }
    });
  }
}
