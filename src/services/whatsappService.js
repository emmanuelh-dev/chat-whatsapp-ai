import supabase from './supabaseClient.js';

// Función para obtener todos los contactos de WhatsApp
export const fetchWhatsAppContacts = async () => {
  try {
    const { data, error } = await supabase
      .from('watsapps')
      .select('*');
    
    if (error) throw error;
    const formatted = data.map(contact =>contact.numero)
    return formatted;
  } catch (error) {
    console.error('Error al obtener contactos de WhatsApp:', error);
    throw error;
  }
};

// Función para agregar un nuevo contacto de WhatsApp
export const addWhatsAppContact = async (contact) => {
  try {
    const { data, error } = await supabase
      .from('watsapps')
      .insert([contact])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error al agregar contacto de WhatsApp:', error);
    throw error;
  }
};

// Función para verificar si un número ya existe
export const checkNumberExists = async (numero) => {
  try {
    const { data, error } = await supabase
      .from('watsapps')
      .select('*')
      .eq('numero', numero);
    
    if (error) throw error;
    return data.length > 0;
  } catch (error) {
    console.error('Error al verificar número:', error);
    throw error;
  }
};