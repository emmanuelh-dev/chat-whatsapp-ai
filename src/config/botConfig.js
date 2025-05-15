import dotenv from "dotenv";
import { JsonFileDB as Database } from "@builderbot/database-json";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

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

export const createBotConfig = () => ({
  provider: Provider,
  database: new Database({ filename: "db.json" })
});
