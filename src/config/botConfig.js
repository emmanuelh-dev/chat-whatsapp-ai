import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT ?? 3008;

export const MESSAGES = {
  welcome: (name) => name ? `¡Hola ${name}! Soy tu asesor inmobiliario personal. ¿En qué puedo ayudarte hoy?` : 
    "¡Hola! Soy tu asesor inmobiliario personal. ¿En qué puedo ayudarte hoy?",
  imageAnalyzing: (name) => name ? `${name}, estoy analizando la imagen de la propiedad, dame un momento...` :
    "Estoy analizando la imagen de la propiedad, dame un momento...",
  error: (name) => name ? `Lo siento ${name}, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?` :
    "Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?",
};
