import { logger } from '../utils/logger.js';

export function setupEndpoints(adapterProvider, handleCtx) {
  setupMessageEndpoint(adapterProvider, handleCtx);
  setupRegistrationEndpoint(adapterProvider, handleCtx);
  setupRealEstateEndpoint(adapterProvider, handleCtx);
  setupBlacklistEndpoints(adapterProvider, handleCtx);
}

function setupMessageEndpoint(adapterProvider, handleCtx) {
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
}

function setupRegistrationEndpoint(adapterProvider, handleCtx) {
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
}

function setupRealEstateEndpoint(adapterProvider, handleCtx) {
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
}

function setupBlacklistEndpoints(adapterProvider, handleCtx) {
  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      logger.info("API request: Blacklist operation", { number, intent });

      try {
        handleBlacklistOperation(bot, number, intent, res);
      } catch (error) {
        logger.error("Failed to process blacklist operation", error);
        res.status(500).end("error");
      }
    })
  );

  adapterProvider.server.get(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      logger.info("API request: Get blacklist");

      try {
        const blacklist = bot.blacklist.getAll();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "ok", blacklist }));
      } catch (error) {
        logger.error("Failed to get blacklist", error);
        res.status(500).end("error");
      }
    })
  );
}

function handleBlacklistOperation(bot, number, intent, res) {
  switch (intent) {
    case "remove":
      bot.blacklist.remove(number);
      logger.info("Number removed from blacklist", { number });
      break;
    case "add":
      bot.blacklist.add(number);
      logger.info("Number added to blacklist", { number });
      break;
    case "check":
      const isBlacklisted = bot.blacklist.includes(number);
      logger.info("Blacklist check", { number, isBlacklisted });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, isBlacklisted }));
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  return res.end(JSON.stringify({ status: "ok", number, intent }));
}
