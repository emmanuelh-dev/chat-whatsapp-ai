import { createBot, createFlow, createProvider, addKeyword, EVENTS } from "@builderbot/bot";
import { logger } from "./utils/logger.js";
import { processMessage } from "./services/messageHandler.js";
import { setupEndpoints } from "./routes/api.js";
import { PORT, createBotConfig } from "./config/botConfig.js";
import ConversationManager from "./ConversationManager.js";
import { fetchWhatsAppContacts } from "./services/whatsappService.js";
import { blacklist } from "./data/blacklist.js";

const conversationManager = new ConversationManager();

const welcomeFlow = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const userNumber = ctx.from.slice(-10);
    const userName = ctx.pushName;
    const supabaseBlacklist = await fetchWhatsAppContacts();
    
    if (supabaseBlacklist.includes(userNumber)) {
      logger.info("Ignoring message from blacklisted user", {
        from: ctx.from,
        name: userName,
        matchedNumber: userNumber,
      });
      return;
    }

    logger.info("Processing welcome message", {
      from: ctx.from,
      name: userName,
    });
    
    await processMessage(ctx, { flowDynamic, state }, conversationManager);
  });

async function startBot() {  logger.info("Starting Real Estate Advisor Bot", { port: PORT });

  try {
    const adapterFlow = createFlow([welcomeFlow]);
    logger.info("Flow adapter created successfully");

    const { provider, database } = createBotConfig();    const adapterProvider = createProvider(provider, {
      businessLogic: async (ctx, { flowDynamic, state, gotoFlow, endFlow }) => {
        if (ctx.answered || (ctx.body?.startsWith("/") && !isAdmin(ctx.from))) {
          return;
        }

        // Check blacklist
        const userNumber = ctx.from.slice(-10);
        if (ctx.blacklist?.includes(ctx.from) || blacklist.includes(userNumber)) {
          logger.info("Ignoring message from blacklisted user", { from: ctx.from });
          return;
        }

        if (!ctx.body?.trim()) {
          logger.info("Ignoring empty message", { from: ctx.from });
          return;
        }

        await processMessage(ctx, { flowDynamic, state, gotoFlow, endFlow }, conversationManager);
      },
    });

    const { handleCtx, httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: database,
    });

    setupEndpoints(adapterProvider, handleCtx);
    setupErrorHandlers();

    httpServer(+PORT);
    logStartupComplete();
  } catch (error) {
    logger.error("Failed to start bot", error);
    process.exit(1);
  }
}

function setupErrorHandlers() {
  process.on("SIGINT", () => {
    logger.info("Bot shutting down...");
    process.exit(0);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled promise rejection", { reason, promise });
  });
}

function logStartupComplete() {
  logger.info(`HTTP server started on port ${PORT}`);
  logger.info("Real Estate Advisor Bot is now running", {
    port: PORT,
    openaiModel: "gpt-4o-mini",
    time: new Date().toISOString(),
  });
}

function isAdmin(userId) {
  const ADMIN_NUMBERS = process.env.ADMIN_NUMBERS?.split(",") || [];
  return ADMIN_NUMBERS.includes(userId);
}

startBot();