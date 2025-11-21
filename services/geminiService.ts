import { GoogleGenAI } from "@google/genai";
import { AI_HOST_NAME } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateHostResponse = async (
  message: string, 
  context: {
    users: string[],
    topic: string,
    language: string
  }
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "My voice is currently unavailable.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `You are ${AI_HOST_NAME}, a helpful and friendly language tutor and moderator for a 3D voice exchange room.
        
        Room Details:
        - Target Language: ${context.language}
        - Discussion Topic: ${context.topic}
        - Users Present: ${context.users.join(', ')}

        Your Role:
        - Correct grammar gently if asked.
        - Keep the conversation flowing around the topic.
        - Encourage shy users.
        - Keep responses short (max 2 sentences), conversational, and fun.
        - If the user speaks a different language, try to bridge the gap or answer in the target language.`,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm listening!";
  }
};
