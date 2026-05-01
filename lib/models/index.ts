// Models barrel file - import all models here to ensure they are registered
// with Mongoose before use.

export { default as UserModel } from "./User";
export { default as SessionModel } from "./Session";
export { default as SpaceModel } from "./Space";
export { default as ContentModel } from "./Content";
export { default as FlashcardModel } from "./Flashcard";
export { default as QuizModel } from "./Quiz";
export { default as SummaryModel } from "./Summary";
export { default as ConversationModel } from "./Conversation";
export { default as ChatHistoryModel } from "./ChatHistory";
export { default as GlobalConversationModel } from "./GlobalConversation";
export { default as StudyProgressModel } from "./StudyProgress";
export { default as UserActivityModel } from "./UserActivity";
export { default as SpaceInviteModel } from "./SpaceInvite";
export { default as LearningSpaceModel } from "./LearningSpace";
export { default as StudentProfileModel } from "./StudentProfile";
export { default as StudySessionModel } from "./StudySession";
export { default as DailyStudyStatsModel } from "./DailyStudyStats";
export { default as StudyTimerModel } from "./StudyTimer";
export { default as StudyTimerHistoryModel } from "./StudyTimerHistory";
export { default as DocumentModel } from "./Document";
export { default as UserStreakModel } from "./UserStreak";
export { default as PodcastModel } from "./Podcast";
export { default as MindmapModel } from "./Mindmap";
export { default as ChatUploadModel } from "./ChatUpload";
export { default as NoteModel } from "./Note";

// Re-export types
export type { IUser } from "./User";
export type { ISession } from "./Session";
export type { ISpace } from "./Space";
export type { IContent } from "./Content";
export type { IFlashcard } from "./Flashcard";
export type { IQuiz, IQuizQuestion, IQuizAttempt } from "./Quiz";
export type { ISummary } from "./Summary";
export type { IConversation } from "./Conversation";
export type { IChatHistory, IChatMessage } from "./ChatHistory";
export type { IGlobalConversation, IGlobalMessage } from "./GlobalConversation";
export type { IStudyProgress } from "./StudyProgress";
export type { IUserActivity } from "./UserActivity";
export type { ISpaceInvite } from "./SpaceInvite";
export type { ILearningSpace } from "./LearningSpace";
export type { IStudentProfile } from "./StudentProfile";
export type { IStudySession } from "./StudySession";
export type { IDailyStudyStats } from "./DailyStudyStats";
export type { IStudyTimer } from "./StudyTimer";
export type { IStudyTimerHistory } from "./StudyTimerHistory";
export type { IDocument } from "./Document";
export type { IUserStreak } from "./UserStreak";
export type { IPodcast } from "./Podcast";
export type { IMindmap, IMindmapNode, IMindmapEdge } from "./Mindmap";
export type { IChatUpload, IChatUploadFile } from "./ChatUpload";
export type { INote } from "./Note";
