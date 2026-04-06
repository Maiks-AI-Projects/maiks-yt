import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey || "");
// Using gemini-1.5-flash for efficiency and low latency
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface SafetyCheckResult {
  safetyScore: number;
  flaggedTerms: string[];
}

export interface ModerationResult {
  decision: 'Allow' | 'Block' | 'Flag';
  reason: string;
}

/**
 * AIService handles integration with the Gemini API for content moderation and generation.
 */
export class AIService {
  /**
   * Checks profile content for safety and appropriateness.
   * Returns a safety score and a list of flagged terms.
   */
  static async checkProfileContent(username: string, bio: string): Promise<SafetyCheckResult> {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AIService.checkProfileContent skipping AI check.");
      return { safetyScore: 100, flaggedTerms: [] };
    }

    const prompt = `
      Review the following profile content for safety, appropriateness, and community guidelines.
      Username: "${username}"
      Bio: "${bio}"
      
      Provide a safety score from 0 (very unsafe/offensive) to 100 (perfectly safe).
      List any specific flagged terms if found.
      
      Return ONLY a JSON object with this structure:
      {
        "safetyScore": number,
        "flaggedTerms": string[]
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Attempt to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { safetyScore: 100, flaggedTerms: [] };
    } catch (error: any) {
      console.error("AIService.checkProfileContent error:", error.message || error);
      // Graceful fallback: assume safe if API fails to avoid blocking users
      return { safetyScore: 100, flaggedTerms: [] };
    }
  }

  /**
   * Moderates a chat message for toxicity, spam, or inappropriate content.
   * Returns a decision (Allow, Block, Flag) and a reason.
   */
  static async moderateChatMessage(message: string): Promise<ModerationResult> {
    if (!apiKey) {
      return { decision: 'Allow', reason: 'AI Moderation disabled' };
    }

    const prompt = `
      Analyze the following chat message for toxicity, spam, or inappropriate content.
      Message: "${message}"
      
      Determine if it should be Allowed, Blocked (offensive/spam), or Flagged (needs human review).
      
      Return ONLY a JSON object with this structure:
      {
        "decision": "Allow" | "Block" | "Flag",
        "reason": "short explanation"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { decision: 'Allow', reason: 'Automatic pass' };
    } catch (error: any) {
      console.error("AIService.moderateChatMessage error:", error.message || error);
      return { decision: 'Allow', reason: 'Error during moderation' };
    }
  }

  /**
   * Generates alt text for hardware photos.
   * Currently a placeholder for future multimodal implementation.
   */
  static async generateAltText(imageUrl: string): Promise<string> {
    if (!apiKey) {
      return "Alt text placeholder (AI disabled)";
    }

    // Future implementation will use gemini-1.5-flash multimodal capabilities
    // to analyze hardware components from the provided image.
    
    try {
      // Placeholder for actual image processing logic
      return `Hardware component analysis for: ${imageUrl}`; 
    } catch (error: any) {
      console.error("AIService.generateAltText error:", error.message || error);
      return "Error generating alt text.";
    }
  }
}
