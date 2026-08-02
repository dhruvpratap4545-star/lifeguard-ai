import type { ChatMessage } from "@workspace/db";
import OpenAI from "openai";

type MessageContext = "emergency" | "general" | "firstaid" | string;

// ─── Keyword Fallback Data ─────────────────────────────────────────────────

const EMERGENCY_RESPONSES = [
  "I've detected your emergency signal. Stay calm — help is on the way. Your GPS coordinates are being broadcast. Can you confirm your current condition?",
  "Emergency protocol activated. Your location is being shared. If you're able, press the SAFE button once you're okay. Is anyone else with you?",
  "Your SOS has been logged and your contacts are being alerted. Try to stay still if you've had a fall. Is there any pain in your neck or back?",
  "I'm with you. Your emergency has been registered. Emergency services can be reached at 911. What happened? Can you describe the incident?",
];

const FALL_RESPONSES = [
  "I detected a potential fall event. Are you okay? If you cannot respond within 15 seconds, emergency contacts will be notified. Press SAFE if you're uninjured.",
  "Fall detected at your last known location. Please confirm your status. If you're on the ground and can't get up, try to stay calm and call out for help.",
  "Your fall has been logged. If you're injured: do not move if you suspect a spinal injury. Call 911 immediately if you're in severe pain or cannot move.",
  "I registered impact data from your device. Are you injured? If you're experiencing chest pain, difficulty breathing, or can't feel your limbs, call 911 now.",
];

const FIRSTAID_RESPONSES: Record<string, string> = {
  "bleeding": "For bleeding: Apply firm, direct pressure to the wound with a clean cloth. Elevate the injured area above heart level if possible. Do not remove the cloth — add more on top if needed. Call 911 if bleeding is severe or does not stop within 10 minutes.",
  "cpr": "CPR Instructions: 1) Check the scene is safe. 2) Check for responsiveness — tap shoulders, shout. 3) Call 911. 4) Begin chest compressions: 30 hard, fast compressions at 2 inches deep in the center of the chest. 5) Give 2 rescue breaths. 6) Repeat until help arrives or the person recovers.",
  "choking": "Choking response: If conscious, give 5 back blows between shoulder blades, then 5 abdominal thrusts (Heimlich). Repeat until the object clears or person loses consciousness. If unconscious, begin CPR and look for the object before giving breaths.",
  "burn": "For burns: Cool the burn with cool (not cold) running water for 10-20 minutes. Do not use ice, butter, or creams. Cover loosely with a clean dressing. Seek medical help for burns larger than 3 inches, or on face/hands/genitals/joints.",
  "fracture": "For suspected fractures: Immobilize the area — do not try to straighten it. Apply ice packs (wrapped in cloth) to reduce swelling. Call 911 if it's an open fracture, or if the person cannot bear weight. Keep the person still and warm until help arrives.",
  "shock": "Signs of shock: pale, cold, clammy skin; rapid/weak pulse; confusion; fainting. Response: Lay the person down, elevate legs 12 inches (unless head/spine injury suspected). Keep warm with a blanket. Do not give food or water. Call 911 immediately.",
  "heart attack": "Heart attack signs: chest pain/pressure, pain radiating to arm/jaw, shortness of breath, nausea. Response: Call 911 immediately. Have the person sit/lie in a comfortable position. Loosen tight clothing. If not allergic and not contraindicated, give aspirin. Begin CPR if they become unresponsive.",
  "seizure": "During a seizure: Do NOT restrain them or put anything in their mouth. Clear away dangerous objects. Protect their head with something soft. Time the seizure. After: turn them on their side (recovery position). Call 911 if seizure lasts >5 minutes or person doesn't regain consciousness.",
  "stroke": "FAST stroke recognition: Face drooping, Arm weakness, Speech difficulty, Time to call 911. Note the time symptoms started. Do not give food, water, or medication. Keep the person calm and still until emergency services arrive.",
  "allergic": "Severe allergic reaction (anaphylaxis): Use epinephrine auto-injector (EpiPen) if available — inject into outer thigh. Call 911 immediately. If breathing stops, begin CPR. The person may need a second dose of epinephrine after 5-15 minutes if no improvement.",
};

const GENERAL_RESPONSES = [
  "I'm your LifeGuard AI companion. I'm here to assist with safety monitoring, emergency coordination, and first aid guidance. How can I help you today?",
  "Your safety is my priority. I'm actively monitoring your device sensors. Is there anything specific you'd like help with — first aid information, emergency contacts, or safety tips?",
  "I'm here. Your sensors are active and your emergency contacts are on standby. What do you need?",
  "LifeGuard is monitoring. If you're in an emergency, use the SOS button or go to the Emergency screen. For first aid help, describe the situation and I'll guide you through it.",
];

const CHECK_IN_RESPONSES = [
  "Check-in confirmed. You're safe. All systems normal. Your location was last updated and your contacts are listed. Anything you need?",
  "Status check acknowledged. No active emergencies. Sensor monitoring is running. Stay safe out there.",
  "You're all clear. Emergency contacts are saved, sensors are armed, and I'm here whenever you need me.",
];

function detectTopic(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [keyword] of Object.entries(FIRSTAID_RESPONSES)) {
    if (lower.includes(keyword)) return keyword;
  }
  if (lower.includes("fall") || lower.includes("fell") || lower.includes("fallen")) return "fall";
  if (lower.includes("emergency") || lower.includes("help") || lower.includes("sos")) return "emergency";
  if (lower.includes("check") || lower.includes("safe") || lower.includes("okay") || lower.includes("ok")) return "checkin";
  return null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateKeywordResponse(userMessage: string, context: MessageContext): string {
  const topic = detectTopic(userMessage);

  if (topic && topic in FIRSTAID_RESPONSES) {
    return FIRSTAID_RESPONSES[topic];
  }

  if (context === "emergency" || topic === "emergency") {
    return pickRandom(EMERGENCY_RESPONSES);
  }

  if (context === "firstaid" || topic === "fall") {
    return pickRandom(FALL_RESPONSES);
  }

  if (topic === "checkin") {
    return pickRandom(CHECK_IN_RESPONSES);
  }

  const lower = userMessage.toLowerCase();
  if (lower.includes("first aid") || lower.includes("hurt") || lower.includes("injured") || lower.includes("pain")) {
    return "I can help with first aid guidance. Please describe the situation: What type of injury or emergency? Common topics I can assist with: bleeding, CPR, choking, burns, fractures, shock, heart attack, seizure, stroke, or allergic reactions.";
  }

  if (lower.includes("contact") || lower.includes("call") || lower.includes("phone")) {
    return "You can manage your emergency contacts in the Contacts tab. When an emergency is triggered, your primary contact will be alerted with your GPS coordinates. Make sure at least one contact is marked as primary.";
  }

  if (lower.includes("sensor") || lower.includes("detect") || lower.includes("fall detection")) {
    return "Your fall detection sensor uses the device accelerometer. It triggers when it detects a sudden impact above 25 m/s² followed by inactivity. Go to the Emergency screen and tap 'ARM SENSOR' to activate it. The 15-second countdown gives you time to cancel false positives.";
  }

  if (lower.includes("gps") || lower.includes("location")) {
    return "GPS tracking broadcasts your coordinates when an emergency is detected. Your location history is stored locally and can be viewed on the Dashboard. Make sure location permissions are granted to LifeGuard AI for this feature to work.";
  }

  return `I'm your LifeGuard AI safety companion. I'm here to help with emergencies, first aid guidance, and safety monitoring. You can ask me about: first aid procedures (CPR, bleeding, burns, fractures), how to set up emergency contacts, or how the fall detection sensor works. What do you need?`;
}

// ─── LLM Client ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LifeGuard AI, a calm and expert emergency safety companion built into a personal safety app. Your role is to provide clear, accurate, and reassuring guidance during emergencies, first aid situations, and safety monitoring.

Key principles:
- Stay calm and composed — your tone directly affects how a distressed user feels
- Be concise and actionable — in an emergency, every second counts
- Prioritize life safety above all else — always recommend calling 911 for life-threatening situations
- Draw on accurate first aid and emergency response protocols (Red Cross, AHA, FEMA guidelines)
- Be empathetic but efficient — acknowledge the user's situation briefly, then guide them
- Never give medical diagnoses, but do give clear first aid instructions

You assist with:
- Emergency response and SOS coordination
- Step-by-step first aid guidance (CPR, bleeding, burns, fractures, choking, shock, seizures, strokes, allergic reactions, heart attacks)
- Fall detection alerts and injury assessment
- Emergency contact management and GPS tracking features
- Personal safety tips and preparedness

When the context is "emergency", treat it as an active emergency situation. When the context is "firstaid", focus on first aid guidance. For general conversations, be helpful and reassuring about the app's safety features.

Always end with a clear next step or question to keep the user engaged and safe.`;

let _client: OpenAI | null | undefined = undefined; // undefined = not yet checked

function getOpenAIClient(): OpenAI | null {
  if (_client !== undefined) return _client;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    _client = null;
    return null;
  }

  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

// ─── Main Export ──────────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 10;

export async function generateAIResponse(
  userMessage: string,
  context: MessageContext,
  history: ChatMessage[]
): Promise<string> {
  const client = getOpenAIClient();

  if (!client) {
    return generateKeywordResponse(userMessage, context);
  }

  try {
    // Build conversation history for context (exclude the just-inserted user message
    // since we pass it separately as the final user turn)
    const historyMessages = history
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // The last message in history is the user's current message (just inserted).
    // If it matches, avoid duplicating it.
    const lastHistoryMsg = historyMessages[historyMessages.length - 1];
    const conversationMessages: OpenAI.ChatCompletionMessageParam[] =
      lastHistoryMsg?.role === "user" && lastHistoryMsg.content === userMessage
        ? [
            { role: "system", content: buildSystemPromptWithContext(context) },
            ...historyMessages,
          ]
        : [
            { role: "system", content: buildSystemPromptWithContext(context) },
            ...historyMessages,
            { role: "user", content: userMessage },
          ];

    const response = await client.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: conversationMessages,
    });

    const content = response.choices[0]?.message?.content;
    if (content && content.trim().length > 0) {
      return content.trim();
    }

    return generateKeywordResponse(userMessage, context);
  } catch (err) {
    console.error("[aiCompanion] LLM call failed, falling back to keyword responses:", err);
    return generateKeywordResponse(userMessage, context);
  }
}

function buildSystemPromptWithContext(context: MessageContext): string {
  let contextNote = "";
  if (context === "emergency") {
    contextNote = "\n\nIMPORTANT: The user is currently in an ACTIVE EMERGENCY. Prioritize immediate safety actions. Keep responses brief and actionable.";
  } else if (context === "firstaid") {
    contextNote = "\n\nContext: The user needs first aid guidance. Focus on clear, step-by-step instructions.";
  }
  return SYSTEM_PROMPT + contextNote;
}
