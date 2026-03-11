import { logger } from '../utils/logger.js';
import { enqueueOutboundMessage } from '../services/outboundQueueService.js';

const runtimeBlacklist = new Set();

export function setupEndpoints(app, sessionManager) {
  setupDashboardEndpoint(app);
  setupMessageEndpoint(app, sessionManager);
  setupRegistrationEndpoint(app);
  setupRealEstateEndpoint(app);
  setupBlacklistEndpoints(app);
  setupSessionEndpoints(app, sessionManager);
}

function setupDashboardEndpoint(app) {
  app.get('/', (_req, res) => {
    logger.info('Dashboard requested');
    res.status(200).type('html').send(buildDashboardHtml());
  });
}

function setupMessageEndpoint(app, sessionManager) {
  app.post('/v1/messages', async (req, res) => {
    const { number, message, sessionId } = req.body;

    logger.info('API request: Send message', {
      sessionId,
      to: number,
      message,
    });

    if (!number || !message) {
      return res.status(400).json({ status: 'error', message: 'number_and_message_required' });
    }

    try {
      const resolvedSessionId = sessionId || process.env.DEFAULT_SESSION_ID;

      if (!resolvedSessionId) {
        return res.status(400).json({
          status: 'error',
          message: 'session_id_required',
        });
      }

      await enqueueOutboundMessage(
        () => sessionManager.sendMessage({
          sessionId: resolvedSessionId,
          number,
          message,
        }),
        {
          channel: 'session-manager',
          sessionId: resolvedSessionId,
          to: number,
        }
      );

      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Failed to send message', error);

      if (error.message === 'number_not_registered_or_invalid') {
        return res.status(400).json({ status: 'error', message: 'number_not_registered_or_invalid' });
      }

      if (error.message === 'invalid_number') {
        return res.status(400).json({ status: 'error', message: 'invalid_number' });
      }

      return res.status(500).json({ status: 'error' });
    }
  });
}

function setupRegistrationEndpoint(app) {
  app.post('/v1/register', async (req, res) => {
    logger.info('API request: registration endpoint hit', { body: req.body });
    return res.status(501).json({ status: 'error', message: 'not_implemented_without_builderbot' });
  });
}

function setupRealEstateEndpoint(app) {
  app.post('/v1/real-estate', async (req, res) => {
    logger.info('API request: real-estate endpoint hit', { body: req.body });
    return res.status(501).json({ status: 'error', message: 'not_implemented_without_builderbot' });
  });
}

function setupBlacklistEndpoints(app) {
  app.post('/v1/blacklist', (req, res) => {
    const { number, intent } = req.body;
    logger.info('API request: Blacklist operation', { number, intent });

    if (!number) {
      return res.status(400).json({ status: 'error', message: 'number_required' });
    }

    switch (intent) {
      case 'remove':
        runtimeBlacklist.delete(number);
        return res.status(200).json({ status: 'ok', number, intent });
      case 'add':
        runtimeBlacklist.add(number);
        return res.status(200).json({ status: 'ok', number, intent });
      case 'check':
        return res.status(200).json({ status: 'ok', number, isBlacklisted: runtimeBlacklist.has(number) });
      default:
        return res.status(400).json({ status: 'error', message: 'invalid_intent' });
    }
  });

  app.get('/v1/blacklist', (_req, res) => {
    logger.info('API request: Get blacklist', { total: runtimeBlacklist.size });
    return res.status(200).json({ status: 'ok', blacklist: [...runtimeBlacklist] });
  });
}

function setupSessionEndpoints(app, sessionManager) {
  app.get('/v1/sessions', async (_req, res) => {
    logger.info('API request: list sessions');
    try {
      const sessions = await sessionManager.listSessions();
      logger.info('Sessions listed', { total: sessions.length });
      return res.status(200).json({ status: 'ok', sessions });
    } catch (error) {
      logger.error('Failed to list sessions', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.get('/v1/sessions/:sessionId', async (req, res) => {
    logger.info('API request: get session', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSessionById(sessionId);

      if (!session) {
        return res.status(404).json({ status: 'error', message: 'session_not_found' });
      }

      return res.status(200).json({ status: 'ok', session });
    } catch (error) {
      logger.error('Failed to get session', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.post('/v1/sessions', async (req, res) => {
    logger.info('API request: create session', {
      name: req.body?.name,
      sessionId: req.body?.sessionId,
      autoStart: req.body?.autoStart,
    });
    try {
      const { name, sessionId, autoStart = true } = req.body;

      if (sessionId) {
        const existingById = await sessionManager.getSessionById(sessionId);
        if (existingById) {
          return res.status(200).json({
            status: 'ok',
            message: 'session_already_exists',
            alreadyExists: true,
            session: existingById,
          });
        }
      }

      if (name) {
        const sessions = await sessionManager.listSessions();
        const existingByName = sessions.find((item) => item.name === name);
        if (existingByName) {
          return res.status(200).json({
            status: 'ok',
            message: 'session_already_exists',
            alreadyExists: true,
            session: existingByName,
          });
        }
      }

      const session = await sessionManager.createSession({ name, sessionId });

      if (autoStart) {
        await sessionManager.startSession(session.id);
      }

      const updatedSession = await sessionManager.getSessionById(session.id);
      logger.info('Session created', { sessionId: updatedSession?.id, status: updatedSession?.status });
      return res.status(201).json({ status: 'ok', alreadyExists: false, session: updatedSession });
    } catch (error) {
      logger.error('Failed to create session', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.post('/v1/sessions/:sessionId/start', async (req, res) => {
    logger.info('API request: start session', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.startSession(sessionId);
      return res.status(200).json({ status: 'ok', session });
    } catch (error) {
      logger.error('Failed to start session', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.post('/v1/sessions/:sessionId/stop', async (req, res) => {
    logger.info('API request: stop session', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.stopSession(sessionId);
      return res.status(200).json({ status: 'ok', session });
    } catch (error) {
      logger.error('Failed to stop session', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.delete('/v1/sessions/:sessionId', async (req, res) => {
    logger.info('API request: delete session', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      await sessionManager.deleteSession(sessionId);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Failed to delete session', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.get('/v1/sessions/:sessionId/qr', async (req, res) => {
    logger.info('API request: get session qr', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      const qr = await sessionManager.getSessionQr(sessionId);
      return res.status(200).json({ status: 'ok', qr });
    } catch (error) {
      logger.error('Failed to get session QR', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.get('/v1/sessions/:sessionId/chats', async (req, res) => {
    logger.info('API request: list session chats', { sessionId: req.params.sessionId });
    try {
      const { sessionId } = req.params;
      const chats = await sessionManager.listChats(sessionId);
      return res.status(200).json({ status: 'ok', chats });
    } catch (error) {
      logger.error('Failed to list chats', error);
      return res.status(500).json({ status: 'error' });
    }
  });

  app.get('/v1/sessions/:sessionId/chats/:chatId/messages', async (req, res) => {
    logger.info('API request: list chat messages', {
      sessionId: req.params.sessionId,
      chatId: req.params.chatId,
      limit: req.query.limit,
    });
    try {
      const { sessionId, chatId } = req.params;
      const limit = Number(req.query.limit ?? 50);
      const messages = await sessionManager.listMessages({ sessionId, chatId, limit });
      return res.status(200).json({ status: 'ok', messages });
    } catch (error) {
      logger.error('Failed to list chat messages', error);
      return res.status(500).json({ status: 'error' });
    }
  });
}

function buildDashboardHtml() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Sessions</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; background: #f6f7f9; color: #1f2937; }
      .container { max-width: 980px; margin: 0 auto; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
      h1 { margin-top: 0; }
      input, select, textarea, button { padding: 10px; border-radius: 8px; border: 1px solid #d1d5db; }
      button { cursor: pointer; background: #111827; color: #fff; border: none; }
      button.secondary { background: #374151; }
      button.warn { background: #b91c1c; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .session { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 10px; background: #fafafa; }
      .meta { color: #4b5563; font-size: 14px; }
      .qr { margin-top: 10px; max-width: 220px; display: none; border: 1px solid #e5e7eb; border-radius: 8px; }
      .mono { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #374151; word-break: break-all; }
      .hint { color: #6b7280; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>Sesiones WhatsApp</h1>
        <p class="hint">Crea una sesión, iníciala y abre el QR. Esta vista usa tu API actual.</p>
        <div class="row">
          <input id="sessionName" placeholder="Nombre de sesión (ej: ventas-1)" />
          <button id="createBtn">Crear sesión</button>
          <button id="refreshBtn" class="secondary">Actualizar</button>
          <span id="createResult" class="hint"></span>
        </div>
      </div>

      <div class="card">
        <h2>Listado</h2>
        <div id="sessions"></div>
      </div>

      <div class="card">
        <h2>Enviar mensaje de prueba</h2>
        <p class="hint">Selecciona sesión activa, número destino y texto.</p>
        <div class="row">
          <select id="sendSessionId"></select>
          <input id="sendNumber" placeholder="Número (ej: 5215512345678)" />
        </div>
        <div class="row" style="margin-top: 8px;">
          <textarea id="sendMessage" rows="3" style="width:100%;" placeholder="Mensaje de prueba"></textarea>
        </div>
        <div class="row" style="margin-top: 8px;">
          <button id="sendBtn">Enviar</button>
          <button id="sendDefaultsBtn" class="secondary">Enviar a números por defecto</button>
          <span id="sendResult" class="hint"></span>
        </div>
        <div class="row" style="margin-top: 8px;">
          <span class="hint">Números por defecto:</span>
          <span id="defaultNumbers" class="mono"></span>
        </div>
      </div>
    </div>

    <script>
      const DEFAULT_TEST_NUMBERS = ['8126060795', '8111913676', '+52 871 551 6230'];

      const sessionsContainer = document.getElementById('sessions');
      const sessionNameInput = document.getElementById('sessionName');
      const createBtn = document.getElementById('createBtn');
      const refreshBtn = document.getElementById('refreshBtn');
      const createResult = document.getElementById('createResult');
      const sendSessionId = document.getElementById('sendSessionId');
      const sendNumber = document.getElementById('sendNumber');
      const sendMessage = document.getElementById('sendMessage');
      const sendBtn = document.getElementById('sendBtn');
      const sendDefaultsBtn = document.getElementById('sendDefaultsBtn');
      const sendResult = document.getElementById('sendResult');
      const defaultNumbers = document.getElementById('defaultNumbers');

      createBtn.addEventListener('click', createSession);
      refreshBtn.addEventListener('click', loadSessions);
      sendBtn.addEventListener('click', sendTestMessage);
      sendDefaultsBtn.addEventListener('click', sendToDefaultNumbers);

      renderDefaultNumbers();

      loadSessions();
      setInterval(loadSessions, 5000);

      async function createSession() {
        const name = sessionNameInput.value.trim();
        if (!name) return;

        const response = await fetch('/v1/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, autoStart: false })
        });

        const payload = await response.json();

        if (payload.alreadyExists) {
          createResult.textContent = 'La sesión ya existe: ' + payload.session.name;
        } else {
          createResult.textContent = 'Sesión creada: ' + (payload.session?.name || name);
        }

        sessionNameInput.value = '';
        await loadSessions();
      }

      async function loadSessions() {
        const response = await fetch('/v1/sessions', { cache: 'no-store' });
        const data = await response.json();
        const sessions = data.sessions || [];

        renderSessionOptions(sessions);

        sessionsContainer.innerHTML = '';

        if (!sessions.length) {
          sessionsContainer.innerHTML = '<p class="hint">No hay sesiones aún.</p>';
          return;
        }

        for (const session of sessions) {
          const node = renderSession(session);
          sessionsContainer.appendChild(node);
        }
      }

      function renderSessionOptions(sessions) {
        sendSessionId.innerHTML = '';

        if (!sessions.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'Sin sesiones disponibles';
          sendSessionId.appendChild(option);
          return;
        }

        for (const session of sessions) {
          const option = document.createElement('option');
          option.value = session.id;
          option.textContent = session.name + ' (' + session.status + ')';
          sendSessionId.appendChild(option);
        }
      }

      async function sendTestMessage() {
        const sessionId = sendSessionId.value;
        const number = sendNumber.value.trim();
        const message = sendMessage.value.trim();

        if (!sessionId || !number || !message) {
          sendResult.textContent = 'Completa sesión, número y mensaje.';
          return;
        }

        sendResult.textContent = 'Enviando...';

        const response = await fetch('/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, number, message })
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));

          if (errorPayload.message === 'number_not_registered_or_invalid') {
            sendResult.textContent = 'El número no está registrado en WhatsApp o no es válido.';
            return;
          }

          if (errorPayload.message === 'invalid_number') {
            sendResult.textContent = 'Número inválido. Usa 10 dígitos o formato internacional.';
            return;
          }

          sendResult.textContent = 'Error al enviar. Verifica que la sesión esté iniciada.';
          return;
        }

        sendMessage.value = '';
        sendResult.textContent = 'Mensaje enviado a la cola.';
      }

      async function sendToDefaultNumbers() {
        const sessionId = sendSessionId.value;
        const message = sendMessage.value.trim();

        if (!sessionId || !message) {
          sendResult.textContent = 'Selecciona sesión y escribe mensaje para envío en lote.';
          return;
        }

        sendResult.textContent = 'Enviando solicitudes en lote...';

        const requests = DEFAULT_TEST_NUMBERS.map((number) =>
          fetch('/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId, number, message })
          })
        );

        const responses = await Promise.all(requests);
        const okCount = responses.filter((response) => response.ok).length;

        if (okCount !== DEFAULT_TEST_NUMBERS.length) {
          sendResult.textContent = 'Algunas solicitudes fallaron (' + okCount + '/' + DEFAULT_TEST_NUMBERS.length + ').';
          return;
        }

        sendResult.textContent = 'Solicitudes encoladas para ' + DEFAULT_TEST_NUMBERS.length + ' números. Deben salir con espera de 5 a 10 segundos.';
      }

      function renderDefaultNumbers() {
        defaultNumbers.textContent = DEFAULT_TEST_NUMBERS.join(' | ');
      }

      function renderSession(session) {
        const wrapper = document.createElement('div');
        wrapper.className = 'session';

        const qrId = 'qr-' + session.id;

        wrapper.innerHTML =
          '<div class="row" style="justify-content: space-between;">' +
            '<strong>' + escapeHtml(session.name) + ' (' + escapeHtml(session.status) + ')</strong>' +
            '<span class="mono">' + escapeHtml(session.id) + '</span>' +
          '</div>' +
          '<div class="meta">Teléfono: ' + escapeHtml(session.phone_number || '-') + '</div>' +
          '<div class="row" style="margin-top: 8px;">' +
            '<button data-action="start">Iniciar</button>' +
            '<button data-action="stop" class="secondary">Detener</button>' +
            '<button data-action="qr" class="secondary">Ver QR</button>' +
            '<button data-action="delete" class="warn">Eliminar</button>' +
          '</div>' +
          '<img id="' + qrId + '" class="qr" alt="QR sesión" />';

        wrapper.querySelector('[data-action="start"]').addEventListener('click', async () => {
          await fetch('/v1/sessions/' + session.id + '/start', { method: 'POST' });
          await loadSessions();
        });

        wrapper.querySelector('[data-action="stop"]').addEventListener('click', async () => {
          await fetch('/v1/sessions/' + session.id + '/stop', { method: 'POST' });
          await loadSessions();
        });

        wrapper.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          await fetch('/v1/sessions/' + session.id, { method: 'DELETE' });
          await loadSessions();
        });

        wrapper.querySelector('[data-action="qr"]').addEventListener('click', async () => {
          const response = await fetch('/v1/sessions/' + session.id + '/qr', { cache: 'no-store' });
          const data = await response.json();
          const qr = data.qr;
          const img = document.getElementById(qrId);

          if (!qr) {
            alert('QR no disponible todavía. Inicia la sesión y vuelve a intentar.');
            return;
          }

          img.src = qr;
          img.style.display = 'block';
        });

        return wrapper;
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');
      }
    </script>
  </body>
</html>`;
}
