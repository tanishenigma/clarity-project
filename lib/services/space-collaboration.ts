import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import SpaceModel from "@/lib/models/Space";
import SpaceInviteModel from "@/lib/models/SpaceInvite";
import type { ISpaceInvite } from "@/lib/models/SpaceInvite";

export type SpaceInvite = ISpaceInvite;

export class SpaceCollaborationManager {
  /**
   * Share space with collaborator
   */
  async shareSpace(
    spaceId: string,
    userEmail: string,
    role: "viewer" | "contributor" | "admin",
    invitedByUserId: string,
  ): Promise<ISpaceInvite> {
    await connectDB();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Invite valid for 7 days

    const invite = await SpaceInviteModel.create({
      spaceId: new Types.ObjectId(spaceId),
      invitedEmail: userEmail,
      invitedBy: new Types.ObjectId(invitedByUserId),
      role,
      status: "pending",
      expiresAt,
    });

    // TODO: Send email invite with link

    return invite.toObject();
  }

  /**
   * Accept space invite
   */
  async acceptInvite(inviteId: string, userId: string): Promise<void> {
    await connectDB();

    const invite = await SpaceInviteModel.findById(
      new Types.ObjectId(inviteId),
    ).lean();

    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending")
      throw new Error("Invite already processed");
    if (new Date() > invite.expiresAt) throw new Error("Invite has expired");

    // Add user as collaborator
    await SpaceModel.updateOne(
      { _id: invite.spaceId },
      { $push: { collaborators: new Types.ObjectId(userId) } as any },
    );

    // Mark invite as accepted
    await SpaceInviteModel.updateOne(
      { _id: new Types.ObjectId(inviteId) },
      { $set: { status: "accepted" } },
    );
  }

  /**
   * Get space collaborators with permissions
   */
  async getCollaborators(
    spaceId: string,
  ): Promise<Array<{ userId: Types.ObjectId; role: string; joinedAt: Date }>> {
    await connectDB();

    const space = await SpaceModel.findById(new Types.ObjectId(spaceId)).lean();

    if (!space) throw new Error("Space not found");

    // Include owner and collaborators
    return [
      {
        userId: space.userId,
        role: "admin",
        joinedAt: space.createdAt,
      },
      // Additional collaborators would be fetched from another collection
    ];
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(
    spaceId: string,
    userId: string,
    newRole: "viewer" | "contributor" | "admin",
  ): Promise<void> {
    await connectDB();

    const space = await SpaceModel.findById(new Types.ObjectId(spaceId)).lean();

    if (!space) throw new Error("Space not found");
    if (space.userId.toString() !== userId)
      throw new Error("Only space owner can change roles");

    // TODO: Implement role tracking in a separate collection
    // For now, just update in memory
  }

  /**
   * Remove collaborator
   */
  async removeCollaborator(
    spaceId: string,
    collaboratorId: string,
    requestingUserId: string,
  ): Promise<void> {
    await connectDB();

    const space = await SpaceModel.findById(new Types.ObjectId(spaceId)).lean();

    if (!space) throw new Error("Space not found");
    if (space.userId.toString() !== requestingUserId)
      throw new Error("Only space owner can remove collaborators");

    await SpaceModel.updateOne(
      { _id: new Types.ObjectId(spaceId) },
      { $pull: { collaborators: new Types.ObjectId(collaboratorId) } as any },
    );
  }

  async getSharedSpaces(userId: string): Promise<any[]> {
    await connectDB();
    return SpaceModel.find({
      collaborators: new Types.ObjectId(userId),
    }).lean();
  }
}
