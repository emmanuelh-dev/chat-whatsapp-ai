import { logger } from '../utils/logger.js';
import { humanFlowDynamic } from './messageService.js';
import { analyzePropertyImageWithAI } from './messageService.js';
import { getAIResponse } from './aiService.js';
import { fetchWhatsAppContacts } from './whatsappService.js';
import { blacklist } from '../data/blacklist.js';
import { MESSAGES } from '../config/botConfig.js';

export async function processMessage(ctx, ctxFunctions, conversationManager) {
  const { flowDynamic } = ctxFunctions;
  const userId = ctx.from;
  const userName = ctx.pushName || null;

  if (!flowDynamic) {
    logger.error("flowDynamic function not available", { ctxFunctions });
    return;
  }

  if (await shouldIgnoreMessage(ctx, userId)) {
    return;
  }

  logger.info("Processing message", { from: userId, name: userName, message: ctx.body });

  if (await handleMediaMessage(ctx, flowDynamic)) {
    return;
  }

  await handleTextMessage(ctx, flowDynamic, userId, conversationManager);
}

async function shouldIgnoreMessage(ctx, userId) {
  const supabaseBlacklist = await fetchWhatsAppContacts();

  if (ctx.blacklist?.includes(userId) || ctx.from in blacklist || supabaseBlacklist.includes(userId)) {
    logger.info("Ignoring message from blacklisted user", { from: userId });
    return true;
  }

  return false;
}

async function handleMediaMessage(ctx, flowDynamic) {
  const hasMedia = ctx.message?.hasMedia;
  if (!hasMedia) return false;

  try {
    const media = await ctx.downloadMedia();
    if (!media?.mimetype.startsWith("image/")) return false;

    logger.info("Processing image message", {
      from: ctx.from,
      name: ctx.pushName,
      mediaType: media.mimetype,
    });

    await humanFlowDynamic({ flowDynamic }, MESSAGES.imageAnalyzing(ctx.pushName));
    const imageAnalysis = await analyzePropertyImageWithAI(media.data);
    await humanFlowDynamic({ flowDynamic }, imageAnalysis.text);
    return true;
  } catch (error) {
    logger.error("Error processing media", error);
    return false;
  }
}

async function handleTextMessage(ctx, flowDynamic, userId, conversationManager) {
  try {
    const aiResponse = await getAIResponse(userId, ctx.body, conversationManager, ctx.pushName);
    await humanFlowDynamic({ flowDynamic }, aiResponse);
  } catch (error) {
    logger.error("Error getting AI response", error);
    await humanFlowDynamic({ flowDynamic }, MESSAGES.error(ctx.pushName));
  }
}
