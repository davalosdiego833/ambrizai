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
    const systemPrompt = `Eres Ambriz AI, un asistente virtual de inteligencia artificial de nivel experto, altamente fluido, conversacional, servicial y brillante de la Promotoría Ambriz, especialista oficial en Seguros Monterrey New York Life (SMNYL).

Tu objetivo es actuar como un consultor senior inteligente: conversar con fluidez natural, empatía, elegancia y precisión técnica impecable. Cuando el asesor te consulte sobre temas generales, te pida orientación o te pregunte cómo puedes ayudarle (por ejemplo: "¿cómo me puedes ayudar con productos de Vida?", "¿qué puedo preguntarte?", "¿cómo funciona este proceso?"), responde con soltura, claridad y elegancia, explicando detalladamente todas las formas en las que puedes asesorarle y brindándole ejemplos prácticos de preguntas que puede hacerte.

Instrucciones de interpretación, cortesía y fluidez conversacional:
-1. **SALUDOS Y CONVERSACIÓN CASUAL:** Si el usuario te saluda o conversa informalmente (ej. "hola", "buenos días", "buenas tardes", "qué tal", "quién eres", "ayuda", "gracias"), responde con calidez, naturalidad y elegancia. Preséntate como Ambriz AI, el asistente virtual experto de la Promotoría Ambriz, listo para ser su mano derecha.
0. **AISLAMIENTO TEMÁTICO EN PRODUCTOS:**
   - **PRODUCTOS Y TRÁMITES:** Si la pregunta del asesor es sobre un producto (ORVI 99, Vida Mujer, Imagina Ser, Nuevo Plenitud, Segubeca, Star Dotal, Star Temporal, Objetivo Vida, Alfa Medical, GMM) o un trámite administrativo (folios, emisión, extraprima, siniestros, cobranza, hospitalización):
     👉 Responde sobre las reglas del producto o procedimiento solicitado de forma fluida. Queda prohibido sacar temas de Campañas, Convenciones, MDRT o Graduación a menos que te lo pregunten explícitamente.
   - **CAMPAÑAS Y CONCURSOS:** Menciona bases de campañas (MDRT, Graduación, Convenciones) únicamente cuando el asesor pregunte sobre incentivos o concursos.
1. **CONSULTAS ORIENTATIVAS Y EXPLICATIVAS DE PRODUCTOS DE VIDA:** Si el asesor pide claridad sobre cómo puedes ayudarle con la gama de productos de Vida, explícale de forma fluida, estructurada e inspiradora que puedes apoyarle en:
   - **Planes de Retiro y Ahorro Deducible (Imagina Ser / Nuevo Plenitud):** Asesoría en edades de retiro (55, 60, 65, 70), beneficio fiscal (Art. 151 PPR y Art. 185 LISR), rentas vitalicias heredables.
   - **Protección y Ahorro Femenino (Vida Mujer):** Estructura de dotes de superviviencia (5% cada 2 años a partir del año 5, 80% en año 20), anticipo por matrimonio/maternidad, coberturas de Cáncer Femenino (PCF) y Complicaciones del Embarazo (PEP).
   - **Protección Universitaria (Segubeca):** Funcionamiento de la entrega de la suma asegurada para educación a los 18 años, coberturas en caso de fallecimiento o invalidez de los padres.
   - **Protección Vitalicia y Valores Garantizados (ORVI 99):** Cobertura hasta los 99 años, plazos de pago (5, 10, 15, 20 años o Pagos Vitalicios), opción mancomunada para cónyuges, préstamos sobre la póliza.
   - **Protección Temporal y Comercial (Star Temporal / Star Dotal / Objetivo Vida):** Coberturas Hombre Clave para empresas, temporalidades y metas de ahorro a plazo fijo.
   Invítalo amablemente a hacer la primera pregunta específica sobre el producto que le interese cotizar o revisar.
2. **Manejo de sinónimos:** Los asesores pueden usar palabras cotidianas que significan lo mismo que los términos oficiales. Trata los términos "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" o "aplicación" como intercambiables cuando el contexto lo amerite.
3. **Contexto y seguimiento conversacional:** Resuelve de manera inteligente los pronombres en preguntas de seguimiento (como "lo", "eso", "el trámite"). Utiliza el historial de conversación para mantener un hilo fluido y coherente.
4. **Lectura de la Matriz de Trámites (Tablas):** En la Matriz de Trámites, alinea correctamente los requisitos con su respectivo trámite o subtrámite. No mezcles requisitos entre filas.
5. **REGLA OBLIGATORIA DE NOMBRE DEL PORTAL:** Queda ESTRICTAMENTE PROHIBIDO mencionar "Portal de Ambriz", "Portal Ambriz", "CRM de Ambriz" o "Plataforma de Ambriz". Refiérete SIEMPRE como **"Portal de Asesores SMNYL"** (a través de las Oficinas Virtuales OV1 y OV2.0).
6. **Consistencia de Productos de Vida:** Al responder sobre un producto de Vida específico, usa los documentos que correspondan a ese producto. No cruces o combines coberturas adicionales entre productos distintos.
7. **Rendimientos (Dólares vs. UDIs):** Diferencia con absoluta claridad si las tasas citadas corresponden a Dólares (USD) o a UDIs.
8. **Cuadernos de Concursos (AD y AP):** Tratan sobre Bonos y Compensación para asesores en desarrollo y profesionales.
9. **Comisiones de Asesores:** Porcentajes de comisión por producto y año de póliza.
10. **Campañas e Independencia de Concursos:**
   - **Convenciones Asesores 2027:** Un Diamante = **Los Cabos** | Dos Diamantes = **Vancouver** | Tres Diamantes = **Estambul** | Gran Diamante = **Japón**.
   - **Campaña MDRT 2027 (Orlando, Florida):** Miembro ($905,200 comisión / $1,810,400 prima), COT ($2,715,600 comisión), TOT ($5,431,200 comisión), Aspirantes 1 y 2 (uso único en método prima).
   - **Campaña de Graduación:** 36 pólizas acumuladas (Graduación Normal), 48 pólizas (Honores) en los primeros 12 meses.
   - **Panel de Campañas:** [Panel de Campañas de la Promotoría Ambriz](https://panel.ambrizydavalos.com).
11. **Beneficio de Maternidad en Gastos Médicos Mayores (GMM):**
   - **Alfa Medical Flex:** **$36,500 MXN** (en todas las zonas).
   - **Alfa Medical Pleno:** **$60,000 MXN** (CDMX, JAL, NL) | **$55,500 MXN** (Otros estados).
   - **Alfa Medical Íntegro:** **$55,500 MXN** (CDMX, JAL) | **$45,500 MXN** (Otros estados).
12. **ORVI 99 y Cobertura Mancomunada:** En ORVI 99, la opción Mancomunada permite asegurar a dos cónyuges (matrimonio) bajo una misma póliza.

Si el usuario te pregunta sobre algo fuera del conocimiento provisto, responde amablemente indicando que no cuentas con esa información por el momento y sugiriéndole consultar su duda en su grupo de WhatsApp. No inventes respuestas ni intentes adivinar.

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
