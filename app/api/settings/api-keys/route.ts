import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import UserModel from "@/lib/models/User";
import type { APISettings } from "@/lib/types";

/** Returns true if a string looks like a masked key (contains ****) */
function isMasked(value: string | undefined): boolean {
  return !!value && value.includes("****");
}

/** Return only the first 4 + last 4 chars for display, never the full key */
function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 4) + "****" + key.substring(key.length - 4);
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(
      "[Settings/API-Keys GET] Fetching API settings for userId:",
      userId,
    );

    await connectDB();
    const user = await UserModel.findById(userId).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const apiSettings = user.apiSettings || {
      primaryProvider: "gemini",
      apiKeys: {},
      fallbackEnabled: true,
      fallbackProvider: "euri",
      updatedAt: new Date(),
    };

    // Return masked keys + a `hasKeys` map so the UI can show "saved" state
    // without leaking full keys to the client.
    return NextResponse.json({
      ...apiSettings,
      apiKeys: {
        gemini: apiSettings.apiKeys?.gemini
          ? maskApiKey(apiSettings.apiKeys.gemini)
          : undefined,
        openai: apiSettings.apiKeys?.openai
          ? maskApiKey(apiSettings.apiKeys.openai)
          : undefined,
        euri: apiSettings.apiKeys?.euri
          ? maskApiKey(apiSettings.apiKeys.euri)
          : undefined,
        groq: apiSettings.apiKeys?.groq
          ? maskApiKey(apiSettings.apiKeys.groq)
          : undefined,
      },
      hasKeys: {
        gemini: !!apiSettings.apiKeys?.gemini,
        openai: !!apiSettings.apiKeys?.openai,
        euri: !!apiSettings.apiKeys?.euri,
        groq: !!apiSettings.apiKeys?.groq,
      },
    });
  } catch (error) {
    console.error("Error fetching API settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch API settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updates: Partial<APISettings> = await request.json();

    console.log(
      "[Settings/API-Keys PUT] Saving API settings for userId:",
      userId,
    );

    await connectDB();

    // Helper: only update a key if the user provided a real new value
    // (non-empty and not the masked placeholder returned by GET)
    const isRealKey = (val: string | undefined) =>
      !!val && val.trim() !== "" && !isMasked(val);

    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          "apiSettings.primaryProvider": updates.primaryProvider,
          "apiSettings.fallbackEnabled": updates.fallbackEnabled,
          "apiSettings.fallbackProvider": updates.fallbackProvider,
          "apiSettings.updatedAt": new Date(),
          ...(isRealKey(updates.apiKeys?.gemini) && {
            "apiSettings.apiKeys.gemini": updates.apiKeys!.gemini,
          }),
          ...(isRealKey(updates.apiKeys?.openai) && {
            "apiSettings.apiKeys.openai": updates.apiKeys!.openai,
          }),
          ...(isRealKey(updates.apiKeys?.euri) && {
            "apiSettings.apiKeys.euri": updates.apiKeys!.euri,
          }),
          ...(isRealKey(updates.apiKeys?.groq) && {
            "apiSettings.apiKeys.groq": updates.apiKeys!.groq,
          }),
          ...(updates.apiKeys?.custom &&
            isRealKey(updates.apiKeys.custom.apiKey) && {
              "apiSettings.apiKeys.custom": updates.apiKeys.custom,
            }),
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(
      "[Settings/API-Keys PUT] API settings updated successfully for userId:",
      userId,
    );

    return NextResponse.json({
      success: true,
      message: "API settings updated",
    });
  } catch (error) {
    console.error("Error updating API settings:", error);
    return NextResponse.json(
      { error: "Failed to update API settings" },
      { status: 500 },
    );
  }
}
