import WhatsAppSessionManager from "./WhatsAppSessionManager.js";
import * as sessionRepository from "./repositories/sessionRepository.js";
import * as chatRepository from "./repositories/chatRepository.js";

export function createSessionManager(options = {}) {
  return new WhatsAppSessionManager({
    sessionRepository,
    chatRepository,
    onIncomingMessage: options.onIncomingMessage,
  });
}
