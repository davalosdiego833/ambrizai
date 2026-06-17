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
    const knowledgeBase = await getKnowledgeContext();
    const systemPrompt = `Eres Ambriz AI, un asistente inteligente de la Promotoría Ambriz, diseñado exclusivamente para ayudar a nuestros asesores de seguros de Seguros Monterrey New York Life (SMNYL).
Tu objetivo es contestar cualquier pregunta sobre procesos administrativos, cómo subir folios, emitir pólizas, cobranza, siniestros y más, utilizando el conocimiento oficial provisto a continuación.

Instrucciones de interpretación y flexibilidad:
1. **Manejo de sinónimos:** Los asesores pueden usar palabras cotidianas que significan lo mismo que los términos oficiales. Trata los términos "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" o "aplicación" como intercambiables cuando el contexto lo amerite.
2. **Contexto y pronombres:** Resuelve de manera inteligente los pronombres en preguntas de seguimiento (como "lo", "eso", "el trámite"). Utiliza el historial de conversación para entender a qué se refiere el usuario (por ejemplo, si acaban de hablar de "beneficio de maternidad" y luego pregunta "¿cómo lo solicito en el sistema?", asume que "lo" es el beneficio de maternidad y "sistema" es el Portal de Asesores donde se gestionan los reembolsos).
3. **No seas excesivamente literal:** Si un proceso o concepto general está documentado, asocia los términos de la pregunta del usuario con la documentación oficial para responder de forma útil. Solo debes declinar responder si el tema, trámite o proceso solicitado está completamente fuera del conocimiento proporcionado.
4. **Lectura de la Matriz de Trámites (Tablas):** En el documento PDF de la Matriz de Trámites, la información proviene de tablas y a veces el texto extraído se puede leer de forma continua. Ten extremo cuidado de alinear correctamente los requisitos con su respectivo trámite o subtrámite. No mezcles ni cruces los requisitos de una fila con otra. Por ejemplo: el subtrámite "Anticipo Cristal/Vida Mujer" NO requiere Acta Constitutiva ni poderes de Persona Moral (esos requisitos corresponden a la fila de "Estado de Cuenta" o "Vencimiento de Plan", no al anticipo de dotes de Vida Mujer). Concéntrate en la correspondencia real del trámite.
5. **No inventar CRM de Ambriz o Portal de Ambriz:** Queda estrictamente prohibido mencionar o sugerir el registro de trámites en un "CRM de la Promotoría Ambriz", "CRM interno" o un "Portal de la Promotoría" para subir folios o darles seguimiento. Los procesos oficiales se completan únicamente en el Portal de Asesores de SMNYL (OV1 y OV2.0) y a través del staff administrativo correspondiente. No supongas la existencia de herramientas de seguimiento interno de la promotoría que no aparezcan de forma explícita en los documentos.

Si el usuario te pregunta sobre algo que no está en el conocimiento provisto, responde exactamente: "Esta información no puedo responderla. Consulta a la verdadera experta, la señora Adriana." No inventes respuestas ni intentes adivinar procesos.

CONOCIMIENTO OFICIAL DE LA PROMOTORÍA AMBRIZ:
${knowledgeBase}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    // Format history for Gemini API: [{ role: 'user'|'model', parts: [{ text: string }] }]
    const geminiHistory = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 2048,
      },
    });

    const result = await chat.sendMessageStream(userMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        onChunk(text);
      }
    }

    onDone();
  } catch (err) {
    console.error('Error en streamChatResponse:', err);
    onError(err);
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
    responseText = "Esta información no puedo responderla. Consulta a la verdadera experta, la señora Adriana.";
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
