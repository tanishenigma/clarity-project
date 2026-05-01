import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { connectDB } from "../db";
import { Types } from "mongoose";
import { AIClient } from "../ai-client";
import { ContentModel, PodcastModel } from "../models";

export class PodcastGenerationAgent {
  private model: AIClient;
  private ttsService = "elevenlabs"; // or use text-to-speech-1 from OpenAI

  constructor() {
    this.model = new AIClient(
      process.env.AI_MODEL || "gemini-2.0-flash-exp",
      0.8,
    );
  }

  /**
   * Generate podcast script from content
   */
  async generatePodcastScript(
    contentId: string,
    spaceId: string,
    style: "conversational" | "formal" = "conversational",
  ): Promise<string> {
    await connectDB();

    const content = await ContentModel.findById(
      new Types.ObjectId(contentId),
    ).lean();

    if (!content || !(content as any).processed?.rawText) {
      throw new Error("Content not found or not processed");
    }

    const styleGuide =
      style === "conversational"
        ? "Make it engaging and conversational, like a friendly tutor explaining to a student. Include questions and explanations."
        : "Make it formal and structured, like an educational lecture. Focus on clarity and completeness.";

    const prompt = `Create an engaging podcast script for educational content.

${styleGuide}

Duration: 15 minutes (approximately 2000-2500 words)

Content to convert:
${(content as any).processed.rawText.substring(0, 2000)}

Include:
1. Hook/Introduction (30 seconds)
2. Main topics with explanations
3. Key takeaways
4. Call to action

Format as a natural podcast transcript with [SPEAKER:] tags and [MUSIC/SFX:] where appropriate.`;

    const response = await this.model.invoke([new HumanMessage(prompt)]);
    const script = response.content.toString();

    // Save script to database
    await PodcastModel.create({
      contentId: new Types.ObjectId(contentId),
      spaceId: new Types.ObjectId(spaceId),
      script,
      style,
      audioUrl: null,
      duration: 0,
      generatedAt: new Date(),
      status: "script_ready",
    });

    return script;
  }

  /**
   * Generate audio from script using TTS
   */
  async generateAudioFromScript(
    podcastId: string,
    voice: "male" | "female" = "female",
  ): Promise<{ audioUrl: string; duration: number }> {
    await connectDB();

    const podcast = await PodcastModel.findById(
      new Types.ObjectId(podcastId),
    ).lean();

    if (!podcast) {
      throw new Error("Podcast not found");
    }

    // TODO: Integrate with ElevenLabs API or OpenAI TTS
    // This is a placeholder implementation
    const audioUrl = `https://cdn.example.com/podcasts/${podcastId}.mp3`;
    const estimatedDuration =
      Math.ceil((podcast as any).script.split(" ").length / 130) * 60; // ~130 words per minute

    // Update podcast with audio info
    await PodcastModel.updateOne(
      { _id: new Types.ObjectId(podcastId) },
      {
        $set: {
          audioUrl,
          duration: estimatedDuration,
          voice,
          status: "audio_generated",
          audioGeneratedAt: new Date(),
        },
      },
    );

    return {
      audioUrl,
      duration: estimatedDuration,
    };
  }

  /**
   * Create AI conversational podcast (back-and-forth dialogue)
   */
  async generateConversationalPodcast(
    contentId: string,
    spaceId: string,
  ): Promise<string> {
    await connectDB();

    const content = await ContentModel.findById(
      new Types.ObjectId(contentId),
    ).lean();

    if (!content || !(content as any).processed?.rawText) {
      throw new Error("Content not found or not processed");
    }

    const prompt = `Create an engaging conversational podcast dialogue between a tutor and student.

Format:
[TUTOR]: Question or explanation
[STUDENT]: Curious response or follow-up question
[TUTOR]: Answer with deeper insight

Duration: 12 minutes (approximately 1800 words)

Content to teach:
${(content as any).processed.rawText.substring(0, 2000)}

Make it:
- Interactive and engaging
- Pedagogically sound (tutor uses Socratic method)
- Natural dialogue with realistic pauses
- Include misconceptions and corrections
- End with summary and resources`;

    const dialogueResponse = await this.model.invoke([
      new HumanMessage(prompt),
    ]);
    const dialogue = dialogueResponse.content.toString();

    // Save conversational podcast
    await PodcastModel.create({
      contentId: new Types.ObjectId(contentId),
      spaceId: new Types.ObjectId(spaceId),
      script: dialogue,
      style: "conversational_dialogue",
      type: "dialogue",
      audioUrl: null,
      duration: 0,
      generatedAt: new Date(),
      status: "script_ready",
    });

    return dialogue;
  }

  /**
   * Get podcast for content
   */
  async getPodcast(contentId: string): Promise<any> {
    await connectDB();
    return PodcastModel.findOne({
      contentId: new Types.ObjectId(contentId),
    }).lean();
  }

  /**
   * Get all podcasts for space
   */
  async getPodcastsForSpace(spaceId: string): Promise<any[]> {
    await connectDB();
    return PodcastModel.find({ spaceId: new Types.ObjectId(spaceId) })
      .sort({ generatedAt: -1 })
      .lean();
  }
}
