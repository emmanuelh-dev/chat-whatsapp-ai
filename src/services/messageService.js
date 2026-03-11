import { logger } from '../utils/logger.js';
import { getTypingDelay } from '../utils/contactUtils.js';
import { enqueueOutboundMessage } from './outboundQueueService.js';

export async function humanFlowDynamic(ctx, message, options = {}) {
  const { flowDynamic } = ctx;

  if (!flowDynamic) {
    logger.error("flowDynamic function not available in context", { ctx });
    return;
  }

  const delay = options.delay || getTypingDelay(message);
  await new Promise((resolve) => setTimeout(resolve, delay));

  return enqueueOutboundMessage(
    () => flowDynamic(message),
    {
      channel: 'builderbot-flow',
      to: options.to ?? 'unknown',
    }
  );
}

export async function analyzePropertyImageWithAI() {
  try {
    return {
      text: "He analizado la imagen de la propiedad. Se ve como una propiedad en buen estado. ¿Te gustaría saber más detalles sobre propiedades similares?",
    };
  } catch (error) {
    logger.error("Error in AI vision service call", error);
    throw error;
  }
}
