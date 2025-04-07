/**
 * Verifica si un número de teléfono está guardado en los contactos
 * @param {Object} ctx - El contexto del mensaje
 * @returns {Promise<boolean>} - true si el contacto está guardado, false si no
 */
export async function isContactSaved(ctx) {
  // Remove or comment out this console.log in production
  // console.log(ctx)

  try {
    // Verificamos si el contexto tiene información de contacto
    if (!ctx || !ctx.from) {
      return false
    }

    // El problema parece estar aquí - vamos a mejorar la verificación

    // 1. Verificar si tiene un nombre personalizado (pushName diferente al número)
    const hasCustomName = ctx.pushName && ctx.pushName !== ctx.from

    // 2. Verificar si está en la lista de contactos (si está disponible)
    const isInContactList = ctx.isInContacts === true

    // 3. Verificar si tiene un nombre verificado (verifiedBizName)
    const hasVerifiedName = !!ctx.verifiedBizName

    // 4. Verificar si el mensaje tiene un nombre asociado
    const hasName = !!ctx.name

    // Añadir logging para depuración
    console.log(
      `[DEBUG] Contact check for ${ctx.from}: hasCustomName=${hasCustomName}, isInContactList=${isInContactList}, hasVerifiedName=${hasVerifiedName}, hasName=${hasName}`,
    )

    // Considerar guardado si cualquiera de estas condiciones es verdadera
    return hasCustomName || isInContactList || hasVerifiedName || hasName
  } catch (error) {
    console.error("Error al verificar si el contacto está guardado:", error)
    // En caso de error, asumimos que no está guardado para que el bot responda
    return false
  }
}

/**
 * Verifica si ha pasado un tiempo determinado desde el último mensaje
 * @param {Object} ctx - El contexto del mensaje
 * @param {Object} state - El estado del flujo
 * @param {number} timeoutMinutes - Tiempo en minutos para considerar inactivo
 * @returns {boolean} - true si ha pasado el tiempo, false si no
 */
export function hasTimedOut(ctx, state, timeoutMinutes = 30) {
  try {
    // Obtenemos el timestamp del último mensaje
    const lastMessageTime = state.get("lastMessageTime")

    if (!lastMessageTime) {
      return false // No hay registro de último mensaje
    }

    // Calculamos el tiempo transcurrido en minutos
    const currentTime = Date.now()
    const elapsedMinutes = (currentTime - lastMessageTime) / (1000 * 60)

    return elapsedMinutes >= timeoutMinutes
  } catch (error) {
    console.error("Error al verificar timeout:", error)
    return false
  }
}

/**
 * Actualiza el timestamp del último mensaje
 * @param {Object} state - El estado del flujo
 */
export async function updateLastMessageTime(state) {
  try {
    if (state && state.update) {
      await state.update({ lastMessageTime: Date.now() })
    }
  } catch (error) {
    console.error("Error al actualizar timestamp del último mensaje:", error)
  }
}

