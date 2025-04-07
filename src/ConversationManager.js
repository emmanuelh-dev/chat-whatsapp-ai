const CONVERSATION_HISTORY_SIZE = 5;
import { logger } from "./utils/logger.js";

export default class ConversationManager {
    constructor() {
      this.histories = {}; // Mapeo de número de usuario a su historial
    }
  
    addMessage(userId, role, content) {
      if (!this.histories[userId]) {
        this.histories[userId] = [];
      }
  
      this.histories[userId].push({ role, content });
  
      // Mantener solo las últimas CONVERSATION_HISTORY_SIZE interacciones
      if (this.histories[userId].length > CONVERSATION_HISTORY_SIZE * 3) {
        // *2 porque cada interacción tiene mensaje usuario y respuesta
        this.histories[userId] = this.histories[userId].slice(
          -CONVERSATION_HISTORY_SIZE * 3
        );
      }
  
      logger.info("Added message to history", {
        userId,
        historySize: this.histories[userId].length,
      });
    }
  
    // Obtener el historial completo para un usuario
    getHistory(userId) {
      return this.histories[userId] || [];
    }
  
    // Generar prompt con contexto de la conversación
    generateContextualPrompt(userId, currentQuery) {
      const history = this.getHistory(userId);
  
      if (history.length === 0) {
        return currentQuery;
      }
  
      // Formatear el historial para incluirlo en el prompt
      const formattedHistory = history
        .map(
          (msg) => `${msg.role === "user" ? "Cliente" : "Asesor"}: ${msg.content}`
        )
        .join("\n");
  
      return `Historial de conversación:\n${formattedHistory}\n\nConsulta actual del cliente: ${currentQuery}`;
    }
  }
  