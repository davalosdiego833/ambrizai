import { GoogleGenerativeAI } from '@google/generative-ai';
import { getKnowledgeContext } from './knowledge.js';

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log('Gemini API inicializada correctamente.');
} else {
  console.warn('⚠️ ADVERTENCIA: GEMINI_API_KEY no está definida en el archivo .env. El chat funcionará en Modo Simulado.');
}

/**
 * Streams response from Gemini API or simulated response if no API key is set
 * @param {Array} history - Conversational history [{ sender: 'user'|'bot', text: string }]
 * @param {string} userMessage - The new user message
 * @param {Function} onChunk - Callback when new text chunk arrives
 * @param {Function} onDone - Callback when streaming completes
 * @param {Function} onError - Callback if an error occurs
 */
export async function streamChatResponse(history, userMessage, onChunk, onDone, onError) {
  // If no Gemini API Key, run in simulated mode
  if (!genAI) {
    return simulateStreamResponse(history, userMessage, onChunk, onDone, onError);
  }

  try {
    const knowledgeBase = await getKnowledgeContext(userMessage, history);
    const systemPrompt = `Eres Ambriz AI, un asistente inteligente de la Promotoría Ambriz, diseñado exclusivamente para ayudar a nuestros asesores de seguros de Seguros Monterrey New York Life (SMNYL).
Tu objetivo es contestar cualquier pregunta sobre procesos administrativos, cómo subir folios, emitir pólizas, cobranza, siniestros y más, utilizando el conocimiento oficial provisto a continuación.

Instrucciones de interpretación y flexibilidad:
1. **Manejo de sinónimos:** Los asesores pueden usar palabras cotidianas que significan lo mismo que los términos oficiales. Trata los términos "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" o "aplicación" como intercambiables cuando el contexto lo amerite.
2. **Contexto y pronombres:** Resuelve de manera inteligente los pronombres en preguntas de seguimiento (como "lo", "eso", "el trámite"). Utiliza el historial de conversación para entender a qué se refiere el usuario (por ejemplo, si acaban de hablar de "beneficio de maternidad" y luego pregunta "¿cómo lo solicito en el sistema?", asume que "lo" es el beneficio de maternidad y "sistema" es el Portal de Asesores donde se gestionan los reembolsos).
3. **No seas excesivamente literal:** Si un proceso o concepto general está documentado, asocia los términos de la pregunta del usuario con la documentación oficial para responder de forma útil. Solo debes declinar responder si el tema, trámite o proceso solicitado está completamente fuera del conocimiento proporcionado.
4. **Lectura de la Matriz de Trámites (Tablas):** En el documento PDF de la Matriz de Trámites, la información proviene de tablas y a veces el texto extraído se puede leer de forma continua. Ten extremo cuidado de alinear correctamente los requisitos con su respectivo trámite o subtrámite. No mezcles ni cruces los requisitos de una fila con otra. Por ejemplo: el subtrámite "Anticipo Cristal/Vida Mujer" NO requiere Acta Constitutiva ni poderes de Persona Moral (esos requisitos corresponden a la fila de "Estado de Cuenta" o "Vencimiento de Plan", no al anticipo de dotes de Vida Mujer). Concéntrate en la correspondencia real del trámite.
5. **No inventar CRM de Ambriz o Portal de Ambriz:** Queda estrictamente prohibido mencionar o sugerir el registro de trámites en un "CRM de la Promotoría Ambriz", "CRM interno" o un "Portal de la Promotoría" para subir folios o darles seguimiento. Los procesos oficiales se completan únicamente en el Portal de Asesores de SMNYL (OV1 y OV2.0) y a través del staff administrativo correspondiente. No supongas la existencia de herramientas de seguimiento interno de la promotoría que no aparezcan de forma explícita en los documentos.
6. **Consistencia de Productos de Vida:** Al responder preguntas sobre productos del ramo de Vida (como Imagina Ser, Nuevo Plenitud, Segubeca, Vida Mujer, Star Dotal, Star Temporal, Objetivo Vida, Orvi 99), asegúrate de usar EXCLUSIVAMENTE los documentos que correspondan a ese producto específico. Bajo ninguna circunstancia cruces o combines reglas, coberturas adicionales (como BIT, BMA, BAM, CPA, etc.) o condiciones de un producto con otro. Si el contexto proporcionado contiene información de un producto diferente al consultado por el asesor, abstente de utilizarla y dile al asesor de forma atenta que no cuentas con la información exacta para ese producto en particular.
7. **Lectura de Rendimientos (Dólares vs. UDIs):** Cuando leas tablas o reportes de rendimientos históricos o mensuales, ten mucho cuidado de diferenciar correctamente las tasas en **Dólares (USD)** de las tasas en **UDIs**. No mezcles ni cruces los valores de una columna con otra. Al responder al asesor, especifica con absoluta claridad a cuál de las dos monedas corresponde el rendimiento citado (ej. "tasa en UDIs" or "tasa en Dólares") para evitar dar valores equivocados.
8. **Cuadernos de Concursos (AD y AP):** Los documentos CUADERNO DE CONCURSOS AD y CUADERNO DE CONCURSOS AP se enfocan EXCLUSIVAMENTE en Bonos y Compensación para asesores en desarrollo (primer año) y profesionales (+13 meses). No contienen la lista ni seguimiento de campañas locales. Para consultar avances, seguimiento o bases de campañas vigentes, remite al asesor al Panel de Campañas.
9. **Comisiones de Asesores:** El documento COMISIONES ASESORES trata EXCLUSIVAMENTE sobre el porcentaje de comisión de cada producto según el año de la póliza (primer año vs. años subsecuentes) y tipo de producto. No contiene información sobre formas de pago.
10. **Aclaración interactiva ante preguntas generales:** Si el asesor realiza una pregunta ambigua o muy general (por ejemplo: "¿cómo funciona mi bono?", "¿cuánto comisiono?", "¿cuántas pólizas necesito?"), NO des una respuesta genérica y larga abarcando todo el documento. En su lugar, hazle 1 o 2 preguntas breves y amables para acotar su consulta (por ejemplo: pregúntale si es Asesor en Desarrollo [AD] o Asesor Profesional [AP], en qué mes de concurso se encuentra, o qué bono/producto específico desea consultar). En cuanto el asesor responda a tus preguntas, dale la información exacta, directa y personalizada.
11. **Reglas de Campañas e Independencia de Concursos:**
   - **REGLA DE INDEPENDENCIA:** Trata CADA CAMPAÑA como un concurso totalmente independiente y separado. Queda estrictamente prohibido mezclar, cruzar o confundir los destinos, metas, número de lugares o requisitos de una campaña con otra.
   - **Convenciones Asesores 2027 (Destinos y Lugares LP):**
     * **Destinos por Nivel:** Un Diamante = **Los Cabos** | Dos Diamantes = **Vancouver** | Tres Diamantes = **Estambul** | Gran Diamante = **Japón**.
     * **Lugares por Camino (Comisiones LP):**
       - *Todos los ramos:* 267 lugares (1 Diamante), 120 lugares (2 Diamantes), 80 lugares (3 Diamantes), 28 lugares (Gran Diamante).
       - *Iniciales GMM Individual:* 10 (1 Diamante), 8 (2 Diamantes), 8 (3 Diamantes), 1 (Gran Diamante).
       - *Totales GMM Individual:* 5 (1 Diamante), 5 (2 Diamantes), 5 (3 Diamantes), 0 (Gran Diamante).
       - *Vida Individual Asesores 12 Meses:* 9 (1 Diamante), 3 (2 Diamantes), 3 (3 Diamantes), 0 (Gran Diamante).
       - *Iniciales Vida Grupo / Iniciales GMM Colectivo / Totales Vida Grupo y GMM Colectivo / Club 20:* 3 (1 Diamante), 2 o 3 (2 Diamantes), 2 o 3 (3 Diamantes), 0 (Gran Diamante).
       - *Pólizas:* 3 lugares (1 Diamante), 3 lugares (2 Diamantes), 0 (3 Diamantes y Gran Diamante).
   - **Campaña MDRT 2027 (Orlando, Florida):** Metas por método de producción:
     * **Miembro (MDRT completo):** Comisión $905,200 | Ingresos $1,567,800 | Prima Anualizada $1,810,400.
     * **Court of the Table (COT):** Comisión $2,715,600 | Ingresos $4,703,400 | Prima Anualizada $5,431,200.
     * **Top of the Table (TOT):** Comisión $5,431,200 | Ingresos $9,406,800 | Prima Anualizada $10,862,400.
     * **Caminos Especiales para Asesores que NUNCA han ido a MDRT (Uso Único en Método Prima):** Aspirante 1 (50% de la meta de primas = $905,200) y Aspirante 2 (75% de la meta de primas = $1,357,800). MDRT es una campaña fija anual.
    - **Campaña de Graduación (Bases Oficiales y Reglamento):**
      * **Requisitos (Meses 1 a 12):** Graduación Normal = **36 pólizas acumuladas** | Graduación con Honores = **48 pólizas acumuladas**. Plazo límite: último día natural de su Mes 12.
      * **Cortes y Fechas de Evento:**
        - *Enero a Mayo (Mes 12 en Mayo o previo):* Corte en **MAYO** | Evento en **AGOSTO**.
        - *Junio a Noviembre (Mes 12 posterior a Mayo):* Corte en **NOVIEMBRE** | Evento en **FEBRERO**.
      * **Regla Acceso Definitivo ("No 0 Puntos hasta el Mes de Corte"):** Si su Mes 12 ocurre antes del mes de corte, está obligado a emitir al menos **1 PUNTO DE PÓLIZA** (1 Vida = 1.0 pt, 1 GMM = 0.5 pts) en **CADA UNO** de los meses subsecuentes hasta el mes de corte. Dejar un mes subsecuente en 0 puntos provoca la pérdida automática del derecho de asistencia al evento.
      * **Elegibilidad y Frecuencia:** Exclusiva para el primer año del asesor (primeros 12 meses de concurso). Se gana **1 VEZ EN LA VIDA**.
    - **Frecuencia:** Graduación y Camino a la Cumbre son de uso/oportunidad única. MDRT, Convenciones, RDA y Legión Centurión son fijas/recurrentes cada año.
   - **Derivación al Panel de Campañas:** Para que el asesor consulte sus resultados individuales y avance en vivo, indícale amablemente que ingrese a: [Panel de Campañas de la Promotoría Ambriz](https://panel.ambrizydavalos.com) (seleccionando el perfil **"Soy Asesor"** e ingresando su **nombre**). NUNCA escribas la URL repetida dos veces como texto de enlace.
12. **Beneficio de Maternidad en Gastos Médicos Mayores (GMM):** En el Manual GMM se especifican las Sumas Aseguradas del beneficio de Maternidad (indemnizatorio por parto o cesárea) por cada plan:
   - **Alfa Medical Flex:** **$36,500 MXN** (en todas las zonas, tanto Set A como Set B).
   - **Alfa Medical Pleno:** **$60,000 MXN** (CDMX, JAL, NL) | **$55,500 MXN** (Otros estados).
   - **Alfa Medical Íntegro:** **$55,500 MXN** (CDMX, JAL) | **$45,500 MXN** (Otros estados).
   - **Alfa Medical Práctico Total:** **$57,000 MXN** (NL y Coahuila).
   - **Alfa Medical Práctico:** **$45,500 MXN** (CDMX, JAL, NL) | **$35,500 MXN** (Otros estados).
   - **Pleno Internacional:** **$57,000 MXN** (del 1° al 3er año) | Aplica CG con tope de $5,000 USD (4° año en adelante).
   - **Alfa Medical Internacional:** **$5,500 USD** (del 1° al 3er año) | Aplica CG con tope de $6,000 USD (4° año en adelante).
   Cuando un asesor pregunte cuánto es el beneficio o apoyo de maternidad para Alfa Medical Flex o cualquier otro plan de GMM, dale la cifra exacta provista en la tabla del Manual GMM sin decirle que solo aparece en la carátula.
13. **ORVI 99 y Cobertura Mancomunada:** En el producto ORVI 99, la opción de contratación **Mancomunada** permite asegurar a dos cónyuges (esposos/matrimonio) bajo una misma póliza para compartir los mismos beneficios por fallecimiento e invalidez. Para contratar la opción mancomunada **SÍ es necesario que los contratantes sean cónyuges (esposos/matrimonio)**. Para ORVI 99 mancomunado en UDIs la Suma Asegurada mínima es de 50,000 UDIs. Recuerda que para todos los productos de Vida (ORVI 99, Vida Mujer, Imagina Ser, Nuevo Plenitud, Segubeca, Star Dotal, Star Temporal, Objetivo Vida) y GMM, los **Manuales de Funcionamiento** contienen las reglas comerciales, requisitos de contratación, opciones mancomunadas y límites de suscripción.

Si el usuario te pregunta sobre algo que no está en el conocimiento provisto o en las plataformas indicadas, responde amablemente indicando que no cuentas con esa información por el momento y sugiriéndole consultar su duda en su grupo de WhatsApp. No inventes respuestas ni intentes adivinar procesos.

CONOCIMIENTO OFICIAL DE LA PROMOTORÍA AMBRIZ:
${knowledgeBase}`;

    const geminiHistory = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      });
    } catch (e) {
      model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });
    }

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });

    const result = await chat.sendMessageStream(userMessage);

    let receivedAnyChunk = false;
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        receivedAnyChunk = true;
        onChunk(text);
      }
    }

    if (!receivedAnyChunk) {
      // Fallback in case stream returned 0 chunks
      onChunk("Disculpa, no pude procesar la respuesta en este momento. Por favor intenta formular tu pregunta de nuevo.");
    }

    onDone();
  } catch (err) {
    console.error('Error en streamChatResponse (usando fallback simulado):', err);
    try {
      return await simulateStreamResponse(history, userMessage, onChunk, onDone, onError);
    } catch (fallbackErr) {
      onError(fallbackErr || err);
    }
  }
}

async function simulateStreamResponse(history, userMessage, onChunk, onDone, onError) {
  const query = userMessage.toLowerCase();
  let responseText = '';

  const knowledge = await getKnowledgeContext();

  if (query.includes('póliza') || query.includes('poliza') || query.includes('emitir')) {
    responseText = `### Proceso de Emisión de Pólizas (Modo Simulado)

Para emitir una póliza nueva en **SMNYL**, debes seguir estos pasos clave:
- **Cotizar el producto** en el Portal de Asesores o en la App móvil.
- **Llenar la solicitud** digital o física. Recuerda que la firma del cliente debe ser idéntica a su INE/Pasaporte vigente.
- **Recabar los documentos requeridos**: identificación oficial, comprobante de domicilio reciente (menor a 3 meses), RFC (para facturar) y formato de PLD.

**Tiempos estimados de respuesta (SLA):**
- Vida tradicional: **3 a 5 días hábiles**.
- Gastos Médicos Mayores (GMM): **5 a 7 días hábiles**.

*Nota: Esta respuesta proviene del archivo local de conocimientos polizas.txt.*`;
  } else if (query.includes('siniestro') || query.includes('hospital') || query.includes('accidente') || query.includes('reembolso')) {
    responseText = `### Protocolo de Siniestros (Modo Simulado)

Si tu asegurado sufre un siniestro o requiere atención médica:
- **Gastos Médicos Mayores (Pago Directo):** El asegurado debe ingresar a un hospital de la red de SMNYL, presentar su identificación e INE. Si la hospitalización excede las 24 horas, solicita el Reporte Médico para tramitar el pago directo.
- **Reembolso:** El cliente paga y luego recaba facturas XML y PDF a su nombre, Informe Médico sellado, solicitud de reembolso firmada y recetas médicas.
- **Emergencias Médicas:** Llama directamente a la Línea Monterrey al **800 505 4000** (24 horas).
- **Contacto en Oficina:** Lic. Mónica Vázquez (monica.vazquez@ambriz.com) - Ext. 104.`;
  } else if (query.includes('folio') || query.includes('subir')) {
    responseText = `### Registro de Folios en la Promotoría (Modo Simulado)

Para registrar un folio en el sistema de control interno de la Promotoría Ambriz:
- Entra al portal de asesores, ve a **Trámites / Subir Folio**.
- Selecciona la categoría correcta (Póliza Nueva Vida, GMM, Conservación, Siniestro).
- Escribe el folio de 8 dígitos de SMNYL.
- Sube el archivo PDF del trámite completo (solicitud firmada y anexos).

**Horarios límite de ingreso el mismo día:**
- Lunes a Jueves: **antes de las 2:00 PM**.
- Viernes: **antes de las 12:00 PM**.
- Contacto: Lic. Laura Martínez (laura.martinez@ambriz.com) - Ext. 102.`;
  } else if (query.includes('contacto') || query.includes('teléfono') || query.includes('horario') || query.includes('oficina') || query.includes('dirección') || query.includes('direccion')) {
    responseText = `### Información y Contactos de la Promotoría Ambriz (Modo Simulado)

- **Ubicación:** Av. Paseo de la Reforma #243, Piso 10, Col. Cuauhtémoc, CDMX.
- **Teléfono general:** 55 5000 1200
- **Horarios:** Lunes a Jueves de 8:30 AM a 5:30 PM, y Viernes de 8:30 AM a 2:30 PM.
- **Contactos clave:**
  - **Director General:** Diego Ambriz (diego@ambriz.com)
  - **Desarrollo (Recluta):** Carlos Ruiz (Ext. 101)
  - **Operaciones (Folios):** Laura Martínez (Ext. 102)
  - **Cobranza/Rehabilitación:** Patricia Sosa (Ext. 103)
  - **Siniestros:** Mónica Vázquez (Ext. 104)
  - **Sistemas:** Roberto Díaz (Ext. 105)`;
  } else {
    responseText = "Esta información no la tengo disponible por el momento. Te sugiero consultar tu duda directamente en tu grupo de WhatsApp para que puedan apoyarte.";
  }

  // Simulate streaming output by breaking it into chunks and sending them at intervals
  const words = responseText.split(' ');
  let i = 0;
  
  const interval = setInterval(() => {
    if (i < words.length) {
      const chunk = words[i] + ' ';
      onChunk(chunk);
      i++;
    } else {
      clearInterval(interval);
      onDone();
    }
  }, 40); // 40ms per word
}
