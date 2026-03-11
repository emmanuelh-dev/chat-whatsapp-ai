const handoffByUser = new Map();

const HANDOFF_TTL_MS = Number(process.env.HUMAN_HANDOFF_TTL_MINUTES ?? 15) * 60 * 1000;

const HANDOFF_PATTERNS = [
  /quiero hablar con una persona/i,
  /quiero hablar con un asesor/i,
  /quiero hablar con humano/i,
  /pasame con una persona/i,
  /pasame con un asesor/i,
  /agente humano/i,
  /asesor humano/i,
  /hablar con una persona/i,
  /hablar con un humano/i,
];

export function shouldActivateHumanHandoff(message = "") {
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(message));
}

export function activateHumanHandoff(userId) {
  handoffByUser.set(userId, {
    expiresAt: Date.now() + HANDOFF_TTL_MS,
  });
}

export function isHumanHandoffActive(userId) {
  const handoff = handoffByUser.get(userId);
  if (!handoff) {
    return false;
  }

  if (handoff.expiresAt <= Date.now()) {
    handoffByUser.delete(userId);
    return false;
  }

  return true;
}

export function refreshHumanHandoff(userId) {
  if (!handoffByUser.has(userId)) {
    return;
  }

  handoffByUser.set(userId, {
    expiresAt: Date.now() + HANDOFF_TTL_MS,
  });
}
