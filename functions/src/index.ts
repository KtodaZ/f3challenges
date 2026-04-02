import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedPost {
  id: string;
  type: "post" | "shoutout" | "system";
  authorId: string;
  content: string;
  hashtags: string[];
  mentions: string[]; // user IDs
  targetUserId?: string;
  createdAt: string;
  deleted: boolean;
}

interface User {
  id: string;
  displayName: string;
  fcmToken?: string;
  notificationPreferences: {
    mentions: boolean;
  };
}

interface AppNotification {
  id: string;
  userId: string;
  type: "mention" | "shoutout" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedPostId?: string;
  relatedUserId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nanoid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + "…";
}

async function getUser(userId: string): Promise<User | null> {
  const snap = await admin.firestore().doc(`users/${userId}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<User, "id">) };
}

async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: "/feed" },
      },
    });
  } catch (err) {
    console.error("FCM send failed:", err);
  }
}

async function createNotification(
  notification: AppNotification
): Promise<void> {
  const { userId, id } = notification;
  await admin
    .firestore()
    .doc(`notifications/${userId}/items/${id}`)
    .set(notification);
}

// ---------------------------------------------------------------------------
// onFeedPostCreated
// ---------------------------------------------------------------------------

export const onFeedPostCreated = onDocumentCreated(
  "feed/{postId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const post = { id: snap.id, ...(snap.data() as Omit<FeedPost, "id">) };

    if (post.type === "post") {
      const mentions = post.mentions ?? [];
      if (mentions.length === 0) return;

      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";
      const title = `@${authorName} mentioned you`;
      const body = truncate(post.content, 80);

      await Promise.all(
        mentions
          .filter((uid) => uid !== post.authorId)
          .map(async (userId) => {
            const user = await getUser(userId);
            if (!user) return;
            if (!user.notificationPreferences?.mentions) return;

            const notifId = nanoid();
            const notification: AppNotification = {
              id: notifId,
              userId,
              type: "mention",
              title,
              body,
              read: false,
              createdAt: new Date().toISOString(),
              relatedPostId: post.id,
              relatedUserId: post.authorId,
            };

            await createNotification(notification);

            if (user.fcmToken) {
              await sendPushNotification(user.fcmToken, title, body);
            }
          })
      );
    } else if (post.type === "shoutout") {
      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";
      const title = `@${authorName} shouted you out! 💪`;
      const body = truncate(post.content, 80);

      // Collect recipients: mentions (excluding author) + targetUserId
      const recipientSet = new Set<string>(
        (post.mentions ?? []).filter((uid) => uid !== post.authorId)
      );
      if (post.targetUserId && post.targetUserId !== post.authorId) {
        recipientSet.add(post.targetUserId);
      }

      await Promise.all(
        Array.from(recipientSet).map(async (userId) => {
          const user = await getUser(userId);
          if (!user) return;

          // targetUserId always gets notified; mention recipients respect prefs
          const isMentionOnly =
            !post.targetUserId || post.targetUserId !== userId;
          if (isMentionOnly && !user.notificationPreferences?.mentions) return;

          const notifId = nanoid();
          const notification: AppNotification = {
            id: notifId,
            userId,
            type: "shoutout",
            title,
            body,
            read: false,
            createdAt: new Date().toISOString(),
            relatedPostId: post.id,
            relatedUserId: post.authorId,
          };

          await createNotification(notification);

          if (user.fcmToken) {
            await sendPushNotification(user.fcmToken, title, body);
          }
        })
      );
    }
  }
);

// ---------------------------------------------------------------------------
// onUserCreated
// ---------------------------------------------------------------------------

export const onUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userId = snap.id;
    const user = snap.data() as Omit<User, "id">;

    // Give the user a moment to finish onboarding before the welcome post appears
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const postId = nanoid();
    const welcomePost: FeedPost = {
      id: postId,
      type: "system",
      authorId: "system",
      content: `@${user.displayName} just joined the F3 Bedrock challenge! Welcome to the crew! 💪`,
      hashtags: [],
      mentions: [userId],
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    await admin.firestore().doc(`feed/${postId}`).set(welcomePost);
  }
);
