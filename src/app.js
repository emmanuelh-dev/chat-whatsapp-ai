import net from 'node:net';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { logger } from './utils/logger.js';
import { setupEndpoints } from './routes/api.js';
import { PORT } from './config/botConfig.js';
import ConversationManager from './ConversationManager.js';
import { fetchWhatsAppContacts } from './services/whatsappService.js';
import { blacklist } from './data/blacklist.js';
import { initializeSessionsSchema } from './modules/sessions/db/initSchema.js';
import { closePool } from './modules/sessions/db/postgresClient.js';
import { createSessionManager } from './modules/sessions/createSessionManager.js';
import { createInMemorySessionManager } from './modules/sessions/createInMemorySessionManager.js';
import { enqueueOutboundMessage } from './services/outboundQueueService.js';
import { getAIResponse } from './services/aiService.js';
import {
  activateHumanHandoff,
  isHumanHandoffActive,
  refreshHumanHandoff,
  shouldActivateHumanHandoff,
} from './services/humanHandoffService.js';

const HUMAN_HANDOFF_MESSAGE = 'Una persona te responderá en breve.';

const app = express();
app.disable('etag');
const conversationManager = new ConversationManager();

let sessionManager = createSessionManager({
  onIncomingMessage: handleIncomingSessionMessage,
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use((req, res, next) => {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();

  req.requestId = requestId;

  logger.info('HTTP request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: summarizeBody(req.body),
  });

  res.on('finish', () => {
    logger.info('HTTP request finished', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

async function startServer() {
  logger.info('Starting WhatsApp custom server', { port: PORT });

  try {
    try {
      await initializeSessionsSchema();
    } catch (error) {
      logger.warn('PostgreSQL not available, using in-memory sessions', { error: error.message });
      sessionManager = createInMemorySessionManager({
        onIncomingMessage: handleIncomingSessionMessage,
      });
    }

    setupEndpoints(app, sessionManager);
    setupErrorHandlers();

    const preferredPort = Number(PORT);
    const selectedPort = await resolveAvailablePort(preferredPort);

    if (selectedPort !== preferredPort) {
      logger.warn('Preferred port is busy, using next available port', {
        preferredPort,
        selectedPort,
      });
    }

    app.listen(selectedPort, () => {
      logger.info(`HTTP server started on port ${selectedPort}`);
      logger.info('WhatsApp custom server is now running', {
        port: selectedPort,
        openaiModel: 'gpt-4o-mini',
        time: new Date().toISOString(),
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

async function handleIncomingSessionMessage({ sessionId, chatId, message }) {
  try {
    logger.info('Incoming WhatsApp message received', {
      sessionId,
      chatId,
      hasBody: Boolean(message.body),
      messageType: message.type,
    });

    if (!chatId.endsWith('@c.us')) {
      logger.info('Ignoring non-user chat message', { sessionId, chatId });
      return;
    }

    const body = (message.body ?? '').trim();
    if (!body) {
      logger.info('Ignoring empty incoming message', { sessionId, chatId });
      return;
    }

    const userId = chatId;

    if (await shouldIgnoreIncomingMessage(userId)) {
      logger.info('Incoming message ignored by blacklist', { sessionId, chatId });
      return;
    }

    if (shouldActivateHumanHandoff(body)) {
      logger.info('Activating human handoff from incoming message', { sessionId, chatId });
      activateHumanHandoff(userId);
      await enqueueOutboundMessage(
        () => sessionManager.sendMessage({
          sessionId,
          number: chatId,
          message: HUMAN_HANDOFF_MESSAGE,
        }),
        { channel: 'incoming-handoff', sessionId, to: chatId }
      );
      return;
    }

    if (isHumanHandoffActive(userId)) {
      logger.info('Human handoff active, sending waiting message', { sessionId, chatId });
      refreshHumanHandoff(userId);
      await enqueueOutboundMessage(
        () => sessionManager.sendMessage({
          sessionId,
          number: chatId,
          message: HUMAN_HANDOFF_MESSAGE,
        }),
        { channel: 'incoming-handoff', sessionId, to: chatId }
      );
      return;
    }

    const aiResponse = await getAIResponse(userId, body, conversationManager, message._data?.notifyName ?? null);
    logger.info('AI response generated for incoming message', {
      sessionId,
      chatId,
      responseLength: aiResponse?.length ?? 0,
    });

    await enqueueOutboundMessage(
      () => sessionManager.sendMessage({
        sessionId,
        number: chatId,
        message: aiResponse,
      }),
      { channel: 'incoming-ai', sessionId, to: chatId }
    );
  } catch (error) {
    logger.error('Failed to handle incoming session message', error);
  }
}

async function shouldIgnoreIncomingMessage(userId) {
  const userNumber = userId.split('@')[0]?.slice(-10) ?? userId;
  const supabaseBlacklist = await fetchWhatsAppContacts();

  if (blacklist.includes(userNumber) || supabaseBlacklist.includes(userId) || supabaseBlacklist.includes(userNumber)) {
    logger.info('Ignoring incoming message from blacklisted user', { from: userId });
    return true;
  }

  return false;
}

function setupErrorHandlers() {
  process.on('SIGINT', async () => {
    logger.info('Server shutting down...');
    await sessionManager.shutdown();
    await closePool();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason, promise });
  });
}

async function resolveAvailablePort(preferredPort, maxTries = 20) {
  for (let offset = 0; offset < maxTries; offset += 1) {
    const candidatePort = preferredPort + offset;
    const available = await isPortAvailable(candidatePort);

    if (available) {
      return candidatePort;
    }
  }

  throw new Error(`No available port found from ${preferredPort} to ${preferredPort + maxTries - 1}`);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

function summarizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const copy = { ...body };

  if (typeof copy.message === 'string') {
    copy.message = `[len:${copy.message.length}] ${copy.message.slice(0, 40)}`;
  }

  return copy;
}

startServer();
