import { type NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import UserModel from "@/lib/models/User";
import SpaceModel from "@/lib/models/Space";
import ConversationModel from "@/lib/models/Conversation";
import GlobalConversationModel from "@/lib/models/GlobalConversation";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";
import ContentModel from "@/lib/models/Content";
import PodcastModel from "@/lib/models/Podcast";
import StudyTimerModel from "@/lib/models/StudyTimer";
import StudyTimerHistoryModel from "@/lib/models/StudyTimerHistory";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";
import UserActivityModel from "@/lib/models/UserActivity";
import UserStreakModel from "@/lib/models/UserStreak";
import DocumentModel from "@/lib/models/Document";
import ChatHistoryModel from "@/lib/models/ChatHistory";
import MindmapModel from "@/lib/models/Mindmap";
import LearningSpaceModel from "@/lib/models/LearningSpace";
import StudyProgressModel from "@/lib/models/StudyProgress";
import StudentProfileModel from "@/lib/models/StudentProfile";
import SpaceInviteModel from "@/lib/models/SpaceInvite";
import SummaryModel from "@/lib/models/Summary";
import StudySessionModel from "@/lib/models/StudySession";
import ChatUploadModel from "@/lib/models/ChatUpload";
import NoteModel from "@/lib/models/Note";
import {
  createUser,
  loginUser,
  createAuthJwt,
  hashPassword,
  setJwtCookie,
  logout,
  getCurrentUser,
} from "@/lib/auth";
import { connectDB } from "@/lib/db";

const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { action, email, username, password, credential } =
      await request.json();

    if (action === "register") {
      if (!email || !username || !password) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 },
        );
      }

      const user = await createUser(email, username, password);
      const jwtToken = await createAuthJwt(user._id!.toString());
      await setJwtCookie(jwtToken);

      return NextResponse.json({
        user: {
          id: user._id?.toString(),
          email: user.email,
          username: user.username,
          theme: user.theme,
        },
      });
    }

    if (action === "login") {
      if (!email || !password) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 },
        );
      }

      const user = await loginUser(email, password);
      const jwtToken = await createAuthJwt(user._id!.toString());
      await setJwtCookie(jwtToken);

      return NextResponse.json({
        user: {
          id: user._id?.toString(),
          email: user.email,
          username: user.username,
          theme: user.theme,
        },
      });
    }

    if (action === "google_login") {
      if (!credential) {
        return NextResponse.json(
          { error: "Missing Google credential" },
          { status: 400 },
        );
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return NextResponse.json(
          { error: "Invalid Google token" },
          { status: 400 },
        );
      }

      const googleEmail = payload.email;
      const googleName = payload.name;
      const googleId = payload.sub;

      let user = await UserModel.findOne({ email: googleEmail });

      if (!user) {
        const randomPassword = Math.random().toString(36).slice(-10) + "A1!";
        const passwordHash = await hashPassword(randomPassword);
        const generatedUsername =
          googleName?.replace(/\s+/g, "").toLowerCase() ||
          `user_${googleId.slice(0, 5)}`;

        user = await UserModel.create({
          email: googleEmail,
          username: generatedUsername,
          passwordHash,
          authProvider: "google",
          theme: "dark",
          subscriptionTier: "free",
          studyStreak: 0,
          totalStudyMinutes: 0,
        });
      }

      const jwtToken = await createAuthJwt(user._id!.toString());
      await setJwtCookie(jwtToken);

      return NextResponse.json({
        user: {
          id: user._id?.toString(),
          email: user.email,
          username: user.username,
          theme: user.theme,
        },
      });
    }

    if (action === "logout") {
      await logout();
      return NextResponse.json({ success: true });
    }

    if (action === "delete_account") {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = currentUser._id?.toString();
      const userObjectId = currentUser._id;

      // Delete every document tied to this user across all collections in parallel
      await Promise.allSettled([
        SpaceModel.deleteMany({ userId }),
        ConversationModel.deleteMany({ userId }),
        GlobalConversationModel.deleteMany({ userId }),
        FlashcardModel.deleteMany({ userId }),
        QuizModel.deleteMany({ userId }),
        ContentModel.deleteMany({ userId }),
        PodcastModel.deleteMany({ userId }),
        StudyTimerModel.deleteMany({ userId }),
        StudyTimerHistoryModel.deleteMany({ userId }),
        DailyStudyStatsModel.deleteMany({ userId }),
        UserActivityModel.deleteMany({ userId }),
        UserStreakModel.deleteMany({ userId }),
        DocumentModel.deleteMany({ userId }),
        ChatHistoryModel.deleteMany({ userId }),
        ChatUploadModel.deleteMany({ userId }),
        MindmapModel.deleteMany({ userId }),
        LearningSpaceModel.deleteMany({ userId }),
        StudyProgressModel.deleteMany({ userId }),
        StudentProfileModel.deleteMany({ userId }),
        SpaceInviteModel.deleteMany({
          $or: [{ inviterId: userObjectId }, { inviteeId: userObjectId }],
        }),
        SummaryModel.deleteMany({ userId }),
        StudySessionModel.deleteMany({ userId }),
        NoteModel.deleteMany({ userId }),
      ]);

      // Delete the user document itself
      await UserModel.findByIdAndDelete(userObjectId);

      // Clear session cookie
      await logout();

      return NextResponse.json({ success: true });
    }

    if (action === "me") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ user: null });
      }

      return NextResponse.json({
        user: {
          id: user._id?.toString(),
          email: user.email,
          username: user.username,
          theme: user.theme,
          studyStreak: user.studyStreak,
          totalStudyMinutes: user.totalStudyMinutes,
        },
      });
    }
    if (action === "update_profile") {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { newUsername } = await request.json();
      if (!newUsername || newUsername.trim().length < 3) {
        return NextResponse.json(
          { error: "Invalid username" },
          { status: 400 },
        );
      }

      await UserModel.findByIdAndUpdate(currentUser._id, {
        username: newUsername,
      });

      return NextResponse.json({ success: true, username: newUsername });
    }
    if (action === "update_password") {
      const userSession = await getCurrentUser();
      if (!userSession) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { currentPassword, newPassword, isGoogleUser } =
        await request.json();

      if (!isGoogleUser) {
        const verifiedUser = await loginUser(
          userSession.email,
          currentPassword,
        );
        if (!verifiedUser) {
          return NextResponse.json(
            { error: "Incorrect current password" },
            { status: 400 },
          );
        }
      }

      const userDoc = await UserModel.findById(userSession._id);
      if (!userDoc) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!newPassword || typeof newPassword !== "string") {
        return NextResponse.json(
          { error: "New password is required" },
          { status: 400 },
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 },
        );
      }

      userDoc.passwordHash = await hashPassword(newPassword);
      await userDoc.save();

      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 500 },
    );
  }
}
