import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { JsonFileDB as Database } from '@builderbot/database-json'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const PORT = process.env.PORT ?? 3008

// Logging utility functions
const logger = {
  info: (message, data = {}) => {
    const timestamp = new Date().toISOString()
    console.log(`[INFO] [${timestamp}] ${message}`, data)
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString()
    console.error(`[ERROR] [${timestamp}] ${message}`, error)
    console.error(`Stack: ${error.stack || 'No stack trace available'}`)
  },
  warn: (message, data = {}) => {
    const timestamp = new Date().toISOString()
    console.warn(`[WARN] [${timestamp}] ${message}`, data)
  },
  debug: (message, data = {}) => {
    const timestamp = new Date().toISOString()
    console.debug(`[DEBUG] [${timestamp}] ${message}`, data)
  },
  ai: (prompt, response, timeTaken) => {
    const timestamp = new Date().toISOString()
    console.log(`[AI] [${timestamp}] Request completed in ${timeTaken}ms`)
    console.log(`[AI] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`)
    console.log(`[AI] Response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`)
  }
}

// Function to add a human-like delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get a random delay between min and max milliseconds
function getRandomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to simulate typing time based on message length
function getTypingDelay(message) {
  // Average typing speed: ~40 words per minute, or ~200 characters per minute
  // That's about 3.33 characters per second
  const charactersPerSecond = 3.33;
  const minDelay = 1500; // Minimum delay of 1.5 seconds
  const maxDelay = 5000; // Maximum delay of 5 seconds
  
  const calculatedDelay = Math.ceil(message.length / charactersPerSecond) * 1000;
  return Math.min(Math.max(calculatedDelay, minDelay), maxDelay);
}

// Function to clean JSON string from markdown formatting
function cleanJsonString(jsonString) {
  // Remove markdown code block markers
  let cleaned = jsonString.replace(/```json|```/g, '').trim();
  
  // Sometimes OpenAI adds extra text before or after the JSON
  const jsonStartIndex = cleaned.indexOf('{');
  const jsonEndIndex = cleaned.lastIndexOf('}') + 1;
  
  if (jsonStartIndex >= 0 && jsonEndIndex > 0) {
    cleaned = cleaned.substring(jsonStartIndex, jsonEndIndex);
  }
  
  return cleaned;
}

// Function to detect language and determine if the bot can handle the query
async function analyzeQuery(message) {
  logger.info('Analyzing query', { message: message.substring(0, 50) })
  const startTime = Date.now()
  
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: `Analiza el siguiente mensaje y responde en formato JSON:
      
      Mensaje: "${message}"
      
      Determina:
      1. El idioma del mensaje (código de 2 letras, ej: "es", "en")
      2. Si el mensaje es una consulta inmobiliaria que puedes responder (true/false)
      3. Si requiere atención humana (true/false)
      4. Si es una pregunta sobre tus servicios o capacidades como asesor inmobiliario (true/false)
      5. Si es una solicitud para analizar una imagen o propiedad (true/false)
      
      Responde solo con un objeto JSON con esta estructura exacta, sin markdown ni texto adicional:
      {"language": "es", "isRealEstateQuery": true, "needsHuman": false, "isAboutServices": false, "isImageAnalysisRequest": false}`,
      system: "Eres un asistente que analiza mensajes para determinar su idioma y si son consultas inmobiliarias que puedes responder o requieren atención humana. Responde SOLO con JSON sin formato markdown."
    })
    
    const timeTaken = Date.now() - startTime
    logger.ai(`Análisis de mensaje: ${message}`, text, timeTaken)
    
    try {
      // Clean the JSON string before parsing
      const cleanedJson = cleanJsonString(text);
      logger.info('Cleaned JSON', { cleanedJson });
      return JSON.parse(cleanedJson);
    } catch (parseError) {
      logger.error('Error parsing JSON response from OpenAI', parseError);
      logger.error('Raw response', { text });
      return {
        language: "es",
        isRealEstateQuery: true,
        needsHuman: false,
        isAboutServices: false,
        isImageAnalysisRequest: false
      };
    }
  } catch (error) {
    const timeTaken = Date.now() - startTime
    logger.error(`Error analyzing query after ${timeTaken}ms`, error)
    return {
      language: "es",
      isRealEstateQuery: true,
      needsHuman: false,
      isAboutServices: false,
      isImageAnalysisRequest: false
    }
  }
}

// OpenAI helper function with language support
async function getAIResponse(prompt, language = "es") {
  logger.info('Sending request to OpenAI', { promptLength: prompt.length, language })
  
  const startTime = Date.now()
  try {
    let systemPrompt = "Eres un asesor inmobiliario entusiasta y persuasivo. Tu objetivo es ayudar a los clientes a encontrar la propiedad perfecta y cerrar ventas. Proporciona información concisa y precisa sobre propiedades, tendencias del mercado, consejos de compra/venta y oportunidades de inversión. Mantén las respuestas por debajo de 200 palabras. Siempre muestra entusiasmo por ayudar al cliente a encontrar su hogar ideal.";
    
    if (language === "en") {
      systemPrompt = "You are an enthusiastic and persuasive real estate advisor. Your goal is to help clients find the perfect property and close sales. Provide concise, accurate information about properties, market trends, buying/selling advice, and investment opportunities. Keep responses under 200 words. Always show enthusiasm for helping the client find their ideal home.";
    }
    
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: prompt,
      system: systemPrompt
    })
    
    const timeTaken = Date.now() - startTime
    logger.ai(prompt, text, timeTaken)
    return text
  } catch (error) {
    const timeTaken = Date.now() - startTime
    logger.error(`OpenAI request failed after ${timeTaken}ms`, error)
    
    if (language === "es") {
      return "Lo siento, no pude procesar tu pregunta inmobiliaria en este momento. Por favor, inténtalo de nuevo más tarde.";
    } else {
      return "I'm sorry, I couldn't process your real estate question at the moment. Please try again later.";
    }
  }
}

// Function to analyze an image of a property
async function analyzePropertyImage(imageUrl, language = "es") {
  logger.info('Analyzing property image', { imageUrl });
  
  const startTime = Date.now();
  try {
    let prompt = "";
    if (language === "es") {
      prompt = `Analiza esta imagen de una propiedad inmobiliaria. Describe sus características principales, estilo arquitectónico, condición aparente, y cualquier detalle destacable. Luego, ofrece una opinión profesional sobre su valor potencial y atractivo en el mercado actual. Sé entusiasta y persuasivo, como un verdadero asesor inmobiliario que quiere vender la propiedad.`;
    } else {
      prompt = `Analyze this real estate property image. Describe its main features, architectural style, apparent condition, and any notable details. Then, offer a professional opinion on its potential value and appeal in the current market. Be enthusiastic and persuasive, like a real estate advisor who wants to sell the property.`;
    }
    
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: `${prompt}\n\nImagen URL: ${imageUrl}`,
      system: language === "es" 
        ? "Eres un asesor inmobiliario experto que analiza imágenes de propiedades. Proporciona descripciones detalladas y opiniones profesionales sobre el valor y potencial de las propiedades."
        : "You are an expert real estate advisor who analyzes property images. Provide detailed descriptions and professional opinions on the value and potential of properties."
    });
    
    const timeTaken = Date.now() - startTime;
    logger.ai(`Análisis de imagen: ${imageUrl}`, text, timeTaken);
    return text;
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    logger.error(`Image analysis failed after ${timeTaken}ms`, error);
    
    if (language === "es") {
      return "Lo siento, no pude analizar la imagen de la propiedad en este momento. ¿Podrías proporcionarme más detalles sobre la propiedad que te interesa?";
    } else {
      return "I'm sorry, I couldn't analyze the property image at the moment. Could you provide me with more details about the property you're interested in?";
    }
  }
}

// Function to get services description based on language
function getServicesDescription(language = "es") {
  if (language === "es") {
    return `¡Claro que puedo ayudarte! Como tu asesor inmobiliario virtual, puedo:

🏠 Ayudarte a encontrar la casa de tus sueños al mejor precio
🔍 Brindarte información sobre tendencias del mercado inmobiliario actual
💰 Asesorarte sobre inversiones inmobiliarias rentables
📝 Explicarte el proceso de compra/venta de propiedades
🏙️ Informarte sobre las mejores zonas para vivir según tus necesidades
💼 Orientarte sobre financiamiento y opciones hipotecarias
🔎 Analizar imágenes de propiedades que te interesen

¿En cuál de estos servicios estás más interesado? ¡Estoy aquí para ayudarte a encontrar tu propiedad ideal!`;
  } else {
    return `Of course I can help you! As your virtual real estate advisor, I can:

🏠 Help you find your dream home at the best price
🔍 Provide information on current real estate market trends
💰 Advise you on profitable real estate investments
📝 Explain the property buying/selling process
🏙️ Inform you about the best areas to live based on your needs
💼 Guide you on financing and mortgage options
🔎 Analyze images of properties you're interested in

Which of these services are you most interested in? I'm here to help you find your ideal property!`;
  }
}

// Function to get human assistance message
function getHumanAssistanceMessage(language = "es") {
  if (language === "es") {
    return "Esta consulta requiere atención personalizada. Un asesor inmobiliario se pondrá en contacto contigo pronto. Mientras tanto, ¿hay algo más en lo que pueda ayudarte?";
  } else {
    return "This query requires personalized attention. A real estate advisor will contact you soon. In the meantime, is there anything else I can help you with?";
  }
}

// Function to get welcome message based on language
function getWelcomeMessage(language = "es") {
  if (language === "es") {
    return "👋 ¡Bienvenido al Asesor Inmobiliario! ¿En qué puedo ayudarte hoy?\n\nPuedes preguntarme sobre compra, venta, tendencias del mercado, inversiones o cualquier otra consulta inmobiliaria.";
  } else {
    return "👋 Welcome to the Real Estate Advisor! How can I help you today?\n\nYou can ask me about buying, selling, market trends, investments, or any other real estate questions.";
  }
}

// Function to get follow-up message based on language
function getFollowUpMessage(language = "es") {
  if (language === "es") {
    return "¿Tienes alguna otra pregunta sobre bienes raíces? (sí/no)";
  } else {
    return "Do you have any other real estate questions? (yes/no)";
  }
}

// Enhanced flowDynamic function with human-like delays
async function humanFlowDynamic(ctx, message, options = {}) {
  // Get the original flowDynamic function from context
  const { flowDynamic } = ctx;
  
  if (!flowDynamic) {
    logger.error('flowDynamic function not available in context', { ctx });
    return;
  }

  
  // Send the message
  return flowDynamic(message);
}

// Process any message that doesn't match other keywords
async function processAnyMessage(ctx, ctxFunctions) {
  const { flowDynamic, state, gotoFlow } = ctxFunctions;
  
  if (!flowDynamic) {
    logger.error('flowDynamic function not available', { ctxFunctions });
    return;
  }
  
  logger.info('Processing message via processAnyMessage function', { from: ctx.from, message: ctx.body });
  
  // Check if the message contains media (image)
  const hasMedia = ctx.message && ctx.message.hasMedia;
  
  // Analyze the query to determine language and if bot can handle it
  const analysis = await analyzeQuery(ctx.body);
  
  // Store language in state for later use
  if (state && state.update) {
    await state.update({ language: analysis.language });
  }
  
  // Add initial delay to simulate reading the message
  await delay(getRandomDelay(1000, 2000));
  
  // Handle image analysis if there's media
  if (hasMedia) {
    logger.info('Message contains media, attempting to analyze', { from: ctx.from });
    try {
      // Download the media
      const media = await ctx.downloadMedia();
      if (media) {
        logger.info('Media downloaded successfully', { from: ctx.from, mediaType: media.mimetype });
        
        // Check if it's an image
        if (media.mimetype.startsWith('image/')) {
          await humanFlowDynamic({ flowDynamic }, analysis.language === "es" 
            ? "Estoy analizando la imagen de la propiedad, dame un momento..." 
            : "I'm analyzing the property image, give me a moment...");
          
          // Analyze the image (in a real implementation, you would pass the image data to OpenAI)
          const imageAnalysis = await analyzePropertyImage(media.data, analysis.language);
          await humanFlowDynamic({ flowDynamic }, imageAnalysis);
          
          // Add delay before follow-up question
          await delay(getRandomDelay(1500, 2500));
          await humanFlowDynamic({ flowDynamic }, getFollowUpMessage(analysis.language));
          return;
        }
      }
    } catch (error) {
      logger.error('Error processing media', error);
    }
  }
  
  // Handle questions about services
  if (analysis.isAboutServices) {
    logger.info('User asking about services', { from: ctx.from });
    await humanFlowDynamic({ flowDynamic }, getServicesDescription(analysis.language));
    
    // Add delay before follow-up question
    await delay(getRandomDelay(1500, 2500));
    await humanFlowDynamic({ flowDynamic }, analysis.language === "es" 
      ? "¿En qué servicio específico estás interesado?" 
      : "Which specific service are you interested in?");
    return;
  }
  
  // Handle regular real estate queries
  if (analysis.needsHuman) {
    logger.info('Query needs human assistance', { from: ctx.from });
    await humanFlowDynamic({ flowDynamic }, getHumanAssistanceMessage(analysis.language));
    await delay(getRandomDelay(1500, 2500));
    await humanFlowDynamic({ flowDynamic }, getFollowUpMessage(analysis.language));
    return;
  }
  
  if (analysis.isRealEstateQuery) {
    logger.info('Processing real estate query', { from: ctx.from, language: analysis.language });
    
    // Simulate "typing" indicator for a longer query
    const aiResponse = await getAIResponse(ctx.body, analysis.language);
    
    // Send the response with a delay based on message length
    await humanFlowDynamic({ flowDynamic }, aiResponse);
    
    // Add delay before follow-up question
    await delay(getRandomDelay(1500, 2500));
    await humanFlowDynamic({ flowDynamic }, getFollowUpMessage(analysis.language));
  } else {
    // If it's not a real estate query, provide a general response about real estate services
    logger.info('Non-real estate query, providing services info', { from: ctx.from });
    await humanFlowDynamic({ flowDynamic }, getServicesDescription(analysis.language));
    
    // Add delay before follow-up
    await delay(getRandomDelay(1500, 2500));
    await humanFlowDynamic({ flowDynamic }, analysis.language === "es" 
      ? "¿En qué puedo ayudarte específicamente con bienes raíces?" 
      : "How can I specifically help you with real estate?");
  }
}

// Define realEstateFlow first so it can be referenced later
const realEstateFlow = addKeyword(['bienes raices', 'inmobiliaria', 'real estate', 'propiedades', 'casa', 'departamento', 'terreno', utils.setEvent('REAL_ESTATE')])
    .addAction(async (ctx, { flowDynamic, state }) => {
        // Detect language
        const analysis = await analyzeQuery(ctx.body);
        await state.update({ language: analysis.language });
        
        // Send welcome message in the appropriate language with delay
        await humanFlowDynamic({ flowDynamic }, getWelcomeMessage(analysis.language));
    })
    .addAnswer('', { capture: true, delay: 1000 }, async (ctx, { flowDynamic, state }) => {
        const language = state.get('language') || "es";
        logger.info('Received real estate question', { 
          from: ctx.from, 
          question: ctx.body,
          language
        });
        
        // Add delay to simulate reading
        await delay(getRandomDelay(1000, 2000));
        
        // Check if the message contains media (image)
        const hasMedia = ctx.message && ctx.message.hasMedia;
        
        if (hasMedia) {
            logger.info('Message contains media, attempting to analyze', { from: ctx.from });
            try {
                // Download the media
                const media = await ctx.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    await humanFlowDynamic({ flowDynamic }, language === "es" 
                        ? "Estoy analizando la imagen de la propiedad, dame un momento..." 
                        : "I'm analyzing the property image, give me a moment...");
                    
                    // Analyze the image
                    const imageAnalysis = await analyzePropertyImage(media.data, language);
                    await humanFlowDynamic({ flowDynamic }, imageAnalysis);
                    
                    // Add delay before follow-up question
                    await delay(getRandomDelay(1500, 2500));
                    await humanFlowDynamic({ flowDynamic }, getFollowUpMessage(language));
                    return;
                }
            } catch (error) {
                logger.error('Error processing media', error);
            }
        }
        
        // Analyze if the query needs human assistance
        const analysis = await analyzeQuery(ctx.body);
        
        // Handle questions about services
        if (analysis.isAboutServices) {
            logger.info('User asking about services', { from: ctx.from });
            await humanFlowDynamic({ flowDynamic }, getServicesDescription(language));
            return;
        }
        
        if (analysis.needsHuman) {
            logger.info('Query needs human assistance', { from: ctx.from });
            await humanFlowDynamic({ flowDynamic }, getHumanAssistanceMessage(language));
        } else {
            // Get response from OpenAI
            const aiResponse = await getAIResponse(ctx.body, language);
            
            // Send the AI response back to the user with typing delay
            logger.info('Sending AI response to user', { 
              to: ctx.from, 
              responseLength: aiResponse.length 
            });
            await humanFlowDynamic({ flowDynamic }, aiResponse);
        }
        
        // Add delay before follow-up
        await delay(getRandomDelay(1500, 2500));
        
        // Ask if they want to continue
        await humanFlowDynamic({ flowDynamic }, getFollowUpMessage(language));
    })
    .addAnswer('', { capture: true, delay: 1000 }, async (ctx, { gotoFlow, flowDynamic, state, endFlow }) => {
        const language = state.get('language') || "es";
        logger.info('User follow-up response', { 
          from: ctx.from, 
          response: ctx.body 
        });
        
        // Add delay to simulate reading
        await delay(getRandomDelay(800, 1500));
        
        const response = ctx.body.toLowerCase();
        const isAffirmative = language === "es" 
            ? response.includes('sí') || response.includes('si') || response.includes('claro')
            : response.includes('yes') || response.includes('yeah') || response.includes('sure');
        
        if (isAffirmative) {
            logger.info('User wants to continue with real estate questions', { from: ctx.from });
            if (language === "es") {
                await humanFlowDynamic({ flowDynamic }, "¿Qué más te gustaría saber sobre bienes raíces?");
            } else {
                await humanFlowDynamic({ flowDynamic }, "What else would you like to know about real estate?");
            }
            return gotoFlow(realEstateFlow);
        } else {
            logger.info('User ending real estate conversation', { from: ctx.from });
            if (language === "es") {
                await humanFlowDynamic({ flowDynamic }, "¡Gracias por usar nuestro Asesor Inmobiliario! Escribe cualquier consulta inmobiliaria cuando lo necesites.");
            } else {
                await humanFlowDynamic({ flowDynamic }, "Thank you for using our Real Estate Advisor! Type any real estate query whenever you need assistance.");
            }
            return endFlow();
        }
    });

const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`¿Cuál es tu nombre?`, { capture: true, delay: 1000 }, async (ctx, { state }) => {
        logger.info('User providing name', { from: ctx.from });
        await state.update({ name: ctx.body });
    })
    .addAnswer('¿Cuál es tu edad?', { capture: true, delay: 1500 }, async (ctx, { state }) => {
        logger.info('User providing age', { from: ctx.from, name: state.get('name') });
        await state.update({ age: ctx.body });
    })
    .addAction(async (ctx, { flowDynamic, state }) => {
        const name = state.get('name');
        const age = state.get('age');
        logger.info('Registration completed', { from: ctx.from, name, age });
        
        // Add delay before response
        await delay(getRandomDelay(1500, 2500));
        
        await humanFlowDynamic({ flowDynamic }, `${name}, gracias por tu información. Tu edad: ${age}`);
    });

const discordFlow = addKeyword('doc').addAnswer(
    ['Puedes ver la documentación aquí', '📄 https://builderbot.app/docs \n', '¿Quieres continuar? *sí*'].join(
        '\n'
    ),
    { capture: true, delay: 1500 },
    async (ctx, { gotoFlow, flowDynamic }) => {
        logger.info('User in documentation flow', { from: ctx.from, response: ctx.body });
        
        // Add delay to simulate reading
        await delay(getRandomDelay(1000, 2000));
        
        if (ctx.body.toLocaleLowerCase().includes('sí') || ctx.body.toLocaleLowerCase().includes('si')) {
            logger.info('User wants to continue to registration', { from: ctx.from });
            return gotoFlow(registerFlow);
        }
        logger.info('User ending documentation flow', { from: ctx.from });
        await humanFlowDynamic({ flowDynamic }, '¡Gracias!');
        return;
    }
);

const welcomeFlow = addKeyword(['hi', 'hello', 'hola', 'buenos dias', 'buenas tardes', 'buenas noches'])
    .addAction(async (ctx, { flowDynamic, state }) => {
      console.log(ctx)
        logger.info('New conversation started with greeting', { from: ctx.from, keyword: ctx.body });
        
        // Detect language
        const analysis = await analyzeQuery(ctx.body);
        await state.update({ language: analysis.language });
        
        // Add delay before response
        await delay(getRandomDelay(1000, 2000));
        
        // Send welcome message in the appropriate language
        if (analysis.language === "es") {
            await humanFlowDynamic({ flowDynamic }, `🙌 Hola, bienvenido a este *Asesor Inmobiliario*`);
        } else {
            await humanFlowDynamic({ flowDynamic }, `🙌 Hello, welcome to this *Real Estate Advisor*`);
        }
    })
    .addAnswer(
        [
            'Puedo ayudarte con asesoría inmobiliaria o puedes explorar otras opciones:',
            '👉 Escribe *doc* para ver la documentación',
            '👉 Escribe *inmobiliaria* para obtener asesoría inmobiliaria',
            '👉 O simplemente hazme tu pregunta directamente'
        ].join('\n'),
        { delay: 1500, capture: true },
        async (ctx, { fallBack, gotoFlow, state, flowDynamic }) => {
            const language = state.get('language') || "es";
            logger.info('User initial choice', { from: ctx.from, choice: ctx.body });
            
            // Add delay to simulate reading
            await delay(getRandomDelay(1000, 2000));
            
            if (ctx.body.toLocaleLowerCase().includes('doc')) {
                logger.info('User selected documentation', { from: ctx.from });
                return;
            } else if (ctx.body.toLocaleLowerCase().includes('inmobiliaria') || 
                       ctx.body.toLocaleLowerCase().includes('real estate') ||
                       ctx.body.toLocaleLowerCase().includes('bienes raices')) {
                logger.info('User selected real estate advisor', { from: ctx.from });
                return gotoFlow(realEstateFlow);
            } else {
                // Process as a direct query
                logger.info('Processing as direct query from welcome flow', { from: ctx.from, query: ctx.body });
                await processAnyMessage(ctx, { flowDynamic, state, gotoFlow });
                return;
            }
        },
        [discordFlow, realEstateFlow]
    );

const fullSamplesFlow = addKeyword(['samples', 'ejemplos', utils.setEvent('SAMPLES')])
    .addAction(async (ctx) => {
        logger.info('User requested samples', { from: ctx.from });
    })
    .addAnswer(`💪 Te enviaré varios archivos...`, { delay: 1500 })
    .addAnswer(`Imagen local`, { media: join(process.cwd(), 'assets', 'sample.png'), delay: 2000 })
    .addAnswer(`Video desde URL`, {
        media: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4',
        delay: 2500
    })
    .addAnswer(`Audio desde URL`, { 
        media: 'https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3',
        delay: 2000
    })
    .addAnswer(`¡Estos son algunos ejemplos de lo que puedo hacer!`);

const main = async () => {
    logger.info('Starting Real Estate Advisor Bot', { port: PORT });
    
    try {
        // Create a flow for the bot - solo incluimos los flujos específicos
        const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow, realEstateFlow]);
        logger.info('Flow adapter created successfully');
        
        const adapterProvider = createProvider(Provider, {
            // Esta es la parte clave - configuramos el proveedor para manejar todos los mensajes
            // que no coinciden con ningún flujo definido
            businessLogic: async (ctx, { flowDynamic, state, gotoFlow, endFlow }) => {
                // Saltamos si ya fue respondido o es un comando
                if (ctx.answered || ctx.body.startsWith('/')) {
                    return;
                }
                
                // Verificamos si es un saludo o comando específico que debería ser manejado por otros flujos
                const isGreeting = ['hi', 'hello', 'hola', 'buenos dias', 'buenas tardes', 'buenas noches']
                    .some(greeting => ctx.body.toLowerCase().includes(greeting));
                    
                const isCommand = ['doc', 'inmobiliaria', 'real estate', 'bienes raices', 'samples', 'ejemplos']
                    .some(cmd => ctx.body.toLowerCase().includes(cmd));
                    
                // Si es un saludo o comando, dejamos que los flujos específicos lo manejen
                if (isGreeting || isCommand) {
                    logger.info('Skipping businessLogic for greeting or command', { from: ctx.from });
                    return;
                }
                
                logger.info('Handling message via businessLogic', { from: ctx.from, message: ctx.body });
                await processAnyMessage(ctx, { flowDynamic, state, gotoFlow, endFlow });
            }
        });
        logger.info('Provider adapter created successfully');
        
        const adapterDB = new Database({ filename: 'db.json' });
        logger.info('Database adapter created successfully', { dbFile: 'db.json' });

        const { handleCtx, httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        });
        logger.info('Bot created successfully');

        adapterProvider.server.post(
            '/v1/messages',
            handleCtx(async (bot, req, res) => {
                const { number, message, urlMedia } = req.body;
                logger.info('API request: Send message', { to: number, message, hasMedia: !!urlMedia });
                
                try {
                    await bot.sendMessage(number, message, { media: urlMedia ?? null });
                    logger.info('Message sent successfully', { to: number });
                    return res.end('sended');
                } catch (error) {
                    logger.error('Failed to send message', error);
                    res.status(500).end('error');
                }
            })
        );

        adapterProvider.server.post(
            '/v1/register',
            handleCtx(async (bot, req, res) => {
                const { number, name } = req.body;
                logger.info('API request: Trigger registration', { number, name });
                
                try {
                    await bot.dispatch('REGISTER_FLOW', { from: number, name });
                    logger.info('Registration flow triggered', { for: number });
                    return res.end('trigger');
                } catch (error) {
                    logger.error('Failed to trigger registration flow', error);
                    res.status(500).end('error');
                }
            })
        );

        adapterProvider.server.post(
            '/v1/samples',
            handleCtx(async (bot, req, res) => {
                const { number, name } = req.body;
                logger.info('API request: Trigger samples', { number, name });
                
                try {
                    await bot.dispatch('SAMPLES', { from: number, name });
                    logger.info('Samples flow triggered', { for: number });
                    return res.end('trigger');
                } catch (error) {
                    logger.error('Failed to trigger samples flow', error);
                    res.status(500).end('error');
                }
            })
        );
        
        // New endpoint for real estate inquiries
        adapterProvider.server.post(
            '/v1/real-estate',
            handleCtx(async (bot, req, res) => {
                const { number, question } = req.body;
                logger.info('API request: Real estate inquiry', { number, question });
                
                try {
                    await bot.dispatch('REAL_ESTATE', { from: number, question });
                    logger.info('Real estate flow triggered', { for: number });
                    return res.end('trigger');
                } catch (error) {
                    logger.error('Failed to trigger real estate flow', error);
                    res.status(500).end('error');
                }
            })
        );

        adapterProvider.server.post(
            '/v1/blacklist',
            handleCtx(async (bot, req, res) => {
                const { number, intent } = req.body;
                logger.info('API request: Blacklist operation', { number, intent });
                
                try {
                    if (intent === 'remove') {
                        bot.blacklist.remove(number);
                        logger.info('Number removed from blacklist', { number });
                    }
                    if (intent === 'add') {
                        bot.blacklist.add(number);
                        logger.info('Number added to blacklist', { number });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ status: 'ok', number, intent }));
                } catch (error) {
                    logger.error('Failed to process blacklist operation', error);
                    res.status(500).end('error');
                }
            })
        );

        httpServer(+PORT);
        logger.info(`HTTP server started on port ${PORT}`);
        
        // Log startup complete
        logger.info('Real Estate Advisor Bot is now running', { 
            port: PORT, 
            openaiModel: 'gpt-4o',
            time: new Date().toISOString() 
        });
        
        // Handle process termination
        process.on('SIGINT', () => {
            logger.info('Bot shutting down...');
            process.exit(0);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', error);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', { reason, promise });
        });
        
    } catch (error) {
        logger.error('Failed to start bot', error);
        process.exit(1);
    }
};

main();