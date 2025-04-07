import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
  EVENTS,
} from "@builderbot/bot";
import { JsonFileDB as Database } from "@builderbot/database-json";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import dotenv from "dotenv";
import { properties } from "./data/properties.js";
import { logger } from "./utils/logger.js";
import { getTypingDelay } from "./utils/contactUtils.js";
import ConversationManager from "./ConversationManager.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ?? 3008;

// Constantes para mensajes
const MESSAGES = {
  welcome:
    "¡Hola! Soy tu asesor inmobiliario personal. ¿En qué puedo ayudarte hoy?",
  imageAnalyzing:
    "Estoy analizando la imagen de la propiedad, dame un momento...",
  error:
    "Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?",
};
// Instancia global del administrador de conversaciones
const conversationManager = new ConversationManager();

// OpenAI helper function with conversation history
async function getAIResponse(userId, prompt) {
  // Primero, guardamos el mensaje del usuario en el historial
  conversationManager.addMessage(userId, "user", prompt);

  // Incluimos el historial de conversación en el prompt
  const contextualPrompt = conversationManager.generateContextualPrompt(
    userId,
    prompt
  );

  logger.info("Sending request to OpenAI", {
    userId,
    promptLength: contextualPrompt.length,
  });

  const startTime = Date.now();
  try {
    let systemPrompt = `Eres un asesor inmobiliario entusiasta y persuasivo. Tu objetivo es ayudar a los clientes a encontrar la propiedad perfecta.

    Reglas importantes:
    1. Proporciona información concisa y precisa sobre propiedades
    2. Mantén las respuestas por debajo de 200 palabras
    3. Evita repetir la misma frase de introducción en cada mensaje
    4. Personaliza tus respuestas basándote en el historial de la conversación
    5. Muestra entusiasmo pero mantén un tono profesional
    6. Si el cliente ya mencionó sus preferencias, no preguntes por ellas de nuevo
    7. Sé conversacional y natural, como un agente inmobiliario real
    8. IMPORTANTE: No repitas "Puedo ayudarte a encontrar la propiedad ideal para ti" en cada mensaje

    Aquí tienes todas las propiedades disponibles. Utiliza la información relevante según la consulta del cliente:
    ${JSON.stringify(properties)}`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: contextualPrompt,
      system: systemPrompt,
    });

    const timeTaken = Date.now() - startTime;
    logger.ai(prompt, text, timeTaken);

    // Guardar la respuesta en el historial
    conversationManager.addMessage(userId, "assistant", text);

    return text;
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    logger.error(`OpenAI request failed after ${timeTaken}ms`, error);

    return MESSAGES.error;
  }
}


async function humanFlowDynamic(ctx, message, options = {}) {
  const { flowDynamic } = ctx;

  if (!flowDynamic) {
    logger.error("flowDynamic function not available in context", { ctx });
    return;
  }

  const delay = options.delay || getTypingDelay(message);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return flowDynamic(message);
}

// Función para analizar imágenes con IA
async function analyzePropertyImageWithAI(imageData, userMessage) {
  try {
    return {
      text: "He analizado la imagen de la propiedad. Se ve como una propiedad en buen estado. ¿Te gustaría saber más detalles sobre propiedades similares?",
    };
  } catch (error) {
    logger.error("Error in AI vision service call", error);
    throw error;
  }
}

async function processAnyMessage(ctx, ctxFunctions) {
  console.log("processAnyMessage" + ctx);

  const { flowDynamic } = ctxFunctions;
  const userId = ctx.from;

  if (!flowDynamic) {
    logger.error("flowDynamic function not available", { ctxFunctions });
    return;
  }
  logger.info("Processing message", { from: userId, message: ctx.body });
  logger.info("Message", { ctx });

  // Check if the message contains media (image)
  const hasMedia = ctx.message && ctx.message.hasMedia;

  // Handle image analysis if there's media
  if (hasMedia) {
    logger.info("Message contains media, attempting to analyze", {
      from: userId,
    });
    try {
      // Download the media
      const media = await ctx.downloadMedia();
      if (media) {
        logger.info("Media downloaded successfully", {
          from: userId,
          mediaType: media.mimetype,
        });

        // Check if it's an image
        if (media.mimetype.startsWith("image/")) {
          await humanFlowDynamic({ flowDynamic }, MESSAGES.imageAnalyzing);

          // Enviar la imagen directamente a la IA para análisis
          const imageAnalysis = await analyzePropertyImageWithAI(
            media.data,
            ctx.body
          );
          await humanFlowDynamic({ flowDynamic }, imageAnalysis.text);
          return;
        }
      }
    } catch (error) {
      logger.error("Error processing media", error);
    }
  }

  // Procesar el mensaje como consulta de texto
  try {
    const aiResponse = await getAIResponse(userId, ctx.body);
    await humanFlowDynamic({ flowDynamic }, aiResponse);
  } catch (error) {
    logger.error("Error getting AI response", error);
    await humanFlowDynamic({ flowDynamic }, MESSAGES.error);
  }
}

// Flujo de bienvenida - CORREGIDO para eliminar la respuesta duplicada
const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state }) => {
    console.log("addKeyword" + ctx);

    // Si es primer mensaje, enviamos saludo
    // if (!conversationManager.getHistory(ctx.from).length) {
    //   await humanFlowDynamic({ flowDynamic }, MESSAGES.welcome);
    // }

    // Procesar el mensaje del usuario
    await processAnyMessage(ctx, { flowDynamic, state });
  }
);

const main = async () => {
  logger.info("Starting Real Estate Advisor Bot", { port: PORT });

  try {
    // Create a flow for the bot
    const adapterFlow = createFlow([welcomeFlow]);
    logger.info("Flow adapter created successfully");

    const adapterProvider = createProvider(Provider, {
      // Configuración para manejar todos los mensajes que no coinciden con ningún flujo
      businessLogic: async (ctx, { flowDynamic, state, gotoFlow, endFlow }) => {
        console.log(ctx);
        // Saltamos si ya fue respondido o es un comando
        if (ctx.answered || ctx.body.startsWith("/")) {
          return;
        }

        // Verificar si el mensaje está vacío
        if (!ctx.body || ctx.body.trim() === "") {
          logger.info("Ignoring empty message", { from: ctx.from });
          return;
        }

        logger.info("Handling unmatched message", {
          from: ctx.from,
          message: ctx.body,
        });
        await processAnyMessage(ctx, { flowDynamic, state, gotoFlow, endFlow });
      },
    });

    const adapterDB = new Database({ filename: "db.json" });
    logger.info("Database adapter created successfully", { dbFile: "db.json" });

    const { handleCtx, httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });
    logger.info("Bot created successfully");

    // Endpoint para enviar mensajes
    adapterProvider.server.post(
      "/v1/messages",
      handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body;
        logger.info("API request: Send message", {
          to: number,
          message,
          hasMedia: !!urlMedia,
        });

        try {
          await bot.sendMessage(number, message, { media: urlMedia ?? null });
          logger.info("Message sent successfully", { to: number });
          return res.end("sended");
        } catch (error) {
          logger.error("Failed to send message", error);
          res.status(500).end("error");
        }
      })
    );

    // Endpoint para registrar usuarios
    adapterProvider.server.post(
      "/v1/register",
      handleCtx(async (bot, req, res) => {
        const { number, name } = req.body;
        logger.info("API request: Trigger registration", { number, name });

        try {
          await bot.dispatch("REGISTER_FLOW", { from: number, name });
          logger.info("Registration flow triggered", { for: number });
          return res.end("trigger");
        } catch (error) {
          logger.error("Failed to trigger registration flow", error);
          res.status(500).end("error");
        }
      })
    );

    // Endpoint para consultas inmobiliarias
    adapterProvider.server.post(
      "/v1/real-estate",
      handleCtx(async (bot, req, res) => {
        const { number, question } = req.body;
        logger.info("API request: Real estate inquiry", { number, question });

        try {
          await bot.dispatch("REAL_ESTATE", { from: number, question });
          logger.info("Real estate flow triggered", { for: number });
          return res.end("trigger");
        } catch (error) {
          logger.error("Failed to trigger real estate flow", error);
          res.status(500).end("error");
        }
      })
    );

    // Endpoint para gestionar la lista negra
    adapterProvider.server.post(
      "/v1/blacklist",
      handleCtx(async (bot, req, res) => {
        const { number, intent } = req.body;
        logger.info("API request: Blacklist operation", { number, intent });

        try {
          if (intent === "remove") {
            bot.blacklist.remove(number);
            logger.info("Number removed from blacklist", { number });
          }
          if (intent === "add") {
            bot.blacklist.add(number);
            logger.info("Number added to blacklist", { number });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ status: "ok", number, intent }));
        } catch (error) {
          logger.error("Failed to process blacklist operation", error);
          res.status(500).end("error");
        }
      })
    );

    httpServer(+PORT);
    logger.info(`HTTP server started on port ${PORT}`);

    // Log startup complete
    logger.info("Real Estate Advisor Bot is now running", {
      port: PORT,
      openaiModel: "gpt-4o",
      time: new Date().toISOString(),
    });

    // Handle process termination
    process.on("SIGINT", () => {
      logger.info("Bot shutting down...");
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", error);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled promise rejection", { reason, promise });
    });
  } catch (error) {
    logger.error("Failed to start bot", error);
    process.exit(1);
  }
};

main();
