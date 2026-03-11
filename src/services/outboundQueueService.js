import { logger } from "../utils/logger.js";

const minDelayMs = Number(process.env.OUTBOUND_QUEUE_MIN_SECONDS ?? 5) * 1000;
const maxDelayMs = Number(process.env.OUTBOUND_QUEUE_MAX_SECONDS ?? 10) * 1000;

const queue = [];
let processing = false;

export function enqueueOutboundMessage(task, metadata = {}) {
  return new Promise((resolve, reject) => {
    queue.push({ task, metadata, resolve, reject });
    processQueue();
  });
}

export function getOutboundQueueSize() {
  return queue.length;
}

async function processQueue() {
  if (processing || queue.length === 0) {
    return;
  }

  processing = true;
  const item = queue.shift();

  try {
    logger.info("Processing outbound message from queue", {
      queueSize: queue.length,
      ...item.metadata,
    });

    const result = await item.task();
    item.resolve(result);
  } catch (error) {
    item.reject(error);
  } finally {
    const delay = getRandomDelayMs();
    await wait(delay);
    processing = false;
    processQueue();
  }
}

function getRandomDelayMs() {
  if (maxDelayMs <= minDelayMs) {
    return minDelayMs;
  }

  return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
