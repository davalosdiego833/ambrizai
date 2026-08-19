import { GoogleGenerativeAI } from '@google/generative-ai';
import { getKnowledgeContext } from './knowledge.js';

const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-pro'];

const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  console.log('Gemini API inicializada correctamente.');
} else {
  console.warn('⚠️ ADVERTENCIA: GEMINI_API_KEY no está definida en el archivo .env. El chat funcionará en Modo Simulado.');
}

/**
 * Streams response from Gemini API or simulated response if no API key is set or API fails
 * @param {Array} history - Conversational history [{ sender: 'user'|'bot', text: string }]
 * @param {string} userMessage - The new user message
 * @param {Function} onChunk - Callback when new text chunk arrives
 * @param {Function} onDone - Callback when streaming completes
 * @param {Function} onError - Callback if an error occurs
 */
export async function streamChatResponse(history, userMessage, onChunk, onDone, onError) {
  const currentKey = process.env.GEMINI_API_KEY;
  
  // If no Gemini API Key, run in smart local knowledge engine mode
  if (!currentKey) {
    console.log('⚡ Usando motor de conocimientos local de Ambriz AI (sin API key)...');
    return simulateStreamResponse(history, userMessage, onChunk, onDone, onError);
  }

  const genAI = new GoogleGenerativeAI(currentKey);

  try {
    const knowledgeBase = await getKnowledgeContext(userMessage, history);
    const systemPrompt = `Eres Ambriz AI, un asistente virtual de inteligencia artificial altamente inteligente, profesional, amable y atento de la Promotoría Ambriz, diseñado exclusivamente para ayudar y asesorar a los asesores de seguros de Seguros Monterrey New York Life (SMNYL).

Tu objetivo principal es contestar con lógica impecable, claridad y coherencia cualquier pregunta sobre procesos administrativos, cómo subir folios, emitir pólizas, cobranza, siniestros, productos de Vida y Gastos Médicos Mayores, comisiones y campañas, utilizando el conocimiento oficial provisto a continuación.

Instrucciones de interpretación, cortesía y coherencia:
-1. **SALUDOS Y CONVERSACIÓN CASUAL:** Si el usuario te saluda (ej. "hola", "buenos días", "buenas tardes", "buenas noches", "qué tal", "quién eres", "ayuda", "gracias"), responde con calidez, cortesía y elegancia. Saluda cordialmente y preséntate como Ambriz AI, el asistente inteligente de la Promotoría Ambriz, e indícale amablemente que estás listo para ayudarle en cualquier consulta sobre productos SMNYL, trámites, folios, comisiones o campañas.
0. **REGLA MAESTRA DE AISLAMIENTO TEMÁTICO:**
   - **PRODUCTOS Y TRÁMITES:** Si la pregunta del asesor es sobre un producto (ORVI 99, Vida Mujer, Imagina Ser, Nuevo Plenitud, Segubeca, Star Dotal, Star Temporal, Objetivo Vida, Alfa Medical, GMM, etc.) o un trámite administrativo (folios, emisión, extraprima, carta de aceptación, siniestros, reembolsos, cobranza, hospitalización):
     👉 Responde ÚNICAMENTE sobre las reglas del producto o el procedimiento solicitado. Queda ESTRICTAMENTE PROHIBIDO mencionar o sacar temas de Campañas, Convenciones, MDRT, Graduación, Bonos, Diamantes o Concursos.
   - **CAMPAÑAS Y CONCURSOS:** Menciona bases de campañas, destinos de viajes, bonos o concursos ÚNICAMENTE cuando el asesor pregunte EXPLÍCITAMENTE sobre convenciones, graduación, MDRT, campañas o concursos.
1. **Manejo de sinónimos:** Los asesores pueden usar palabras cotidianas que significan lo mismo que los términos oficiales. Trata los términos "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" o "aplicación" como intercambiables cuando el contexto lo amerite.
2. **Contexto y pronombres:** Resuelve de manera inteligente los pronombres en preguntas de seguimiento (como "lo", "eso", "el trámite"). Utiliza el historial de conversación para entender a qué se refiere el usuario.
3. **No seas excesivamente literal:** Si un proceso o concepto general está documentado, asocia los términos de la pregunta del usuario con la documentación oficial para responder de forma útil. Solo debes declinar responder si el tema, trámite o proceso solicitado está completamente fuera del conocimiento proporcionado.
4. **Lectura de la Matriz de Trámites (Tablas):** En el documento PDF de la Matriz de Trámites, la información proviene de tablas y a veces el texto extraído se puede leer de forma continua. Ten extremo cuidado de alinear correctamente los requisitos con su respectivo trámite o subtrámite. No mezcles ni cruces los requisitos de una fila con otra.
5. **REGLA OBLIGATORIA DE NOMBRE DEL PORTAL:** Queda ESTRICTAMENTE PROHIBIDO mencionar "Portal de Ambriz", "Portal Ambriz", "CRM de Ambriz", "Plataforma de Ambriz" o "Sistema de la Promotoría" para subir folios, consultar trámites, cotizar o dar seguimiento. NUNCA uses la palabra "Ambriz" para referirte al portal de trámites. Refiérete SIEMPRE como **"Portal de Asesores SMNYL"** (a través de las Oficinas Virtuales OV1 y OV2.0).
6. **Consistencia de Productos de Vida:** Al responder preguntas sobre productos del ramo de Vida (como Imagina Ser, Nuevo Plenitud, Segubeca, Vida Mujer, Star Dotal, Star Temporal, Objetivo Vida, Orvi 99), asegúrate de usar EXCLUSIVAMENTE los documentos que correspondan a ese producto específico. Bajo ninguna circunstancia cruces o combines reglas, coberturas adicionales (como BIT, BMA, BAM, CPA, etc.) o condiciones de un producto con otro.
7. **Lectura de Rendimientos (Dólares vs. UDIs):** Cuando leas tablas o reportes de rendimientos históricos o mensuales, ten mucho cuidado de diferenciar correctamente las tasas en **Dólares (USD)** de las tasas en **UDIs**. Específica con absoluta claridad a cuál de las dos monedas corresponde el rendimiento citado.
8. **Cuadernos de Concursos (AD y AP):** Los documentos CUADERNO DE CONCURSOS AD y CUADERNO DE CONCURSOS AP se enfocan EXCLUSIVAMENTE en Bonos y Compensación para asesores en desarrollo (primer año) y profesionales (+13 meses). No contienen la lista ni seguimiento de campañas locales. Para consultar avances, seguimiento o bases de campañas vigentes, remite al asesor al Panel de Campañas.
9. **Comisiones de Asesores:** El documento COMISIONES ASESORES trata EXCLUSIVAMENTE sobre el porcentaje de comisión de cada producto según el año de la póliza (primer año vs. años subsecuentes) y tipo de producto.
10. **Aclaración interactiva ante preguntas ambiguas:** Si el asesor realiza una pregunta muy ambigua o general, NO des una respuesta genérica interminable. Hazle 1 o 2 preguntas breves y amables para acotar su consulta.
11. **Reglas de Campañas e Independencia de Concursos:**
   - **REGLA DE INDEPENDENCIA:** Trata CADA CAMPAÑA como un concurso totalmente independiente y separado.
   - **Convenciones Asesores 2027 (Destinos y Lugares LP):**
     * **Destinos por Nivel:** Un Diamante = **Los Cabos** | Dos Diamantes = **Vancouver** | Tres Diamantes = **Estambul** | Gran Diamante = **Japón**.
   - **Campaña MDRT 2027 (Orlando, Florida):** Metas por método de producción:
     * **Miembro (MDRT completo):** Comisión $905,200 | Ingresos $1,567,800 | Prima Anualizada $1,810,400.
     * **Court of the Table (COT):** Comisión $2,715,600 | Ingresos $4,703,400 | Prima Anualizada $5,431,200.
     * **Top of the Table (TOT):** Comisión $5,431,200 | Ingresos $9,406,800 | Prima Anualizada $10,862,400.
     * **Caminos Especiales para Asesores que NUNCA han ido a MDRT (Uso Único en Método Prima):** Aspirante 1 (50% de la meta de primas = $905,200) y Aspirante 2 (75% de la meta de primas = $1,357,800).
    - **Campaña de Graduación (Bases Oficiales y Reglamento):**
      * **Requisitos (Meses 1 a 12):** Graduación Normal = **36 pólizas acumuladas** | Graduación con Honores = **48 pólizas acumuladas**. Plazo límite: último día natural de su Mes 12.
    - **Derivación al Panel de Campañas:** Para que el asesor consulte sus resultados individuales y avance en vivo, indícale amablemente que ingrese a: [Panel de Campañas de la Promotoría Ambriz](https://panel.ambrizydavalos.com) (seleccionando el perfil **"Soy Asesor"** e ingresando su **nombre**).
12. **Beneficio de Maternidad en Gastos Médicos Mayores (GMM):**
   - **Alfa Medical Flex:** **$36,500 MXN** (en todas las zonas).
   - **Alfa Medical Pleno:** **$60,000 MXN** (CDMX, JAL, NL) | **$55,500 MXN** (Otros estados).
   - **Alfa Medical Íntegro:** **$55,500 MXN** (CDMX, JAL) | **$45,500 MXN** (Otros estados).
   - **Alfa Medical Práctico Total:** **$57,000 MXN** (NL y Coahuila).
   - **Alfa Medical Práctico:** **$45,500 MXN** (CDMX, JAL, NL) | **$35,500 MXN** (Otros estados).
13. **ORVI 99 y Cobertura Mancomunada:** En el producto ORVI 99, la opción de contratación **Mancomunada** permite asegurar a dos cónyuges (esposos/matrimonio) bajo una misma póliza para compartir los mismos beneficios por fallecimiento e invalidez.

Si el usuario te pregunta sobre algo que no está en el conocimiento provisto, responde amablemente indicando que no cuentas con esa información por el momento y sugiriéndole consultar su duda en su grupo de WhatsApp. No inventes respuestas ni intentes adivinar procesos.

CONOCIMIENTO OFICIAL DE SEGUROS MONTERREY NEW YORK LIFE (SMNYL):
${knowledgeBase}`;

    const geminiHistory = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    let success = false;
    let lastError = null;

    // Try candidate models sequentially
    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`🤖 Solicitando respuesta a Gemini (${modelName})...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

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

        if (receivedAnyChunk) {
          success = true;
          console.log(`✅ Respuesta transmitida exitosamente usando ${modelName}.`);
          break;
        }
      } catch (modelErr) {
        console.warn(`⚠️ El modelo Gemini (${modelName}) no estuvo disponible: ${modelErr.message}`);
        lastError = modelErr;
      }
    }

    if (success) {
      onDone();
      return;
    }

    throw lastError || new Error('Ningún modelo de Gemini respondió a la solicitud.');
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
  const query = userMessage.toLowerCase().trim();
  let responseText = '';

  try {
    const isGreeting = /^(hola|buenos\s+dias|buenas\s+tardes|buenas\s+noches|que\s+tal|saludos|quien\s+eres|hola\s+ambriz|ayuda)/i.test(query);

    if (isGreeting) {
      responseText = `¡Hola! 👋 Soy **Ambriz AI**, tu asistente virtual inteligente de la **Promotoría Ambriz** para Seguros Monterrey New York Life (SMNYL).

Estoy listo para ser tu mano derecha y apoyarte con cualquier duda sobre:
- 📄 **Trámites y Folios:** Emisión, cartas de extraprima y seguimiento en el **Portal de Asesores SMNYL** (OV1 / OV2.0).
- 🛡️ **Productos de Vida:** Imagina Ser, Vida Mujer, ORVI 99, Segubeca, Nuevo Plenitud, Star Dotal, Star Temporal y Objetivo Vida.
- 🏥 **Gastos Médicos Mayores:** Alfa Medical (Flex, Pleno, Íntegro, Práctico), apoyos de maternidad y reembolsos.
- 💰 **Comisiones y Campañas:** Convenciones 2027, MDRT 2027, Graduación, Bonos y reglamentos.

¿En qué te puedo ayudar el día de hoy?`;
    } else if (query.includes('extraprima') || query.includes('carta de extraprima')) {
      responseText = `### Proceso de Carta de Extraprima (SMNYL)

Cuando un trámite de emisión requiere extraprima por evaluación médica o de suscripción:

1. **Notificación de Extraprima:** SMNYL emite la **Carta de Extraprima** en el expediente del trámite dentro del **Portal de Asesores SMNYL**.
2. **Descarga y Firma:** Ingresa al **Portal de Asesores SMNYL**, descarga el formato de aceptación y recaba la firma autógrafa del contratante/asegurado (idéntica a su INE/Pasaporte).
3. **Carga en la Oficina Virtual:** Adjunta la carta firmada al folio del trámite en el **Portal de Asesores SMNYL** (sección OV1 u OV2.0).
4. **Emisión Definitiva:** Al autorizarse la carta y aplicarse el ajuste correspondiente, SMNYL procede con la emisión oficial de la póliza.`;
    } else if (query.includes('seguimiento') && query.includes('folio')) {
      responseText = `### Consulta y Seguimiento de Folios (SMNYL)

Para consultar el estatus o dar seguimiento a un folio ingresado:

1. Ingresa al **Portal de Asesores SMNYL** (plataforma oficial de Seguros Monterrey New York Life).
2. Ve a la sección de **Oficina Virtual (OV1 o OV2.0)**.
3. Haz clic en **Seguimiento de Trámites / Consulta de Folios**.
4. Escribe tu **número de folio de 8 dígitos** para verificar el estado de avance, notas del analista de SMNYL o requerimientos pendientes.`;
    } else if (query.includes('orvi 99') || (query.includes('orvi') && !query.includes('cubre') && !query.includes('gmm'))) {
      responseText = `### Información Oficial: ORVI 99 (SMNYL)

**ORVI 99** es un plan de protección de Vida Entera (hasta los 99 años) con acumulación de ahorro a valor en efectivo:

1. **Características del Producto:**
   - **Plazos de Pago:** Pago Limitado a 5, 10, 15, 20 años o Pagos Vitalicios (hasta los 99 años).
   - **Moneda:** Pesos o UDIs.
   - **Edad de Contratación:** De 0 a 70 años.
   - **Suma Asegurada Mínima:** $500,000 MXN o 50,000 UDIs.

2. **Opción Mancomunada:**
   - Permite asegurar a dos cónyuges (matrimonio) bajo la misma póliza compartiendo la suma asegurada por fallecimiento e invalidez. SÍ es requisito que los contratantes sean cónyuges.

3. **Coberturas Adicionales Disponible:**
   - **BIT:** Exención de Pago de Primas por Invalidez Total y Permanente.
   - **BMA / DI:** Beneficio de Muerte Accidental y Doble Indemnización.
   - **Valores Garantizados:** Préstamo sobre la póliza y rescate de valor en efectivo.`;
    } else if (query.includes('imagina ser') && !query.includes('cubre') && !query.includes('gmm')) {
      responseText = `### Información Oficial: Imagina Ser ® (SMNYL)

**Imagina Ser** es un plan de retiro con protección de vida y deducción fiscal:

1. **Beneficios Principales:**
   - **Edad de Retiro:** Elegible a los 55, 60, 65 o 70 años.
   - **Deducibilidad Fiscal:** Compatible con los artículos 151 (PPR) y 185 del LISR.
   - **Forma de Entrega de Ahorro:** En una sola exhibición o en renta vitalicia mensual heredable.
2. **Moneda:** Pesos o UDIs.`;
    } else if (query.includes('convencion') || query.includes('convenciones') || query.includes('los cabos') || query.includes('vancouver') || query.includes('estambul') || query.includes('japon')) {
      responseText = `### Convenciones Asesores LP 2027 (SMNYL)

**Destinos Oficiales por Nivel de Diamante:**
- **Un Diamante (1 Diamante):** Los Cabos
- **Dos Diamantes (2 Diamantes):** Vancouver
- **Tres Diamantes (3 Diamantes):** Estambul
- **Gran Diamante:** Japón

*Para consultar tu avance de comisiones y lugares individuales, ingresa al **Panel de Campañas de la Promotoría Ambriz** ([panel.ambrizydavalos.com](https://panel.ambrizydavalos.com)).*`;
    } else if (query.includes('mdrt') && !query.includes('cubre')) {
      responseText = `### Campaña MDRT 2027 (Orlando, Florida)

**Metas Oficiales por Método de Producción:**
- **Miembro MDRT:** Comisión $905,200 | Ingresos $1,567,800 | Prima Anualizada $1,810,400.
- **Court of the Table (COT):** Comisión $2,715,600 | Ingresos $4,703,400 | Prima Anualizada $5,431,200.
- **Top of the Table (TOT):** Comisión $5,431,200 | Ingresos $9,406,800 | Prima Anualizada $10,862,400.`;
    } else if (query.includes('graduacion') || query.includes('graduación')) {
      responseText = `### Campaña de Graduación (Asesores en Desarrollo)

1. **Requisitos de Pólizas Acumuladas (Meses 1 a 12):**
   - **Graduación Normal:** 36 pólizas acumuladas.
   - **Graduación con Honores:** 48 pólizas acumuladas.
2. **Regla de Continuidad ("No 0 Puntos"):** Emitir al menos 1 punto de póliza en cada mes subsecuente hasta el mes de corte.`;
    } else if (query.includes('vida mujer') && !query.includes('cubre') && !query.includes('gmm')) {
      responseText = `### Información Oficial: Vida Mujer ® (SMNYL)

**Vida Mujer** es un plan de protección y ahorro garantizado diseñado especialmente para la mujer:

1. **Ahorro Garantizado (Dotes por Supervivencia):**
   - **5% de la Suma Asegurada** al final de los años póliza **5, 7, 9, 11, 13, 15 y 17**.
   - **80% de la Suma Asegurada** al final del año póliza **20** (acumulando 115% total).
   
2. **Anticipo por Evento de Vida (Matrimonio, Nacimiento o Adopción):**
   - Puedes anticipar el dote del año 5 (5% de la Suma Asegurada) si la asegurada contrae matrimonio o nace/adopta un hijo entre los años 4 y 5 de la póliza.

3. **Coberturas Especiales Incluidas:**
   - **Protección por Cáncer Femenino (PCF):** Cobertura ante diagnóstico de cánceres de mama, cuello uterino, ovarios, etc.
   - **Complicaciones del Embarazo y Padecimientos Femeninos (PEP):** Cobertura para nacimientos múltiples, recién nacido con padecimientos congénitos o complicaciones obstétricas.`;
    } else if (query.includes('pasos para emitir') || query.includes('requisitos para emision') || query.includes('como emito una poliza nueva')) {
      responseText = `### Proceso de Emisión de Pólizas en SMNYL

Para realizar la emisión de una póliza nueva, sigue este procedimiento oficial:

1. **Cotización y Propuesta:** Cotiza el producto (Vida o GMM) en el **Portal de Asesores SMNYL** o la App móvil oficial.
2. **Llenado de Solicitud Digital/Física:** Recaba la firma del cliente (debe coincidir exactamente con su INE o Pasaporte vigente).
3. **Documentación Requerida (Expediente Digital):**
   - Identificación Oficial Vigente (INE / Pasaporte).
   - Comprobante de Domicilio (no mayor a 3 meses).
   - Formato de PLD / Identificación del Cliente.
   - Constancia de Situación Fiscal (RFC) para facturación.
4. **Ingreso y Folio:** Registra la solicitud en el **Portal de Asesores SMNYL** para obtener el Folio de 8 dígitos de SMNYL.

**Tiempos estimados de respuesta (SLA):**
- **Vida Tradicional:** 3 a 5 días hábiles.
- **Gastos Médicos Mayores (GMM):** 5 a 7 días hábiles.`;
    } else {
      // Smart Contextual Knowledge Extractor for specific queries (e.g. SIDA, VIH, rodilla, maternidad, etc.)
      const cleanKnowledge = knowledgeContext
        .replace(/=== DOCUMENTO: [^=]+ ===/g, '')
        .replace(/=== DOCUMENTO PDF: [^=]+ ===/g, '')
        .replace(/=== FIN DE DOCUMENTO ===/g, '')
        .trim();

      const paragraphs = cleanKnowledge.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30);
      
      const stopWords = new Set(["como", "cómo", "hago", "un", "de", "en", "una", "y", "el", "la", "los", "las", "para", "con", "del", "por", "que", "qué", "cual", "cuál", "cuales", "cuáles", "son", "se", "mi", "mis", "su", "sus", "hacer", "puedo", "donde", "dónde", "quien", "quién", "si", "no", "o", "a", "al", "dame", "dime", "informacion", "información", "sobre", "acerca"]);
      const queryKeywords = query.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2 && !stopWords.has(w));

      const scoredParagraphs = paragraphs.map(p => {
        let score = 0;
        const pLower = p.toLowerCase();
        queryKeywords.forEach(kw => {
          if (kw && pLower.includes(kw)) {
            score += 10;
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            if (regex.test(p)) score += 15;
          }
        });
        if (pLower.includes('contenido') || pLower.includes('índice') || pLower.includes('introducción')) {
          score -= 15;
        }
        return { p, score };
      }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

      if (scoredParagraphs.length > 0) {
        const topMatches = scoredParagraphs.slice(0, 3).map(item => item.p);
        responseText = `### Información Oficial SMNYL (Consulta de Coberturas y Procesos)

${topMatches.join('\n\n')}

---
**¿Requieres validar un caso específico?**
Para darte una confirmación exacta, indícame:
1. ¿Cuál es el plan exacto de tu cliente (ej. Alfa Medical Flex, Pleno, Íntegro)?
2. ¿La póliza cuenta con reconocimiento de antigüedad o fue un diagnóstico posterior al inicio de vigencia?`;
      } else {
        responseText = `### Asistente Inteligente SMNYL (Portal de Asesores)

Para darte la respuesta exacta, indícame un poco más de contexto sobre tu consulta:
- **Si es sobre un Producto:** Indícame si es Vida (Imagina Ser, Vida Mujer, Orvi 99, Segubeca) o Gastos Médicos Mayores (Alfa Medical).
- **Si es sobre una Cobertura o Exclusión:** Indícame la enfermedad, padecimiento o estudio a consultar.
- **Si es sobre un Trámite:** Indícame si es emisión de póliza, carga de folio, carta de extraprima o reembolso de siniestro.`;
      }
    }
  } catch (err) {
    console.error('Error en simulateStreamResponse fallback:', err);
    responseText = "No pude procesar la consulta en este momento. Por favor reintenta tu pregunta.";
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
  }, 25); // 25ms per word for rapid display
}
