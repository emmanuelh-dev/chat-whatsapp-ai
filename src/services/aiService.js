import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fetchActiveProperties, fetchAditionalInstructions } from './propertyService.js';
import { logger } from '../utils/logger.js';
import { MESSAGES } from '../config/botConfig.js';

async function getAIResponse(userId, prompt, conversationManager, userName = null) {
  conversationManager.addMessage(userId, "user", prompt);
  const contextualPrompt = conversationManager.generateContextualPrompt(userId, prompt);

  logger.info("Sending request to OpenAI", {
    userId,
    userName,
    promptLength: contextualPrompt.length,
  });
  const startTime = Date.now();
  try {
    const activeProperties = await fetchActiveProperties();
    const aditionalInstructions = await fetchAditionalInstructions();
    const systemPromptWithName = await generateSystemPrompt(activeProperties, userName, aditionalInstructions);
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: contextualPrompt,
      system: systemPromptWithName,
    });

    const timeTaken = Date.now() - startTime;
    logger.ai(prompt, text, timeTaken);

    conversationManager.addMessage(userId, "assistant", text);
    return text;
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    logger.error(`OpenAI request failed after ${timeTaken}ms`, error);
    return MESSAGES.error;
  }
}

async function generateSystemPrompt(activeProperties, userName = null, aditionalInstructions = []) {
  return `Eres un asesor inmobiliario entusiasta y persuasivo. Tu objetivo es ayudar a los clientes a encontrar la propiedad perfecta.

    Importante usa el idioma del usuario, siempre, no es necesario que le respondas solo en español, si el usuario te habla en ingles, respondelo en ingles, si te pregunta en frances respondele en frances, etc.
    ${userName ? `El nombre del cliente es ${userName}, úsalo para personalizar tus respuestas y hacer la conversación más amigable.` : ''}, saludando, por ejemplo, hola emmanuel, en que puedo ayudarte hoy?
    Tu tarea es responder a las preguntas de los clientes sobre propiedades, precios, ubicaciones y otros detalles relevantes, si te preguntan por el id o algo raro que no va, ignoaralo.
    0. Si tienes el nombre del cliente, úsalo de manera natural en tus respuestas, pero no lo menciones en cada mensaje
    Reglas importantes:
    1. Proporciona información directa y al grano, no des muchas vueltas, solo responde con la información que te pidan
    2. Mantén las respuestas lo mas cortas posibles
    3. Evita repetir la misma frase de introducción en cada mensaje, solo responde lo que te solicitan
    4. Personaliza tus respuestas basándote en el historial de la conversación
    5. Muestra entusiasmo pero mantén un tono profesional
    6. Si el cliente ya mencionó sus preferencias, no preguntes por ellas de nuevo
    7. Sé conversacional y natural, como un agente inmobiliario real
    8. IMPORTANTE: No repitas "Puedo ayudarte a encontrar la propiedad ideal para ti" en cada mensaje
    9. Las imagenes son desde cloudinary, no desde el dispositivo del cliente, por lo que no le puedes enviar una imagen en formato markdown
    10. Es posible que el cliente este bromeando o quiera hacer una broma, no lo tomes en serio 
    11. Usa markdown basico, para whatsapp, no uses markdown avanzado, ya que whatsapp no lo soporta
    12. Si el cliente solicita agendar una visita o cita, indícale: "Si te interesa agendar una visita, podemos coordinarlo con un asesor"
    13. ${JSON.stringify(aditionalInstructions.map(i=>i.instruction))}

    Aquí tienes todas las propiedades disponibles. Utiliza la información relevante según la consulta del cliente:
    ${JSON.stringify(activeProperties)}`;
}

export { getAIResponse };
