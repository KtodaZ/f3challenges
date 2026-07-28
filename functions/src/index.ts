import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
// import { defineSecret } from "firebase-functions/params"; // ← uncomment on AI recap activation
import {
  getChallengeForDate,
  getChallengeById,
  getDayNumber,
  getTotalDays,
  getMilestoneDays,
  getTodayPT,
  getWeekStartPT,
  completionContext,
  paxPassed,
  AWAY_THRESHOLD,
  getDailyTarget,
  getNotificationTemplates,
  renderNotification,
  getRemainingExercises,
  formatRemainingWork,
  getRemainingNudge,
  tierForCompletedDays,
  trophyUpgrade,
  legacyBadgeType,
  trophyNotification,
} from "@f3-bedrock/shared";
import type { ChallengeTemplate, DailyTarget, NotificationVars, TrophyTier } from "@f3-bedrock/shared";

admin.initializeApp()

// ---------------------------------------------------------------------------
// Types (app-specific — not in @f3-bedrock/shared)
// ---------------------------------------------------------------------------

interface FeedPost {
  id: string;
  type: "post" | "shoutout" | "system";
  authorId: string;
  content: string;
  hashtags: string[];
  mentions: string[]; // user IDs
  challengeId?: string;
  targetUserId?: string;
  createdAt: string;
  deleted: boolean;
}

interface User {
  id: string;
  displayName: string;
  fcmTokens?: string[];
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

interface NotifPrefs {
  morning:     { enabled: boolean; time: string };
  afternoon:   { enabled: boolean; time: string };
  evening:     { enabled: boolean; time: string };
  weeklyRecap: { enabled: boolean; time: string; dayOfWeek: number };
  mentions:    boolean;
  competitive?: boolean;
}

interface ExerciseLogEntry {
  exerciseId: string;
  targetReps: number;
  completedReps: number;
}

interface DailyLog {
  completionFraction: number;
  date: string;
  userId: string;
  challengeId?: string;
  exerciseLogs?: ExerciseLogEntry[];
  isMakeUp?: boolean;
  loggedAt?: string;   // ISO — first write for this day
  updatedAt?: string;  // ISO — last write
  completedAt?: string; // ISO — when the day first hit 100%
}

interface ChallengeParticipation {
  userId: string;
  challengeId: string;
  status: string;
  modificationNote?: string;
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
  userId: string,
  tokens: string[],
  title: string,
  body: string,
  link = "/feed"
): Promise<void> {
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: { link },
        webpush: {
          notification: { badge: "/icons/notification-badge.png" },
          fcmOptions: { link },
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "messaging/registration-token-not-registered") {
        await admin.firestore().doc(`users/${userId}`).update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
        });
      } else {
        console.error("FCM send failed:", err);
      }
    }
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

            if (user.fcmTokens?.length) {
              await sendPushNotification(userId, user.fcmTokens, title, body);
            }
          })
      );
    } else if (post.type === "shoutout") {
      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";

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

          const title = `@${authorName} shouted you out! 💪`;
          const body = truncate(post.content, 80);

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

          if (user.fcmTokens?.length) {
            await sendPushNotification(userId, user.fcmTokens, title, body);
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

    const challenge = getChallengeForDate(getTodayPT());
    const challengeLabel = challenge ? challenge.name : "F3 Bedrock";

    const templates = [
      `@${user.displayName} just joined ${challengeLabel}! Welcome to the crew! 💪`,
      `New PAX alert! @${user.displayName} is in for ${challengeLabel}. Let's get it! 🔥`,
      `@${user.displayName} has entered the chat — welcome to ${challengeLabel}! 💪`,
      `@${user.displayName} just laced up for ${challengeLabel}. The crew just got stronger! 🙌`,
      `Heads up PAX — @${user.displayName} is locked in for ${challengeLabel}. Welcome! 🔥`,
      `The crew grows! @${user.displayName} just joined ${challengeLabel}. Let's go! 💪`,
      `@${user.displayName} is here and ready for ${challengeLabel}. Welcome to F3 Bedrock! 🙌`,
      `@${user.displayName} just showed up for ${challengeLabel}. That's how it's done! 🔥`,
    ];

    const postId = nanoid();
    const welcomePost: FeedPost = {
      id: postId,
      type: "system",
      authorId: "system",
      content: templates[Math.floor(Math.random() * templates.length)],
      hashtags: [],
      mentions: [userId],
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    await admin.firestore().doc(`feed/${postId}`).set(welcomePost);
  }
);

// ---------------------------------------------------------------------------
// onDailyLogCompleted — leaderboard overtake posts
//
// Fires when a daily log crosses into 100%. If those reps moved the PAX past
// somebody on the month-long rep board, the feed gets a post about it.
//
// Why a Cloud Function and not the client: the pass is only knowable from
// *everyone's* logs, and the client that writes the completion only holds its
// own. Server-side also means one write regardless of who's got the app open.
//
// Spam control: the post id is `overtake_{userId}_{PT date}`, so a PAX
// generates at most one of these a day no matter how many days they stack.
// ---------------------------------------------------------------------------

function overtakePost(name: string, passedNames: string[], gap: number, hashtag: string): string {
  const passed = passedNames.length === 1
    ? `@${passedNames[0]}`
    : passedNames.length === 2
      ? `@${passedNames[0]} and @${passedNames[1]}`
      : `@${passedNames[0]} and ${passedNames.length - 1} others`;
  const templates = [
    `@${name} just passed ${passed} on the board — ${gap === 1 ? "by a single rep" : `by ${gap} reps`}. 🔥 ${hashtag}`,
    `Movement on the leaderboard: @${name} climbed past ${passed}. 📈 ${hashtag}`,
    `@${name} went by ${passed} like they were standing still. 🔥 ${hashtag}`,
    `Board update — @${name} is now ahead of ${passed}. Your move. 💪 ${hashtag}`,
    `${passed} just got passed by @${name}. The board doesn't lie. 🏁 ${hashtag}`,
    `@${name} just took a spot off ${passed}. That's what showing up does. 🔥 ${hashtag}`,
    `Another one bites the dust. @${name} just went by ${passed}. 🎸 ${hashtag}`,
    `Shake and bake — @${name} slid past ${passed} on the board. 🏎️ ${hashtag}`,
    `@${name} hit the gas and left ${passed} behind. 🏁 ${hashtag}`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

export const onDailyLogCompleted = onDocumentWritten(
  "dailyLogs/{logId}",
  async (event) => {
    const before = event.data?.before?.data() as DailyLog | undefined;
    const after  = event.data?.after?.data() as DailyLog | undefined;

    // Only the moment a day crosses into complete — every other write (partial
    // quick-taps, edits to an already-finished day) exits before any read.
    if (!after || after.completionFraction < 1) return;
    if (before && before.completionFraction >= 1) return;

    const challenge = after.challengeId ? getChallengeById(after.challengeId) : undefined;
    if (!challenge) return;

    const db = admin.firestore();
    const today = getTodayPT();
    // Only for the challenge that's actually running — backfilling a finished
    // month shouldn't announce movement on a board nobody is watching.
    if (getChallengeForDate(today)?.id !== challenge.id) return;
    const postId = `overtake_${after.userId}_${today}`;
    // Cheap bail-out before the expensive reads: one overtake post per PAX per day.
    if ((await db.doc(`feed/${postId}`).get()).exists) return;

    const [logsSnap, usersSnap, partSnap] = await Promise.all([
      db.collection("dailyLogs").where("challengeId", "==", challenge.id).get(),
      db.collection("users").get(),
      db.collection("participation").where("challengeId", "==", challenge.id).get(),
    ]);

    const optedOut = new Set(
      partSnap.docs
        .filter(d => (d.data() as ChallengeParticipation).status === "opted-out")
        .map(d => (d.data() as ChallengeParticipation).userId)
    );
    if (optedOut.has(after.userId)) return;

    const repsOf = (log: DailyLog) => (log.exerciseLogs ?? []).reduce((s, el) => s + el.completedReps, 0);
    const repsByUser = new Map<string, number>();
    for (const doc of logsSnap.docs) {
      const log = doc.data() as DailyLog;
      if (optedOut.has(log.userId)) continue;
      repsByUser.set(log.userId, (repsByUser.get(log.userId) ?? 0) + repsOf(log));
    }

    // What this write actually added, so we know where they stood a moment ago.
    const gained = repsOf(after) - (before ? repsOf(before) : 0);
    if (gained <= 0) return;
    const repsAfter  = repsByUser.get(after.userId) ?? 0;
    const repsBefore = repsAfter - gained;

    // Only PAX who are actually on the board. Without this, the first PAX to
    // log on Day 1 "passes" every single person sitting on zero.
    const standings = usersSnap.docs
      .filter(d => !optedOut.has(d.id))
      .map(d => ({ id: d.id, name: (d.data() as User).displayName, reps: repsByUser.get(d.id) ?? 0 }))
      .filter(s => s.reps > 0);
    const passed = paxPassed(standings, after.userId, repsBefore, repsAfter);
    if (passed.length === 0) return;

    const author = await getUser(after.userId);
    if (!author) return;

    const content = overtakePost(
      author.displayName,
      passed.map(p => p.name),
      repsAfter - passed[0].reps,
      challenge.hashtag,
    );
    const post: FeedPost = {
      id: postId,
      type: "system",
      authorId: "system",
      content,
      hashtags: [challenge.hashtag.replace(/^#/, "")],
      mentions: [after.userId, ...passed.map(p => p.id)],
      challengeId: challenge.id,
      createdAt: new Date().toISOString(),
      deleted: false,
    };
    await db.doc(`feed/${postId}`).create(post).catch(() => {
      // create() fails if a concurrent write already posted it — that's the point.
    });
    console.log(`[overtake] ${author.displayName} passed ${passed.map(p => p.name).join(", ")}`);
  }
);

// ---------------------------------------------------------------------------
// sendScheduledNotifications — runs every 10 min, PT timezone
// Checks each user's preferred notification times and sends algorithmic
// push notifications to those due within the current window.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Algorithmic notification generation
// ---------------------------------------------------------------------------

// Seed varies by day and notification type so the same user sees different
// templates across days; morning/afternoon/evening also pick different ones.
function notifSeed(dayNumber: number, notifType: string): number {
  let h = 0;
  for (const c of notifType) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h + dayNumber * 997;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

// The "what's left today" phrases are lowercase fragments ("the dead hang,
// standard merkins, and LBCs") and plenty of templates drop them at the start
// of a sentence. Capitalizing sentence starts once, at the end, beats
// hand-casing every template — and keeps new copy from reintroducing it.
function sentenceCase(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

// "Alice"              → "Alice"
// "Alice, Bob"         → "Alice and Bob"
// "Alice, Bob, Charlie, Dave" → "Alice, Bob, and 2 others"
function fmtNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]}, and ${others} other${others > 1 ? "s" : ""}`;
}

type NotificationCtx = {
  challenge: ChallengeTemplate;
  dailyTarget: DailyTarget;
  exerciseLogs: ExerciseLogEntry[] | null;
  userName: string; challengeName: string; dayNumber: number; totalDays: number;
  todayTarget: number; repsCompleted: number; repsRemaining: number;
  repsPerExercise: number; primaryExercise: string;
  userCompleted: boolean; completionFraction: number;
  groupCompletedCount: number; groupTotalCount: number; userStreak: number;
  participationStatus: string; notificationType: string;
  completedNames: string[]; notDoneNames: string[];
  // Challenge days finished during today (today + makeups) — 2+ means they
  // stacked days, same count the Double Duty / Triple Threat badges use.
  stackedDays: number;
  // Required days skipped since their last completed day. 0 if they've never
  // logged this challenge — "welcome back" only makes sense if they left.
  daysAway: number;
};

/** Picks the copy for one push, then cleans up sentence casing. */
function generateNotification(ctx: NotificationCtx): { title: string; body: string } {
  const { title, body } = buildNotification(ctx);
  return { title, body: sentenceCase(body) };
}

function buildNotification(ctx: NotificationCtx): { title: string; body: string } {
  const {
    challenge, dailyTarget, exerciseLogs,
    userName, challengeName, dayNumber, totalDays,
    repsCompleted, repsRemaining,
    userCompleted, groupCompletedCount, groupTotalCount,
    notificationType, completedNames, notDoneNames,
    participationStatus, userStreak,
    stackedDays, daysAway,
  } = ctx;

  const fn = firstName(userName);
  const seed = notifSeed(dayNumber, notificationType);
  const daysRemaining = totalDays - dayNumber;

  // Exercise-aware "what's left" copy: "20 incline merkins and 20 decline
  // merkins" beats "40 reps". nudge is a full custom sentence ("finish those
  // dead hangs...") available when ≤3 exercises remain.
  const remaining = getRemainingExercises(dailyTarget, exerciseLogs);
  const exerciseCount = dailyTarget.exercises.filter(e => e.reps > 0).length;
  const workLeft = formatRemainingWork(remaining, exerciseCount) || `${repsRemaining} reps`;
  const nudge = getRemainingNudge(remaining, seed);

  const notifVars: NotificationVars = { fn, dayNumber, totalDays, daysRemaining, repsRemaining, challengeName, workRemaining: workLeft };
  const daysWord = daysRemaining === 1 ? "day" : "days";
  const isEndgame = daysRemaining <= 3;
  const isLate = daysRemaining <= 10;
  const hasPeers = completedNames.length > 0;
  const hasPartners = notDoneNames.length > 0;
  const peerStr = fmtNames(completedNames);
  const peerVerb = completedNames.length === 1 ? "has" : "have";
  const partnerStr = fmtNames(notDoneNames);
  const progressNote = repsCompleted > 0
    ? `${workLeft} still to go`
    : `${workLeft} to go`;

  // --- Modifying participation — acknowledge and still encourage ---
  const modNote = participationStatus.startsWith("modifying")
    ? "Scaled or not, "
    : "";

  // --- Milestone days ---
  const { quarter: quarterDay, half: halfDay, threeQuarter: threeQuarterDay } = getMilestoneDays(challenge);

  if (dayNumber === 1) {
    const section = userCompleted ? "day1Completed" as const : "day1Pending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === quarterDay) {
    const section = userCompleted ? "quarterCompleted" as const : "quarterPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === halfDay) {
    const section = userCompleted ? "halfCompleted" as const : "halfPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === threeQuarterDay) {
    const section = userCompleted ? "threeQuarterCompleted" as const : "threeQuarterPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  // --- Weekly recap ---
  if (notificationType === "weekly_recap") {
    const streakLine = userStreak > 1
      ? `${userStreak}-day streak — keep it alive!`
      : "Every rep counts — stay the course.";
    const bodies = [
      `Day ${dayNumber} of ${totalDays}. ${streakLine}`,
      `You're ${Math.round((dayNumber / totalDays) * 100)}% through ${challengeName}. ${userStreak > 0 ? `${userStreak}-day streak — don't stop now.` : "Keep showing up."}`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. Stay the course, ${fn}.`,
      `Week in the books. Day ${dayNumber}/${totalDays} on ${challengeName}. ${streakLine}`,
    ];
    return { title: `Week in Review, ${fn}`, body: pick(bodies, seed) };
  }

  // --- Stacked days: multiple challenge days finished in one calendar day ---
  if (stackedDays >= 2) {
    // Matches the same-day stack badges so the push and the trophy agree.
    const stackName = stackedDays === 2 ? "Double Duty"
      : stackedDays === 3 ? "Triple Threat"
      : stackedDays === 4 ? "Quad Stack"
      : `${stackedDays}-Day Stack`;
    const titles = [
      `${stackedDays} Days in One, ${fn}! 🔥`,
      `${stackName}, ${fn}! 💪`,
      `${fn} Stacked ${stackedDays} Days!`,
      `${stackedDays}x Day — Absurd, ${fn} 🧱`,
      `Somebody Stop ${fn}`,
      `${stackedDays} Days. One Day. 🔥`,
    ];
    const bodies = [
      `${stackedDays} full challenge days knocked out in one calendar day, ${fn}. That's ${stackName}. 🧱`,
      `You just did ${stackedDays} days while the rest of the PAX were working on one. 🔥`,
      `${stackedDays} days, one day. That's how you erase a hole — nothing left behind.`,
      `${stackedDays} days logged today, ${fn}. Absolutely relentless. 💪`,
      `Most PAX check one box today. You checked ${stackedDays}. Respect.`,
      `${stackedDays} full days in a single day. ${fn} is not playing around. 🔥`,
      `We're gonna need a bigger log — ${stackedDays} days done today, ${fn}. 🦈`,
      `${stackedDays} days in one day. Somewhere a couch is very disappointed in you. 🛋️🔥`,
    ];
    if (notDoneNames.length > 0) {
      bodies.push(
        `${stackedDays} days in one day, and ${partnerStr} still ${notDoneNames.length === 1 ? "hasn't" : "haven't"} done one. Go fire them up. 🔥`,
      );
    }
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Comeback: back on the board after time away ---
  if (daysAway >= AWAY_THRESHOLD && userCompleted) {
    const titles = [
      `Welcome Back, ${fn}! 🔥`,
      `${fn} Is Back! 💪`,
      `Look Who's Back`,
      `Back on the Board, ${fn}`,
      `The Return of ${fn} 🔥`,
      `That's a Comeback, ${fn}`,
    ];
    const bodies = [
      `${daysAway} days out and you just put Day ${dayNumber} on the board. The hard part is done — now run it back tomorrow.`,
      `Back in it. Day ${dayNumber} logged after ${daysAway} days away. That's the rep that counts. 🔥`,
      `Nobody cares that you missed ${daysAway} days — they care that you came back. Day ${dayNumber} ✅`,
      `The comeback starts with one day, and you just logged it, ${fn}. 💪`,
      `${daysAway} days off didn't finish you. Day ${dayNumber} is in the books — the missed days are still waiting in Catch Up whenever you want them.`,
      `Welcome back, ${fn}. Day ${dayNumber} done. Two in a row and nobody will even remember the gap. 🔥`,
      `Back in black. ${daysAway} days out, and Day ${dayNumber} is on the board. 🖤`,
      `Cue the Rocky music — ${fn} is back. Day ${dayNumber} logged after ${daysAway} days. 🥊`,
    ];
    if (hasPeers) {
      bodies.push(`${peerStr} ${peerVerb} been holding it down. You're back on the board with them today, ${fn}. 🔥`);
    }
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Away: several required days skipped, today still open ---
  if (daysAway >= AWAY_THRESHOLD) {
    const titles = [
      `Get Back In, ${fn}`,
      `${daysAway} Days Out — Come Back 🔥`,
      `The PAX Miss You, ${fn}`,
      `One Day Restarts It All`,
      `Back in It, ${fn}?`,
      `Today's the Day, ${fn}`,
    ];
    const bodies = [
      `It's been ${daysAway} days. Day ${dayNumber} is waiting: ${workLeft}. One day and you're back on the board. 💪`,
      `${daysAway} days off doesn't end your challenge, ${fn}. Knock out ${workLeft} today and you're back in it. 🔥`,
      `The board's still open: ${workLeft} on Day ${dayNumber} — and every day you missed is still there in Catch Up.`,
      `Nobody's counting the ${daysAway} days you missed, ${fn}. ${modNote}they'll count the one you come back on. ${workLeft}.`,
      `Restart today: ${workLeft} on Day ${dayNumber}. That's all it takes to be back in this thing. 💪`,
      `${daysAway} days is a gap, not a wall. Take ${workLeft} today, ${fn} — climb back in. 🔥`,
      `Everybody gets knocked down, ${fn}. Getting up is ${workLeft}. 🎶`,
    ];
    if (hasPeers) {
      bodies.push(
        `${peerStr} ${peerVerb} completed today's challenge and there's a spot open next to them — ${workLeft} and you're next, ${fn}. 🔥`,
        `${peerStr} ${peerVerb} logged today. ${daysAway} days out — ${workLeft} and you're back with the crew. 💪`,
      );
    }
    if (nudge) bodies.push(nudge);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- User completed ---
  if (userCompleted) {
    if (notDoneNames.length === 0) {
      // Whole crew done
      const titles = [
        "Whole Crew Showed Up! 💪",
        `Day ${dayNumber} — Full House!`,
        "PAX All In — That's F3!",
        "Every PAX Finished Today!",
        "Clean Sweep, PAX!",
      ];
      const bodies = [
        `Every PAX crushed Day ${dayNumber}. F3 Bedrock coming through!`,
        `All ${groupTotalCount} PAX done. Day ${dayNumber} belongs to the crew!`,
        `Full house on Day ${dayNumber}! That's the standard, ${fn}.`,
        `Nobody left behind — whole PAX finished Day ${dayNumber}. Let's go!`,
        `${groupTotalCount} for ${groupTotalCount} today. That's what F3 Bedrock is about.`,
        `Not one PAX left it on the table today. Day ${dayNumber} swept. 🔥`,
        `${groupTotalCount}/${groupTotalCount} on Day ${dayNumber}. Try finding another crew that does that.`,
      ];
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      // Done — nudge others
      const titles = [
        `You're Done, ${fn}! 🔥`,
        `Day ${dayNumber} Crushed, ${fn}!`,
        `Nice Work, ${fn}!`,
        `${fn} Checked In! ✅`,
        `Rep That, ${fn}!`,
        `Lead By Example, ${fn}`,
      ];
      const plural = notDoneNames.length === 1 ? "hasn't" : "haven't";
      const needPlural = notDoneNames.length === 1 ? "needs" : "need";
      const bodies = [
        `${partnerStr} ${plural} finished yet — hit their name in the feed.`,
        `${groupCompletedCount}/${groupTotalCount} PAX done. Drop a shoutout to fire up ${partnerStr}.`,
        `You led the way. ${partnerStr} still grinding — give them a push.`,
        `${partnerStr} still ${needPlural} Day ${dayNumber}'s reps. Tag them in the feed.`,
        `Solid work. Now drag ${partnerStr} across the finish line.`,
        `${groupCompletedCount}/${groupTotalCount} done — ${partnerStr} still out there. Send the encouragement.`,
        `Box checked, ${fn}. ${partnerStr} could use a name-drop in the feed right about now. 🔥`,
        `You're in. ${partnerStr} ${plural} logged Day ${dayNumber} yet — one shoutout might be all it takes.`,
      ];
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  // --- Endgame (last 3 days) — heavy urgency with countdown ---
  if (isEndgame) {
    const titles = [
      `${daysRemaining} ${daysWord} Left — Don't Fold`,
      `Almost There, ${fn}!`,
      `Final Push, ${fn}!`,
      `${daysRemaining} ${daysWord} Remaining — Go!`,
      `Finish What You Started`,
      `So Close, ${fn} — Don't Stop`,
      `The End Is in Sight`,
      `Bring It Home, ${fn} 🔥`,
      `${daysRemaining} ${daysWord} — That's It`,
    ];
    const peerLine = hasPeers ? `${peerStr} ${peerVerb} completed today's challenge. ` : "";
    const bodies = [
      `${peerLine}${daysRemaining} ${daysWord} left — ${workLeft} between you and the finish line.`,
      `${modNote}${progressNote}. ${daysRemaining} ${daysWord} in ${challengeName}. Don't quit this close to done.`,
      `${fn}, ${daysRemaining} ${daysWord} left — ${workLeft} now. The crew is watching.`,
      `You've come too far to stop. ${workLeft} today, ${daysRemaining} ${daysWord} to go — finish strong.`,
      `${peerLine}${progressNote}. ${daysRemaining} ${daysWord} left — make it count.`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. ${workLeft} today — this is what you trained for.`,
      `${modNote}${workLeft} left. ${daysRemaining} ${daysWord} remaining — leave nothing on the table, ${fn}.`,
      `${daysRemaining} ${daysWord} out from done. ${workLeft} today — you did not come this far to come this far. 🔥`,
      `${fn}, this is the part you'll remember. ${workLeft}, ${daysRemaining} ${daysWord} left. 💪`,
    ];
    if (nudge) bodies.push(nudge, `${peerLine}${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Late challenge (last 4–10 days) — elevated urgency with countdown ---
  if (isLate) {
    const peerLine = hasPeers ? `${peerStr} ${peerVerb} completed today's challenge. ` : "";
    const titles = [
      `${daysRemaining} ${daysWord} Left, ${fn}`,
      `Don't Slip Now, ${fn}`,
      `Stay Locked In, ${fn}`,
      `Late-Month Push`,
      `Grind Don't Stop`,
      `${daysRemaining} ${daysWord} to Finish Strong`,
      `Almost Home, ${fn}`,
      `Still Here, ${fn}? 🔥`,
      `Stack Another One, ${fn}`,
    ];
    const bodies = [
      `${peerLine}${workLeft} left on Day ${dayNumber}. ${daysRemaining} ${daysWord} to go — hold the line.`,
      `${modNote}${progressNote}. ${daysRemaining} ${daysWord} remaining in ${challengeName} — finish what you started.`,
      `${fn}, ${daysRemaining} ${daysWord} left. ${workLeft} today, then you're one day closer.`,
      `${peerLine}Day ${dayNumber} of ${totalDays}: ${workLeft}. ${daysRemaining} ${daysWord} remaining — let's close strong.`,
      `You've put in the work. ${daysRemaining} ${daysWord} left — finishing today keeps the streak alive. ${workLeft}.`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. ${fn}: ${progressNote}. Stay locked in.`,
      `${peerLine}${workLeft} on Day ${dayNumber}. ${daysRemaining} ${daysWord} to go — don't let up now.`,
      `${modNote}${daysRemaining} ${daysWord} left and ${workLeft} today. Stack another one, ${fn}. 🔥`,
      `Late month is where the crew thins out. ${workLeft} on Day ${dayNumber} — still here, ${fn}? 💪`,
    ];
    if (nudge) bodies.push(nudge, `${peerLine}${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Time-of-day branches (early in challenge) ---

  if (notificationType === "morning") {
    if (hasPeers) {
      const titles = [
        `Rise & Grind, ${fn}!`,
        `PAX Up, ${fn}`,
        `Get After It, ${fn}`,
        `Morning Accountability`,
        `Don't Sleep, ${fn}`,
        `Early Bird Check-In`,
        `Lead From the Front, ${fn}`,
      ];
      const bodies = [
        `${peerStr} already crushed Day ${dayNumber}. ${workLeft} left for you — get after it.`,
        `${peerStr} ${peerVerb} already banked Day ${dayNumber}. ${workLeft} and you're level with them, ${fn}. 🔥`,
        `Board's filling up — ${peerStr} ${peerVerb} logged. ${workLeft} to get your name on it. 💪`,
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}, ${workLeft} — start your first set now.`,
        `${peerStr} put in the work. Day ${dayNumber}: ${workLeft} — be next.`,
        `${peerStr} ${peerVerb} completed today's challenge — don't let them show you up. ${workLeft}, ${fn}.`,
        `${peerStr} already done. Day ${dayNumber}: ${progressNote}. Get moving, ${fn}.`,
        `${peerStr} led the way today. ${fn}, ${workLeft} — go now, thank yourself later.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${workLeft} — you're next, ${fn}.`,
      ];
      if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else if (hasPartners) {
      const titles = [
        `Day ${dayNumber} Starts Now`,
        `Rise Up, ${fn}!`,
        `Morning Reps, ${fn}`,
        `PAX Don't Wait`,
        `First Set, ${fn}`,
        `Lead the PAX, ${fn}`,
        `Set the Tone, ${fn}`,
      ];
      const bodies = [
        `${partnerStr} haven't started yet — be the first PAX to finish Day ${dayNumber}.`,
        `${modNote}${progressNote}. Day is young — knock out a set and be the one who leads today.`,
        `${progressNote}. ${fn}, go first — set the tone.`,
        `Nobody's done yet. ${fn}, be the standard — ${workLeft} on Day ${dayNumber}.`,
        `You and ${partnerStr} are all still in it. First one done fires up the rest — go.`,
        `Morning sets pay dividends. ${fn}, ${workLeft} — lead the crew.`,
        `${partnerStr} haven't finished yet. ${fn}: ${progressNote} — lead the charge.`,
        `Empty board this morning. ${workLeft}, ${fn} — put the first name on it. 🔥`,
        `${modNote}Day ${dayNumber} is wide open. First PAX done sets the pace — that you, ${fn}? 💪`,
      ];
      if (nudge) bodies.push(nudge, `Nobody's done yet — go first. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      const titles = [
        `Rise Up, ${fn}!`,
        `Day ${dayNumber}, Let's Go`,
        `Morning Grind, ${fn}`,
        `First Move Wins`,
        `Own the Morning, ${fn}`,
      ];
      const bodies = [
        `Day ${dayNumber} of ${totalDays}: ${workLeft}. Morning sets pay dividends — start now.`,
        `${progressNote}. Day is young, ${fn} — get moving.`,
        `Day ${dayNumber} on ${challengeName}. Be the first PAX to finish today.`,
        `${fn}, ${workLeft} today. Knock your first set out early and thank yourself later.`,
        `${modNote}${workLeft} waiting, ${fn}. Morning is the best time — go.`,
        `Day ${dayNumber}: ${workLeft}. Do it before the day gets a vote. 🔥`,
        `${fn}, nobody ever regretted knocking it out early. ${workLeft}. 💪`,
      ];
      if (nudge) bodies.push(nudge);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  if (notificationType === "afternoon") {
    if (hasPeers) {
      const titles = [
        `Midday Check, ${fn}`,
        `Afternoon Accountability`,
        `Don't Let It Slip, ${fn}`,
        `PAX Rolling, ${fn}`,
        `Halfway Gone, ${fn}`,
        `Clock's Moving, ${fn}`,
        `Get It Done, ${fn}`,
      ];
      const bodies = [
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}: ${progressNote} — do it now, not tonight.`,
        `${peerStr} already done. ${workLeft} on Day ${dayNumber} — don't let it pile up.`,
        `${peerStr} checked in. ${fn}, ${workLeft} — knock a set out before dinner.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${progressNote} — you've got time, use it.`,
        `${peerStr} are done for the day. ${fn}: ${workLeft} left, go now.`,
        `${peerStr} already crushed it. Afternoon's the sweet spot — ${workLeft}, ${fn}.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}, don't push it to tonight — ${workLeft} now.`,
        `${peerStr} ${peerVerb} handled Day ${dayNumber} already. ${workLeft} left, ${fn} — your turn. 🔥`,
        `Half the day's gone and ${peerStr} ${peerVerb} logged. ${progressNote}, ${fn}. 💪`,
      ];
      if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else if (hasPartners) {
      const titles = [
        `Afternoon Grind, ${fn}`,
        `Midday Push, ${fn}`,
        `Still Time, ${fn}`,
        `Check In, ${fn}`,
        `Beat the Clock, ${fn}`,
      ];
      const bodies = [
        `You and ${partnerStr} are still grinding. ${workLeft} — finish before tonight.`,
        `${partnerStr} haven't finished yet either. Day ${dayNumber}: ${progressNote} — go now.`,
        `You're not alone — ${partnerStr} still have work left too. ${workLeft} to go, ${fn}.`,
        `${groupCompletedCount}/${groupTotalCount} PAX done. ${fn}: ${workLeft} — don't push it to evening.`,
        `${modNote}${partnerStr} still grinding too. ${workLeft} left — who finishes first?`,
        `Nobody's closed Day ${dayNumber} yet. ${workLeft} — be the one who breaks the seal, ${fn}. 🔥`,
      ];
      if (nudge) bodies.push(nudge, `${partnerStr} haven't finished yet either. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      const titles = [
        `Midday Check, ${fn}`,
        `Afternoon Accountability`,
        `Use Daylight, ${fn}`,
        `Don't Wait, ${fn}`,
      ];
      const bodies = [
        `${modNote}${progressNote} on Day ${dayNumber}. Afternoon's the sweet spot — knock it out now.`,
        `Day ${dayNumber}: ${workLeft}. Don't let it pile up for tonight.`,
        `${fn}, ${progressNote}. Go now while it's light.`,
        `${modNote}${workLeft} left on Day ${dayNumber}. Afternoons are for grinding — go.`,
        `${fn}, ${workLeft} on Day ${dayNumber}. Evening-you will thank afternoon-you. 💪`,
      ];
      if (nudge) bodies.push(nudge);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  // Evening (default)
  if (hasPeers) {
    const titles = [
      `Last Chance, ${fn}`,
      `Clock's Running Out`,
      `PAX Don't Quit`,
      `Evening Accountability`,
      `Don't Sleep on This`,
      `Tonight's the Night, ${fn}`,
      `Finish Day ${dayNumber}, ${fn}`,
    ];
    const bodies = [
      `${peerStr} ${peerVerb} completed today's challenge. ${fn}: ${workLeft} before midnight — let's go.`,
      `${peerStr} already done. Day ${dayNumber} ends soon — ${workLeft}, ${fn}.`,
      `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${progressNote} — last chance to close Day ${dayNumber}.`,
      `${peerStr} checked in. ${fn}, ${progressNote} — do it now.`,
      `${peerStr} are done for the day. ${fn}: clock's running — ${workLeft} left.`,
      `${peerStr} ${peerVerb} completed today's challenge. Don't let Day ${dayNumber} slip — ${workLeft} now.`,
      `${peerStr} put it in. ${fn}, ${workLeft} — don't be the one who didn't finish today.`,
      `${peerStr} ${peerVerb} closed Day ${dayNumber}. ${workLeft} between you and joining them. 🔥`,
      `Day ${dayNumber} is almost gone, ${fn}. ${workLeft} — finish it while it still counts. 💪`,
    ];
    if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  } else if (hasPartners) {
    const titles = [
      `Last Chance Tonight`,
      `Evening Push, ${fn}`,
      `Don't Break the Streak`,
      `Finish Day ${dayNumber}, ${fn}`,
      `Final Hour, ${fn}`,
    ];
    const bodies = [
      `You and ${partnerStr} still need to finish. ${workLeft} — don't let today slip.`,
      `${partnerStr} are still grinding too. Day ${dayNumber}: ${progressNote}. Finish together.`,
      `Only ${notDoneNames.length + 1} PAX left to finish Day ${dayNumber}. ${fn}, ${workLeft} — go.`,
      `${partnerStr} haven't finished either. ${fn}: ${workLeft} — tonight's your last shot.`,
      `${modNote}${partnerStr} still out there too. ${workLeft}, ${fn} — close it out.`,
      `${workLeft} stands between you and a clean Day ${dayNumber}, ${fn}. Clock's honest. 🔥`,
    ];
    if (nudge) bodies.push(nudge, `${partnerStr} haven't finished either. ${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  } else {
    const titles = [
      `Last Chance Tonight`,
      `Clock's Running Out`,
      `Don't Sleep on This`,
      `Finish Strong, ${fn}`,
      `Close It Out, ${fn}`,
    ];
    const bodies = [
      `${fn}, ${workLeft} before midnight. Don't break the streak.`,
      `Day ${dayNumber} ends soon — ${workLeft} left, ${fn}. Get it done.`,
      `Tonight's your last shot on Day ${dayNumber}. ${modNote}${workLeft} — go.`,
      `${fn}: ${progressNote}. Don't let Day ${dayNumber} slip.`,
      `${modNote}${workLeft} between you and Day ${dayNumber}. Close it out, ${fn}.`,
      `Last call on Day ${dayNumber}, ${fn}. ${workLeft} — go get it. 🔥`,
    ];
    if (nudge) bodies.push(nudge);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }
}

// ---------------------------------------------------------------------------
// Competitive notifications (opt-in) — rank-based nudges layered onto the
// morning/afternoon/evening reminders. Only sent to PAX who turned them on.
// ---------------------------------------------------------------------------

interface CompetitiveContext {
  rank: number;            // 1-based standing by total reps
  totalParticipants: number;
  userReps: number;
  aheadName?: string;      // nearest PAX strictly ahead
  aheadGap?: number;       // reps needed to pass them
  behindName?: string;     // nearest PAX strictly behind
  behindGap?: number;      // how far back they are
}

type CompScope = "week" | "month";

/** Ranks active PAX by a reps map and returns each one's chase/defend context.
 *  Reused for both the month-long board and the weekly board. */
function buildStandings(
  activeUsers: Array<{ id: string; displayName: string }>,
  repsByUser: Map<string, number>,
): Map<string, CompetitiveContext> {
  const ranked = activeUsers
    .map(u => ({ id: u.id, name: u.displayName, reps: repsByUser.get(u.id) ?? 0 }))
    .sort((a, b) => (b.reps - a.reps) || a.name.localeCompare(b.name));
  const out = new Map<string, CompetitiveContext>();
  ranked.forEach((entry, i) => {
    // Nearest PAX strictly ahead / behind (skip ties so the gap is real).
    let ahead: { name: string; reps: number } | undefined;
    for (let j = i - 1; j >= 0; j--) {
      if (ranked[j].reps > entry.reps) { ahead = ranked[j]; break; }
    }
    let behind: { name: string; reps: number } | undefined;
    for (let j = i + 1; j < ranked.length; j++) {
      if (ranked[j].reps < entry.reps) { behind = ranked[j]; break; }
    }
    out.set(entry.id, {
      rank: i + 1,
      totalParticipants: ranked.length,
      userReps: entry.reps,
      aheadName: ahead?.name,
      aheadGap: ahead ? ahead.reps - entry.reps : undefined,
      behindName: behind?.name,
      behindGap: behind ? entry.reps - behind.reps : undefined,
    });
  });
  return out;
}

const repWord = (n: number) => `${n} rep${n === 1 ? "" : "s"}`;

/** Neck-and-neck lines for when the gap is small enough to close in one set.
 *  These beat the regular chase/defend copy — a 6-rep gap is a race, a
 *  400-rep gap is a status report. */
function photoFinishBodies(
  scope: CompScope, c: CompetitiveContext, fn: string, todayTail: string, threshold: number,
): string[] {
  const board = scope === "week" ? "this week's board" : "the month";
  const bodies: string[] = [];
  const closeChase  = c.aheadName  != null && c.aheadGap  != null && c.aheadGap  > 0 && c.aheadGap  <= threshold;
  const closeDefend = c.behindName != null && c.behindGap != null && c.behindGap > 0 && c.behindGap <= threshold;

  if (closeChase) {
    bodies.push(
      `Photo finish on ${board}: ${c.aheadName} is ${repWord(c.aheadGap!)} ahead. One set and the spot is yours. ${todayTail}`,
      `${repWord(c.aheadGap!)}. That's all that separates you from ${c.aheadName} on ${board}, ${fn}. 🔥`,
      `You're breathing down ${c.aheadName}'s neck — ${repWord(c.aheadGap!)} on ${board}. Go take it. 💪`,
    );
  }
  if (closeDefend) {
    bodies.push(
      `${c.behindName} is ${repWord(c.behindGap!)} behind you on ${board}. That's nothing — do not let them through. ${todayTail}`,
      `Dead heat at #${c.rank}: ${repWord(c.behindGap!)} covers you and ${c.behindName} on ${board}. 🔥`,
      `${c.behindName} is one set from taking your spot on ${board}, ${fn}. ${todayTail}`,
    );
  }
  if (closeChase && closeDefend) {
    bodies.push(
      `Three-way scrap at #${c.rank} on ${board}: ${repWord(c.aheadGap!)} up to ${c.aheadName}, ${repWord(c.behindGap!)} down to ${c.behindName}. Every rep swings it. 🔥`,
    );
  }
  return bodies;
}

/** Scope-specific chase/defend body lines. Weekly copy leans on "this week's
 *  board" so a mid-month joiner sees a race they can actually win right now;
 *  monthly copy frames the season-long standings. */
function competitiveBodies(scope: CompScope, c: CompetitiveContext, fn: string, todayTail: string): string[] {
  const chase  = c.aheadName != null && c.aheadGap != null && c.aheadGap > 0;
  const defend = c.behindName != null && c.behindGap != null && c.behindGap > 0;
  const bodies: string[] = [];

  if (scope === "week") {
    if (chase) {
      bodies.push(
        `Only ${repWord(c.aheadGap!)} until you pass ${c.aheadName} on this week's board. ${todayTail}`,
        `You're #${c.rank} this week — ${repWord(c.aheadGap!)} behind ${c.aheadName}. Take the spot before Sunday.`,
        `${c.aheadName} is ${repWord(c.aheadGap!)} ahead of you in this week's leaderboard. Reel them in, ${fn}.`,
      );
    }
    if (defend) {
      if (c.rank === 1) {
        bodies.push(
          `You own this week's board, ${fn}. ${c.behindName} is ${repWord(c.behindGap!)} back — keep your foot down. ${todayTail}`,
          `Top of the weekly board and ${c.behindName} is closing — ${repWord(c.behindGap!)} behind. Don't blink.`,
        );
      } else {
        bodies.push(
          `${c.behindName} is right on your heels in this week's leaderboard — ${repWord(c.behindGap!)} back. Hold #${c.rank}, ${fn}. ${todayTail}`,
          `Watch your six: ${c.behindName} is ${repWord(c.behindGap!)} behind you on this week's board. ${todayTail}`,
        );
      }
    }
    if (chase && defend) {
      bodies.push(
        `Sandwiched on this week's board at #${c.rank}: ${repWord(c.aheadGap!)} to catch ${c.aheadName}, ${c.behindName} just ${repWord(c.behindGap!)} behind. ${todayTail}`,
      );
    }
  } else {
    if (chase) {
      bodies.push(
        `Only ${repWord(c.aheadGap!)} until you pass ${c.aheadName} for #${c.rank - 1} overall. ${todayTail}`,
        `You're #${c.rank} of ${c.totalParticipants} for the month. ${repWord(c.aheadGap!)} behind ${c.aheadName} — take the spot.`,
        `${c.aheadName} is right ahead of you overall — ${repWord(c.aheadGap!)} and #${c.rank - 1} is yours, ${fn}.`,
      );
    }
    if (defend) {
      if (c.rank === 1) {
        bodies.push(
          `You're #1 for the month, ${fn}. ${c.behindName} is ${repWord(c.behindGap!)} back — bury the lead deeper. ${todayTail}`,
          `Top of the month and ${c.behindName} is closing — ${repWord(c.behindGap!)} back. Don't blink.`,
        );
      } else {
        bodies.push(
          `${c.behindName} is only ${repWord(c.behindGap!)} behind you overall. Defend #${c.rank}, ${fn}. ${todayTail}`,
          `You're holding #${c.rank} for the month — ${c.behindName} is ${repWord(c.behindGap!)} back. Keep the gap.`,
        );
      }
    }
    if (chase && defend) {
      bodies.push(
        `Sandwiched at #${c.rank} overall: ${repWord(c.aheadGap!)} to pass ${c.aheadName}, ${c.behindName} just ${repWord(c.behindGap!)} behind. ${todayTail}`,
      );
    }
  }
  return bodies;
}

/** Rank-based message for a PAX who opted into competitive nudges. Mixes weekly
 *  and month-long standings so the same PAX sees both "chase the season leader"
 *  and "hold your spot on this week's board" over time. Returns null when
 *  there's no one to chase or defend against in either scope (caller falls back
 *  to the normal template). */
function generateCompetitiveNotification(ctx: {
  fn: string;
  notificationType: "morning" | "afternoon" | "evening";
  userCompleted: boolean;
  workLeft: string;
  seed: number;
  week?: CompetitiveContext;
  month?: CompetitiveContext;
  // Gap (in reps) at or under which a race counts as neck-and-neck. Scaled to
  // the day's target by the caller so it means the same thing in a 50-rep
  // challenge and a 300-rep one.
  closeThreshold: number;
}): { title: string; body: string } | null {
  const { fn, notificationType, userCompleted, workLeft, seed, week, month, closeThreshold } = ctx;

  const todayTail = userCompleted
    ? "You're locked in for today — keep stacking."
    : (workLeft ? `${workLeft} left today — go get it.` : "Get after it.");

  // A tight race trumps a status report: if anyone is within striking distance
  // in either scope, only photo-finish lines are eligible.
  const closeCandidates: Array<{ scope: CompScope; body: string }> = [];
  if (week)  for (const body of photoFinishBodies("week",  week,  fn, todayTail, closeThreshold)) closeCandidates.push({ scope: "week",  body });
  if (month) for (const body of photoFinishBodies("month", month, fn, todayTail, closeThreshold)) closeCandidates.push({ scope: "month", body });

  // Pool candidates from both scopes; the seeded pick naturally alternates the
  // same PAX between weekly and monthly framing across days and time slots.
  const candidates: Array<{ scope: CompScope; body: string }> = [];
  if (week)  for (const body of competitiveBodies("week",  week,  fn, todayTail)) candidates.push({ scope: "week",  body });
  if (month) for (const body of competitiveBodies("month", month, fn, todayTail)) candidates.push({ scope: "month", body });

  const pool = closeCandidates.length > 0 ? closeCandidates : candidates;
  if (pool.length === 0) return null;

  const chosen = pick(pool, seed + 1);

  if (closeCandidates.length > 0) {
    const closeTitles = [
      `Photo Finish, ${fn} 🏁`,
      `Neck and Neck 🏁`,
      `Too Close to Call, ${fn}`,
      `It's a Race, ${fn} 🔥`,
      `Inches Apart, ${fn}`,
    ];
    return { title: pick(closeTitles, seed), body: sentenceCase(chosen.body) };
  }

  const monthTitlesByType: Record<typeof notificationType, string[]> = {
    morning:   [`Rise & Climb, ${fn} 🏁`, `Morning Standings, ${fn}`, `Chase It Down, ${fn}`, `Move Up Today, ${fn}`],
    afternoon: [`Midday Standings, ${fn}`, `Close the Gap, ${fn} 🏁`, `Move Up, ${fn}`, `Check the Board, ${fn}`],
    evening:   [`Hold Your Spot, ${fn} 🏁`, `Night Standings, ${fn}`, `Last Call on the Board`, `Lock In Your Rank, ${fn}`],
  };
  const weekTitlesByType: Record<typeof notificationType, string[]> = {
    morning:   [`This Week's Board, ${fn} 🏁`, `Weekly Standings, ${fn}`, `Climb the Weekly Board, ${fn}`, `Own This Week, ${fn}`],
    afternoon: [`Weekly Board Check, ${fn}`, `Move Up This Week, ${fn} 🏁`, `This Week's Race, ${fn}`, `Close the Weekly Gap, ${fn}`],
    evening:   [`Lock In Your Week, ${fn} 🏁`, `Hold the Weekly Board`, `This Week's Standings, ${fn}`, `Last Call This Week, ${fn}`],
  };
  const titles = chosen.scope === "week" ? weekTitlesByType[notificationType] : monthTitlesByType[notificationType];

  return { title: pick(titles, seed), body: sentenceCase(chosen.body) };
}

// ---------------------------------------------------------------------------
// AI weekly recap — generated by the Next.js app on Vercel (where the OpenAI
// key lives) via POST /api/notifications/recap, auth'd with CRON_SECRET.
//
// ACTIVATION (safe to deploy without — recaps fall back to templates):
//   1. Vercel dashboard: set OPENAI_API_KEY and CRON_SECRET
//   2. firebase functions:secrets:set CRON_SECRET   (same value as Vercel)
//   3. Uncomment defineSecret below and add `secrets: [cronSecret]` to the
//      onSchedule options — deliberately not bound yet because defineSecret
//      makes deploys hard-fail until the secret exists in Secret Manager.
// ---------------------------------------------------------------------------

// const cronSecret = defineSecret("CRON_SECRET");

const APP_URL = process.env.APP_URL ?? "https://f3-bedrock-monthly-challenge.vercel.app";

async function fetchAiRecap(
  userId: string,
  secret: string,
): Promise<{ title: string; body: string } | null> {
  if (!secret) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(`${APP_URL}/api/notifications/recap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[notify] AI recap HTTP ${res.status} for ${userId}`);
      return null;
    }
    const data = await res.json() as { title?: unknown; body?: unknown };
    if (typeof data.title === "string" && typeof data.body === "string") {
      return { title: data.title, body: data.body };
    }
    return null;
  } catch (err) {
    console.warn(`[notify] AI recap failed for ${userId}:`, err);
    return null;
  }
}

export const sendScheduledNotifications = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "America/Los_Angeles",
    // secrets: [cronSecret], // ← uncomment on AI recap activation
  },
  async () => {
    const today   = getTodayPT();
    const nowPT   = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const nowDate = new Date(nowPT);
    const nowHour = nowDate.getHours();
    const nowMin  = nowDate.getMinutes();
    const nowTotal = nowHour * 60 + nowMin;

    console.log(`[notify] ── run start ── ${nowPT} | today=${today} | nowTotal=${nowTotal}min`);

    const challenge = getChallengeForDate(today);
    if (!challenge) {
      console.log(`[notify] no active challenge for ${today}, exiting`);
      return;
    }
    const dayNumber = getDayNumber(challenge, today)!;
    const totalDays = getTotalDays(challenge);
    const todayTarget = getDailyTarget(challenge, today);
    if (!todayTarget || todayTarget.isRestDay) {
      console.log(`[notify] rest day or no target for ${today}, exiting`);
      return;
    }
    const todayReps = todayTarget.totalReps;
    console.log(`[notify] challenge=${challenge.name} day=${dayNumber}/${totalDays}`);

    const usersSnap = await admin.firestore().collection("users").get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User & { notificationPreferences: NotifPrefs; currentStreak?: number }));
    console.log(`[notify] ${users.length} users total`);

    // Fetch participation for all users to exclude opted-out PAX from stats
    const participationSnap = await admin.firestore().collection("participation")
      .where("challengeId", "==", challenge.id)
      .get();
    const optedOutIds = new Set(
      participationSnap.docs
        .filter(d => (d.data() as ChallengeParticipation).status === "opted-out")
        .map(d => (d.data() as ChallengeParticipation).userId)
    );
    const activeUsers = users.filter(u => !optedOutIds.has(u.id));
    console.log(`[notify] ${optedOutIds.size} opted-out, ${activeUsers.length} active`);

    // Group completion stats for today (active users only)
    const todayLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .where("date", "==", today)
      .get();
    const groupCompleted = todayLogsSnap.docs.filter(d => {
      const log = d.data() as DailyLog;
      return log.completionFraction >= 1 && !optedOutIds.has(log.userId);
    }).length;
    console.log(`[notify] group completion: ${groupCompleted}/${activeUsers.length} done today`);

    // Build name lists for peer pressure messaging (active users only)
    const userById = new Map(users.map(u => [u.id, u.displayName]));
    const completedUserIds = new Set(
      todayLogsSnap.docs
        .filter(d => {
          const log = d.data() as DailyLog;
          return log.completionFraction >= 1 && !optedOutIds.has(log.userId);
        })
        .map(d => (d.data() as DailyLog).userId)
    );
    const allCompletedNames = [...completedUserIds].map(id => userById.get(id) ?? "").filter(Boolean);
    const allNotDoneNames = activeUsers
      .filter(u => !completedUserIds.has(u.id))
      .map(u => u.displayName);
    console.log(`[notify] completed: [${allCompletedNames.join(", ")}] | not done: [${allNotDoneNames.join(", ")}]`);

    // ── Competitive standings (for opted-in PAX) ─────────────────────────────
    // Total reps per active PAX across the whole challenge — matches the reps
    // ranking the leaderboard shows. Only computed once per run and reused.
    const allLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .get();
    // Month-long reps + this-week reps per active PAX. Weekly totals reset each
    // Sunday, giving PAX who joined mid-month a board they can top today.
    const weekStart = getWeekStartPT(today);
    const repsByUser = new Map<string, number>();
    const weeklyRepsByUser = new Map<string, number>();
    // Same pass also collects each PAX's logs so the smart notifications can
    // ask the shared helper who stacked days and who's been away.
    const logsByUser = new Map<string, DailyLog[]>();
    for (const doc of allLogsSnap.docs) {
      const log = doc.data() as DailyLog;
      if (optedOutIds.has(log.userId)) continue;
      const reps = (log.exerciseLogs ?? []).reduce((s, el) => s + el.completedReps, 0);
      repsByUser.set(log.userId, (repsByUser.get(log.userId) ?? 0) + reps);
      if (log.date >= weekStart) {
        weeklyRepsByUser.set(log.userId, (weeklyRepsByUser.get(log.userId) ?? 0) + reps);
      }
      const forUser = logsByUser.get(log.userId);
      if (forUser) forUser.push(log); else logsByUser.set(log.userId, [log]);
    }
    const activeRoster = activeUsers.map(u => ({ id: u.id, displayName: u.displayName }));
    const rankByUser     = buildStandings(activeRoster, repsByUser);
    const weeklyRankByUser = buildStandings(activeRoster, weeklyRepsByUser);
    console.log(`[notify] competitive standings built (week start ${weekStart})`);

    for (const user of activeUsers) {
      if (!user.fcmTokens?.length) {
        console.log(`[notify] skip ${user.displayName} — no fcmTokens`);
        continue;
      }
      const prefs = user.notificationPreferences;
      if (!prefs) {
        console.log(`[notify] skip ${user.displayName} — no notificationPreferences`);
        continue;
      }

      type NotifType = "morning" | "afternoon" | "evening" | "weekly_recap";
      const windows: Array<{ type: NotifType; enabled: boolean; time: string }> = [
        { type: "morning",      enabled: prefs.morning?.enabled ?? false,     time: prefs.morning?.time ?? "08:00" },
        { type: "afternoon",    enabled: prefs.afternoon?.enabled ?? false,    time: prefs.afternoon?.time ?? "17:00" },
        { type: "evening",      enabled: prefs.evening?.enabled ?? false,      time: prefs.evening?.time ?? "20:00" },
        { type: "weekly_recap", enabled: prefs.weeklyRecap?.enabled ?? false,  time: prefs.weeklyRecap?.time ?? "20:00" },
      ];

      console.log(`[notify] checking ${user.displayName} | windows: ${windows.filter(w => w.enabled).map(w => `${w.type}@${w.time}`).join(", ") || "none enabled"}`);

      for (const w of windows) {
        if (!w.enabled) continue;

        if (w.type === "weekly_recap") {
          const todayDay = nowDate.getDay();
          const prefDay  = prefs.weeklyRecap?.dayOfWeek ?? 0;
          if (todayDay !== prefDay) {
            console.log(`[notify]   ${w.type} skipped — today is day ${todayDay}, pref is day ${prefDay}`);
            continue;
          }
        }

        const [prefH, prefM] = w.time.split(":").map(Number);
        const prefTotal = prefH * 60 + prefM;
        const diffMins  = Math.abs(nowTotal - prefTotal);
        const WINDOW    = 5; // minutes either side — scheduler runs every 10 min so max drift is 5 min

        console.log(`[notify]   ${w.type}@${w.time} | now=${nowTotal}min pref=${prefTotal}min diff=${diffMins}min window=±${WINDOW}`);

        if (diffMins > WINDOW) {
          console.log(`[notify]   → outside window, skip`);
          continue;
        }

        const logKey = `${user.id}_${today}_${w.type}`;
        const alreadySent = await admin.firestore().collection("notificationLog").doc(logKey).get();
        if (alreadySent.exists) {
          console.log(`[notify]   → already sent (logKey=${logKey}), skip`);
          continue;
        }

        const userLogSnap = await admin.firestore().collection("dailyLogs").doc(`${user.id}_${today}`).get();
        const userLog = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null;
        const userCompleted = (userLog?.completionFraction ?? 0) >= 1;
        console.log(`[notify]   → user log: fraction=${userLog?.completionFraction ?? 0} completed=${userCompleted}`);

        const partSnap = await admin.firestore().collection("participation").doc(`${user.id}_${challenge.id}`).get();
        const part = partSnap.exists ? (partSnap.data() as ChallengeParticipation) : null;
        let statusStr = part?.status ?? "active";
        if (statusStr === "opted-out") {
          console.log(`[notify]   → opted out, skip`);
          continue;
        }
        if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;
        console.log(`[notify]   → participation: ${statusStr}`);

        try {
          const fraction      = userLog?.completionFraction ?? 0;
          // Sum completed reps from exercise logs (rep-type only) for accuracy on mixed-unit challenges.
          // Fall back to fraction × totalReps if logs aren't available yet.
          const repsCompleted = userLog?.exerciseLogs?.length
            ? userLog.exerciseLogs.reduce((sum, el) => {
                const ex = challenge.exercises.find(e => e.id === el.exerciseId);
                return (ex?.unit ?? 'reps') === 'reps' ? sum + Math.min(el.completedReps, el.targetReps) : sum;
              }, 0)
            : Math.round(todayReps * fraction);
          const repsRemaining   = Math.max(0, todayReps - repsCompleted);
          const repsPerExercise = todayTarget.repsPerExercise;

          // Smart-notification context: how long they've been gone, and how
          // many days they've stacked today. Same helper the feed post uses.
          const { stackedDays, daysAway } = completionContext(
            challenge, logsByUser.get(user.id) ?? [], today,
          );
          if (daysAway >= AWAY_THRESHOLD || stackedDays >= 2) {
            console.log(`[notify]   → smart context: daysAway=${daysAway} stackedDays=${stackedDays}`);
          }

          let { title, body } = generateNotification({
            challenge,
            dailyTarget:         todayTarget,
            exerciseLogs:        userLog?.exerciseLogs ?? null,
            userName:            user.displayName,
            challengeName:       challenge.name,
            dayNumber,
            totalDays,
            todayTarget:         todayReps,
            repsCompleted,
            repsRemaining,
            repsPerExercise,
            primaryExercise:     challenge.exercises[0]?.name ?? "Rep",
            userCompleted,
            completionFraction:  fraction,
            groupCompletedCount: userCompleted ? groupCompleted - 1 : groupCompleted,
            groupTotalCount:     activeUsers.length - 1,
            userStreak:          (user as { currentStreak?: number }).currentStreak ?? 0,
            participationStatus: statusStr,
            notificationType:    w.type,
            completedNames: [...completedUserIds].filter(id => id !== user.id).map(id => userById.get(id) ?? "").filter(Boolean),
            notDoneNames:   activeUsers.filter(u => !completedUserIds.has(u.id) && u.id !== user.id).map(u => u.displayName),
            stackedDays,
            daysAway,
          });

          // Competitive nudges (opt-in): for morning/afternoon/evening, replace
          // the standard nudge with a rank-based one when there's a spot to
          // chase or defend. Weekly recaps keep their own copy. A comeback or a
          // stacked day is the bigger story — those keep their message.
          if (
            prefs.competitive &&
            stackedDays < 2 &&
            daysAway < AWAY_THRESHOLD &&
            (w.type === "morning" || w.type === "afternoon" || w.type === "evening")
          ) {
            const monthRc = rankByUser.get(user.id);
            const weekRc  = weeklyRankByUser.get(user.id);
            if (monthRc || weekRc) {
              const comp = generateCompetitiveNotification({
                fn: firstName(user.displayName),
                notificationType: w.type,
                userCompleted,
                workLeft: userCompleted ? "" : `${repsRemaining} reps`,
                seed: notifSeed(dayNumber, `${w.type}_competitive`),
                week: weekRc,
                month: monthRc,
                closeThreshold: Math.max(5, Math.round(todayReps * 0.1)),
              });
              if (comp) {
                ({ title, body } = comp);
                console.log(`[notify]   → competitive override applied (month #${monthRc?.rank ?? "-"}, week #${weekRc?.rank ?? "-"})`);
              }
            }
          }

          // Weekly recap: prefer the personalized AI recap from the Vercel
          // app; the template above stays as the fallback.
          if (w.type === "weekly_recap") {
            // Empty until AI recap activation (see comment above fetchAiRecap)
            const secretVal = process.env.CRON_SECRET ?? "";
            const ai = await fetchAiRecap(user.id, secretVal);
            if (ai) ({ title, body } = ai);
            console.log(`[notify]   → recap source: ${ai ? "AI" : "template fallback"}`);
          }
          console.log(`[notify]   → generated: title="${title}" body="${body}"`);

          await sendPushNotification(user.id, user.fcmTokens!, title, body, "/");
          console.log(`[notify]   → FCM sent OK`);

          await admin.firestore().collection("notificationLog").doc(logKey).set({ sentAt: new Date().toISOString() });
          console.log(`[notify] ✓ sent ${w.type} to ${user.displayName}: "${title}"`);
        } catch (err) {
          console.error(`[notify] ✗ failed for ${user.displayName} ${w.type}:`, err);
        }
      }
    }

    console.log(`[notify] ── run complete ──`);
  }
);

// ---------------------------------------------------------------------------
// sendTestPush — manual HTTP trigger to test a push notification
// Runs the full notification flow for one user, bypassing the time-window check.
//
// Usage:
//   curl -X POST <url> -H "Content-Type: application/json" \
//     -d '{"userId":"<id>"}'
//
// Optional overrides:
//   -d '{"userId":"<id>","notificationType":"evening"}'   (default: "morning")
//   -d '{"userId":"<id>","title":"Custom","body":"Hi"}'   (skip generation, send directly)
//   -d '{"userId":"<id>","stackedDays":3}'                (force the stacked-days copy)
//   -d '{"userId":"<id>","daysAway":5}'                   (force the comeback / away copy)
// ---------------------------------------------------------------------------
export const sendTestPush = onRequest(
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const {
      userId, title, body, notificationType = "morning",
      stackedDays: stackedOverride, daysAway: awayOverride,
    } = req.body ?? {};
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    const userSnap = await admin.firestore().doc(`users/${userId}`).get();
    if (!userSnap.exists) { res.status(404).json({ error: "User not found" }); return; }
    const user = { id: userSnap.id, ...(userSnap.data() as Omit<User, "id"> & { currentStreak?: number }) };

    if (!user.fcmTokens?.length) { res.status(400).json({ error: `${user.displayName} has no fcmTokens` }); return; }

    let finalTitle: string;
    let finalBody: string;

    if (title && body) {
      finalTitle = title;
      finalBody = body;
    } else {
      const today = getTodayPT();
      const challenge = getChallengeForDate(today);
      if (!challenge) { res.status(400).json({ error: "No active challenge today" }); return; }

      const dayNumber = getDayNumber(challenge, today)!;
      const totalDays = getTotalDays(challenge);
      const testTarget = getDailyTarget(challenge, today);
      if (!testTarget || testTarget.isRestDay) { res.status(400).json({ error: "Today is a rest day — no notification to send" }); return; }
      const todayReps = testTarget.totalReps;

      const [userLogSnap, partSnap, usersSnap, allLogsSnap, userLogsSnap] = await Promise.all([
        admin.firestore().doc(`dailyLogs/${userId}_${today}`).get(),
        admin.firestore().doc(`participation/${userId}_${challenge.id}`).get(),
        admin.firestore().collection("users").get(),
        admin.firestore().collection("dailyLogs").where("challengeId", "==", challenge.id).where("date", "==", today).get(),
        admin.firestore().collection("dailyLogs").where("challengeId", "==", challenge.id).where("userId", "==", userId).get(),
      ]);

      const userLog = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null;
      const part    = partSnap.exists    ? (partSnap.data()    as ChallengeParticipation) : null;
      let statusStr = part?.status ?? "active";
      if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;

      const userById = new Map(usersSnap.docs.map(d => [d.id, (d.data() as User).displayName]));
      const completedIds = new Set(allLogsSnap.docs.filter(d => (d.data() as DailyLog).completionFraction >= 1).map(d => (d.data() as DailyLog).userId));
      const completedNames = [...completedIds].filter(id => id !== userId).map(id => userById.get(id) ?? "").filter(Boolean);
      const notDoneNames   = usersSnap.docs.filter(d => d.id !== userId && !completedIds.has(d.id)).map(d => (d.data() as User).displayName);

      const fraction        = userLog?.completionFraction ?? 0;
      const repsCompleted   = userLog?.exerciseLogs?.length
        ? userLog.exerciseLogs.reduce((sum, el) => {
            const ex = challenge.exercises.find(e => e.id === el.exerciseId);
            return (ex?.unit ?? 'reps') === 'reps' ? sum + Math.min(el.completedReps, el.targetReps) : sum;
          }, 0)
        : Math.round(todayReps * fraction);
      const repsRemaining   = Math.max(0, todayReps - repsCompleted);
      const repsPerExercise = testTarget.repsPerExercise;

      // Real comeback / stacked-day context, unless the request overrides it
      // so the copy can be previewed on demand.
      const real = completionContext(
        challenge,
        userLogsSnap.docs.map(d => d.data() as DailyLog),
        today,
      );
      const stackedDays = typeof stackedOverride === "number" ? stackedOverride : real.stackedDays;
      const daysAway    = typeof awayOverride    === "number" ? awayOverride    : real.daysAway;

      const result = generateNotification({
        challenge,
        dailyTarget: testTarget,
        exerciseLogs: userLog?.exerciseLogs ?? null,
        userName: user.displayName, challengeName: challenge.name,
        dayNumber, totalDays, todayTarget: todayReps,
        repsCompleted, repsRemaining, repsPerExercise,
        primaryExercise: challenge.exercises[0]?.name ?? "Rep",
        userCompleted: fraction >= 1,
        completionFraction: fraction,
        groupCompletedCount: completedIds.size,
        groupTotalCount: usersSnap.size,
        userStreak: user.currentStreak ?? 0,
        participationStatus: statusStr,
        notificationType,
        completedNames,
        notDoneNames,
        stackedDays,
        daysAway,
      });
      finalTitle = result.title;
      finalBody  = result.body;
    }

    await sendPushNotification(user.id, user.fcmTokens, finalTitle, finalBody, "/");
    res.json({ ok: true, sentTo: user.displayName, tokenCount: user.fcmTokens.length, title: finalTitle, body: finalBody });
  }
);

// ---------------------------------------------------------------------------
// badgeBackfill — reusable helper for awarding completion badges after a
// challenge ends. Idempotent: skips users who already have the badge.
// ---------------------------------------------------------------------------

async function runBadgeBackfill(challengeId: string): Promise<Array<{ userId: string; name: string; action: string }>> {
  const challenge = getChallengeById(challengeId);
  if (!challenge) throw new Error(`Unknown challengeId: ${challengeId}`);
  const db = admin.firestore();

  const usersSnap = await db.collection("users").get();
  const results: Array<{ userId: string; name: string; action: string }> = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const userId = userDoc.id;
    const name: string = data.displayName ?? userId;

    const badges: Array<{ challengeId: string; type?: string; tier?: TrophyTier }> = data.badges ?? [];
    const existing = badges.find(b => b.challengeId === challengeId);

    const logsSnap = await db.collection("dailyLogs")
      .where("userId", "==", userId)
      .where("challengeId", "==", challengeId)
      .get();

    const completedDays = logsSnap.docs.filter(
      d => (d.data().completionFraction ?? 0) >= 1
    ).length;

    if (completedDays === 0) {
      results.push({ userId, name, action: "no_logs" });
      continue;
    }

    // Trophies only climb: 🎖️ → 🥉 50% → 🥈 80% → 🥇 100%. A user who already
    // holds this (or a higher) tier is left untouched, which is what makes this
    // safe to re-run and safe against badges awarded live during the month.
    const tier = trophyUpgrade(existing, tierForCompletedDays(challenge, completedDays));
    if (!tier) {
      results.push({ userId, name, action: "already_has_badge" });
      continue;
    }

    const badgeType = legacyBadgeType(tier);
    const filteredBadges = badges.filter(b => b.challengeId !== challengeId);
    await db.doc(`users/${userId}`).update({
      badges: [...filteredBadges, { challengeId, type: badgeType, tier, awardedAt: new Date().toISOString() }],
      pendingCelebration: { challengeId, badgeType, tier },
    });

    const notifId = nanoid();
    const { title: notifTitle, body: notifBody } = trophyNotification({
      challenge, tier, completedDays,
    });
    await db.doc(`notifications/${userId}/items/${notifId}`).set({
      id: notifId, userId, type: "system", title: notifTitle, body: notifBody,
      read: false, createdAt: new Date().toISOString(),
    });

    const tokens: string[] = data.fcmTokens ?? [];
    if (tokens.length > 0) {
      await sendPushNotification(userId, tokens, notifTitle, notifBody);
    }

    results.push({ userId, name, action: `${tier}_trophy_awarded (${completedDays} days)` });
  }

  return results;
}

// ---------------------------------------------------------------------------
// backfillAprilBadges — one-time HTTP trigger for April 2026.
// Idempotent. Call once: curl -X POST <function-url>/backfillAprilBadges
// To backfill a future challenge, export a new onRequest that calls
// runBadgeBackfill("<challenge-id>").
// ---------------------------------------------------------------------------

export const backfillAprilBadges = onRequest(async (_req, res) => {
  const results = await runBadgeBackfill("apr-2026");
  res.json({ ok: true, results });
});

// ---------------------------------------------------------------------------
// ensureStorageLifecycle — keeps a 1-year TTL on uploaded feed videos.
//
// Videos are far larger than photos, so we cap how long they live in Storage.
// This sets a GCS Object Lifecycle rule that auto-deletes anything under
// `feed-videos/` 365 days after it's created. Photos (feed-images/) are left
// untouched. The rule is a bucket-level setting, so we reconcile it on a
// schedule (idempotent — setMetadata replaces the lifecycle wholesale) rather
// than trusting a one-time manual `gsutil lifecycle set`.
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = "f3-bedrock-monthly-challenge.firebasestorage.app";
const VIDEO_TTL_DAYS = 365;

export const ensureStorageLifecycle = onSchedule(
  {
    schedule: "0 5 * * 1", // Mondays 05:00 PT
    timeZone: "America/Los_Angeles",
  },
  async () => {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    try {
      await bucket.setMetadata({
        lifecycle: {
          rule: [
            {
              action: { type: "Delete" },
              condition: { age: VIDEO_TTL_DAYS, matchesPrefix: ["feed-videos/"] },
            },
          ],
        },
      });
      console.log(`[lifecycle] feed-videos/ TTL set to ${VIDEO_TTL_DAYS} days on ${STORAGE_BUCKET}`);
    } catch (err) {
      // Non-fatal: if the service account can't update bucket metadata, log it
      // so it can be granted storage.buckets.update (or the rule set by hand).
      console.error("[lifecycle] failed to set feed-videos/ lifecycle rule:", err);
    }
  }
);
