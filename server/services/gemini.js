import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getKnowledgeContext, getSemanticContext } from './knowledge.js';

const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];

// Both getSemanticContext and getKnowledgeContext format each source document
// the same way ("=== DOCUMENTO: <relativePath> ==="), so we can recover a
// deduped, friendly source list regardless of which retrieval method ran —
// this is what lets the UI show "esto lo saqué de: ..." under each answer.
function extractSources(knowledgeBase) {
  if (!knowledgeBase) return [];
  const matches = [...knowledgeBase.matchAll(/=== DOCUMENTO(?: PDF)?: ([^=]+?)(?:\s*\(relevancia semántica\))? ===/g)];
  const seen = new Set();
  const sources = [];
  for (const m of matches) {
    const relativePath = m[1].trim();
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);
    sources.push({
      path: relativePath,
      label: path.basename(relativePath, path.extname(relativePath)),
    });
  }
  // NOTE: deliberately NOT capped here — this list doubles as the candidate
  // pool for validating which documents the model says it actually used
  // (see resolveDeclaredSources), and the right one isn't always in the
  // top few by raw retrieval rank. Cap at the actual display call sites.
  return sources;
}

// Maps the document paths the model *says* it used (from the "[FUENTES: ...]"
// marker) back to friendly {path, label} objects — matched against the docs
// that were actually retrieved, so a typo'd/hallucinated path never shows up
// as a fake citation.
function resolveDeclaredSources(declaredPaths, retrievedSources) {
  const resolved = [];
  const seen = new Set();
  for (const declared of declaredPaths) {
    const normDeclared = declared.toLowerCase();
    const match = retrievedSources.find((s) => s.path.toLowerCase() === normDeclared)
      || retrievedSources.find((s) => s.path.toLowerCase().includes(normDeclared) || normDeclared.includes(s.path.toLowerCase()));
    if (match && !seen.has(match.path)) {
      seen.add(match.path);
      resolved.push(match);
    }
  }
  return resolved.slice(0, 4);
}

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
 * @param {Function} [onSources] - Optional callback with the list of source
 *   documents ({ path, label }) used to ground the answer, called once the
 *   knowledge context is ready (before the model starts generating).
 */
/**
 * After a real answer, asks a fast model for 2-3 natural follow-up
 * questions an advisor might ask next on the same topic. Best-effort only:
 * any failure just yields no suggestions, never breaks the main chat.
 */
async function generateFollowUps(genAI, userMessage, botResponseText) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = `Eres un asistente que sugiere preguntas de seguimiento para un asesor de seguros de SMNYL.

Dada la pregunta del asesor y la respuesta que recibió, sugiere exactamente 3 preguntas de seguimiento cortas, naturales y útiles que el asesor podría hacer a continuación sobre el mismo tema.

Responde ÚNICAMENTE con las 3 preguntas, una por línea, sin numeración, sin guiones, sin texto adicional.

PREGUNTA DEL ASESOR: ${userMessage}

RESPUESTA QUE RECIBIÓ: ${botResponseText.slice(0, 2500)}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Generous budget: this model spends some tokens "thinking" before
      // writing output, so a tight cap here truncates the answer to nothing.
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    });

    const text = result.response.text();
    return text
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 5 && line.includes('?'))
      .slice(0, 3);
  } catch (err) {
    console.warn('⚠️ No se pudieron generar preguntas de seguimiento:', err.message);
    return [];
  }
}

export async function streamChatResponse(history, userMessage, onChunk, onDone, onError, onSources = null, onFollowUps = null, onTextDone = null) {
  const currentKey = process.env.GEMINI_API_KEY;

  // If no Gemini API Key, run in smart local knowledge engine mode
  if (!currentKey) {
    console.log('⚡ Usando motor de conocimientos local de Ambriz AI (sin API key)...');
    return simulateStreamResponse(history, userMessage, onChunk, onDone, onError, onSources, onTextDone);
  }

  const genAI = new GoogleGenerativeAI(currentKey);

  try {
    // Prefer real semantic (RAG) search over the whole knowledge base; fall
    // back to the old keyword-based picker only if the vector index isn't
    // built yet or the embedding call fails for some reason.
    const knowledgeBase = (await getSemanticContext(userMessage, history)) || (await getKnowledgeContext(userMessage, history));
    // NOTE: we don't call onSources with the raw retrieved documents here —
    // retrieval often pulls a couple of irrelevant near-misses alongside the
    // right ones (similarity scores can land within hundredths of each
    // other). Citing "whatever got retrieved" mislabels answers with docs
    // the model never actually used. Instead we ask the model itself to
    // declare which of the provided documents it drew from (see the
    // "[FUENTES: ...]" marker below), and report only those.
    const retrievedSources = extractSources(knowledgeBase);
    const systemPrompt = `# IDENTIDAD

Eres Ambriz AI, un asistente virtual de inteligencia artificial de nivel experto, altamente fluido, conversacional, servicial y brillante de la Promotoría Ambriz, especialista oficial en Seguros Monterrey New York Life (SMNYL). Actúas como un consultor senior inteligente: conversación natural, empatía, elegancia y precisión técnica impecable.

# TONO Y COMPORTAMIENTO CONVERSACIONAL

1. **Saludos y conversación casual:** si el usuario saluda o conversa informalmente (ej. "hola", "buenos días", "quién eres", "ayuda", "gracias"), responde con calidez y naturalidad. Preséntate como Ambriz AI, listo para ser su mano derecha.
2. **Consultas orientativas ("¿cómo me puedes ayudar?", "¿qué puedo preguntarte?"):** explica con soltura y ejemplos prácticos que puedes apoyarle en Planes de Retiro (Imagina Ser / Nuevo Plenitud), Protección Femenina (Vida Mujer), Protección Universitaria (Segubeca), Protección Vitalicia (ORVI 99), Protección Temporal/Comercial (Star Temporal / Star Dotal / Objetivo Vida), Gastos Médicos Mayores (Alfa Medical), trámites (folios, emisión, extraprima, siniestros) y campañas/comisiones. Invítalo a hacer la primera pregunta específica.
3. **Aislamiento temático:** si la pregunta es sobre un producto o trámite específico, responde solo sobre eso — no menciones Campañas, Convenciones, MDRT o Graduación a menos que te lo pregunten explícitamente, y viceversa.
4. **Manejo de sinónimos:** trata "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" y "aplicación" como intercambiables cuando el contexto lo amerite.
5. **Seguimiento conversacional:** resuelve con inteligencia los pronombres en preguntas de seguimiento ("lo", "eso", "el trámite") usando el historial de la conversación.

# REGLAS DE PRECISIÓN (nunca las rompas)

1. **Nombre del portal:** nunca digas "Portal de Ambriz", "Portal Ambriz", "CRM de Ambriz" ni "Plataforma de Ambriz". Usa siempre **"Portal de Asesores SMNYL"** (Oficinas Virtuales OV1 y OV2.0).
2. **No mezclar productos:** al responder sobre un producto de Vida específico, usa solo los documentos de ese producto — no cruces coberturas adicionales entre productos distintos.
3. **Dólares vs. UDIs:** diferencia siempre con claridad si una tasa o monto citado es en Dólares (USD) o en UDIs.
4. **Matriz de Trámites (tablas):** alinea cada requisito con su trámite o subtrámite correspondiente — no mezcles requisitos entre filas.
5. **ORVI 99 Mancomunada:** la opción Mancomunada permite asegurar a dos cónyuges (matrimonio) bajo una misma póliza, compartiendo suma asegurada.
6. **Cuadernos de Concursos (AD y AP):** cubren Bonos y Compensación para asesores en desarrollo (AD) y profesionales (AP) — úsalos para interpretar esos documentos si se recuperan.
7. **Montos y requisitos vigentes (comisiones, MDRT, Graduación, maternidad GMM, destinos de Convenciones, etc.):** SIEMPRE usa las cifras que aparezcan en el CONOCIMIENTO PROVISTO abajo — nunca falles a un número que no esté ahí. Estos datos cambian con el tiempo, así que el documento provisto es la única fuente de verdad, no lo que "recuerdes" de una conversación anterior.

# QUÉ HACER SI NO SABES ALGO

Si la pregunta está fuera del conocimiento provisto, dilo amablemente y sugiere consultarlo en su grupo de WhatsApp. Nunca inventes ni adivines una respuesta.

# FORMATO DE RESPUESTA OBLIGATORIO (citado de fuentes)

Se te proveerán documentos marcados como "=== DOCUMENTO: <ruta> ===". Algunos pueden no ser relevantes para la pregunta — ignóralos. ANTES de escribir tu respuesta, en la primerísima línea de tu mensaje, escribe EXACTAMENTE en este formato (sin explicación adicional, sin markdown):
[FUENTES: <ruta1>|<ruta2>]
- Incluye SOLO las rutas (copiadas EXACTAMENTE como aparecen tras "=== DOCUMENTO: ") de los documentos que realmente usaste para construir la respuesta. Máximo 4.
- Si no usaste ningún documento del conocimiento provisto (ej. un saludo o pregunta general), escribe: [FUENTES: ninguno]
- Inmediatamente después, en la línea siguiente, escribe tu respuesta normal para el asesor (esa línea de fuentes nunca es visible para él, así que nunca la menciones ni te refieras a ella).

# CONOCIMIENTO PROVISTO PARA ESTA CONSULTA

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
        let fullBotText = ''; // only the VISIBLE answer, marker line excluded
        let sourcesResolved = false;
        let pendingBuffer = '';

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (!text) continue;
          receivedAnyChunk = true;

          if (sourcesResolved) {
            fullBotText += text;
            onChunk(text);
            continue;
          }

          pendingBuffer += text;
          const markerMatch = pendingBuffer.match(/^\s*\[FUENTES:([^\]]*)\]\s*\n?/);
          if (markerMatch) {
            sourcesResolved = true;
            const declared = markerMatch[1].trim();
            const declaredPaths = declared.toLowerCase() === 'ninguno'
              ? []
              : declared.split('|').map((p) => p.trim()).filter(Boolean);
            if (onSources) onSources(resolveDeclaredSources(declaredPaths, retrievedSources));

            const remainder = pendingBuffer.slice(markerMatch[0].length);
            pendingBuffer = '';
            if (remainder) {
              fullBotText += remainder;
              onChunk(remainder);
            }
          } else if (pendingBuffer.length > 400 || (pendingBuffer.trim().length > 0 && pendingBuffer.trimStart()[0] !== '[')) {
            // The model didn't open with the expected marker (or it's
            // dragging on too long) — give up waiting, flush what we have,
            // and fall back to the raw retrieval list rather than showing
            // no sources at all.
            sourcesResolved = true;
            if (onSources) onSources(retrievedSources.slice(0, 4));
            fullBotText += pendingBuffer;
            onChunk(pendingBuffer);
            pendingBuffer = '';
          }
        }

        // Stream ended while still buffering a short/marker-less response.
        if (!sourcesResolved && pendingBuffer) {
          if (onSources) onSources(retrievedSources.slice(0, 4));
          fullBotText += pendingBuffer;
          onChunk(pendingBuffer);
        }

        if (receivedAnyChunk) {
          success = true;
          console.log(`✅ Respuesta transmitida exitosamente usando ${modelName}.`);
          // Let the caller unblock the UI (re-enable input) right away — the
          // follow-up suggestions below are a slower, non-blocking extra.
          if (onTextDone) onTextDone();
          if (onFollowUps) {
            const followUps = await generateFollowUps(genAI, userMessage, fullBotText);
            onFollowUps(followUps);
          }
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
      return await simulateStreamResponse(history, userMessage, onChunk, onDone, onError, onSources, onTextDone);
    } catch (fallbackErr) {
      onError(fallbackErr || err);
    }
  }
}

async function simulateStreamResponse(history, userMessage, onChunk, onDone, onError, onSources = null, onTextDone = null) {
  const query = userMessage.toLowerCase().trim();
  let responseText = '';

  try {
    // Bug crítico corregido: esta variable nunca se cargaba, así que cualquier pregunta
    // que no coincidiera con una respuesta fija de abajo hacía que este modo tronara
    // en el catch y devolviera "No pude procesar la consulta en este momento".
    const knowledgeContext = await getKnowledgeContext(userMessage, history);
    if (onSources) onSources(extractSources(knowledgeContext).slice(0, 4));

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
      if (onTextDone) onTextDone();
      onDone();
    }
  }, 25); // 25ms per word for rapid display
}
