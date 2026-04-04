'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WelcomeMessageProps {
  userName: string
  dayNumber: number
  totalDays: number
  totalReps: number
  repsPerExercise: number
  exerciseCount: number
  completionFraction: number  // 0 | 0.25 | 0.5 | 0.75 | 1
  loggedReps: number
  streak: number
  completedCount: number      // PAX who finished today
  totalPAX: number
  activeCount: number         // PAX in progress today
  incompleteNames: string[]   // display names of PAX who haven't finished
}

// ─── Logic ────────────────────────────────────────────────────────────────────

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

function getHourPT(): number {
  return parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      hour12: false,
    }),
    10
  ) % 24
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function getWelcomeMessage(
  ctx: WelcomeMessageProps & { hour: number }
): { greeting: string; body: string } {
  const {
    userName,
    hour,
    dayNumber,
    totalDays,
    totalReps,
    repsPerExercise,
    completionFraction,
    loggedReps,
    streak,
    completedCount,
    totalPAX,
    activeCount,
    incompleteNames,
  } = ctx

  const tod = getTimeOfDay(hour)
  const daysLeft = totalDays - dayNumber
  const nearEnd = daysLeft <= 5
  const earlyMonth = dayNumber <= 5
  const isDone = completionFraction >= 1
  const inProgress = (loggedReps > 0 || completionFraction > 0) && completionFraction < 1
  const paxNotDone = totalPAX - completedCount
  const majorityDone = totalPAX > 0 && completedCount / totalPAX > 0.5

  const repsRemaining = Math.max(0, totalReps - loggedReps)

  // Format a short name list: "Dredd", "Dredd and Fuse", "Dredd, Fuse, and 3 others"
  function nameList(names: string[]): string {
    if (names.length === 0) return 'the crew'
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names[0]}, ${names[1]}, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (isDone) {
    if (completedCount >= totalPAX && totalPAX > 0) {
      return {
        greeting: `Clean sweep, ${userName}.`,
        body: `Every PAX locked in on day ${dayNumber}. Full crew. That's what it's about.`,
      }
    }
    if (paxNotDone === 1 && incompleteNames.length > 0) {
      return {
        greeting: `You're done — now go get ${incompleteNames[0]}.`,
        body: `One PAX still needs to check in. Drop a shoutout and pull 'em across the line.`,
      }
    }
    if (paxNotDone > 0 && paxNotDone <= 3 && incompleteNames.length > 0) {
      return {
        greeting: `Locked in. Help finish the crew.`,
        body: `${nameList(incompleteNames)} still need${paxNotDone === 1 ? 's' : ''} to check in — give 'em a push.`,
      }
    }
    if (paxNotDone > 3 && incompleteNames.length > 0) {
      return {
        greeting: `You're done, ${userName}. Push the crew.`,
        body: `${paxNotDone} PAX haven't checked in yet — ${nameList(incompleteNames.slice(0, 2))} still out there.`,
      }
    }
    if (nearEnd) {
      return {
        greeting: `Day ${dayNumber} done, ${userName}.`,
        body: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left. Don't let up now.`,
      }
    }
    if (streak >= 3) {
      return {
        greeting: `${streak} days straight, ${userName}.`,
        body: `Day ${dayNumber} checked off. ${paxNotDone > 0 ? `${paxNotDone} PAX still going — push 'em.` : "Everyone's rolling."}`,
      }
    }
    return {
      greeting: `Locked in, ${userName}.`,
      body: `${completedCount}/${totalPAX} PAX done today.${paxNotDone > 0 ? ` Encourage ${nameList(incompleteNames.slice(0, 2))} to close it out.` : ''}`,
    }
  }

  // ── In progress ─────────────────────────────────────────────────────────────

  if (inProgress) {
    if (tod === 'night') {
      return {
        greeting: `Finish it, ${userName}.`,
        body: `${repsRemaining} reps left — don't go to bed without checking this one off.`,
      }
    }
    if (tod === 'evening') {
      return {
        greeting: `Almost there, ${userName}.`,
        body: `${repsRemaining} reps to close out day ${dayNumber}. ${majorityDone ? `${completedCount} PAX already done.` : 'Finish strong.'}`,
      }
    }
    if (streak >= 3) {
      return {
        greeting: `${streak}-day streak on the line.`,
        body: `${repsRemaining} reps left, ${userName}. Keep it rolling.`,
      }
    }
    if (majorityDone) {
      return {
        greeting: `Don't stop now, ${userName}.`,
        body: `${repsRemaining} reps to go. ${completedCount} PAX already wrapped up.`,
      }
    }
    return {
      greeting: `Good start, ${userName}.`,
      body: `${repsRemaining} reps left on day ${dayNumber}. Knock 'em out.`,
    }
  }

  // ── Not started ─────────────────────────────────────────────────────────────

  if (tod === 'morning') {
    if (completedCount > 0) {
      return {
        greeting: `Rise up, ${userName}.`,
        body: `${completedCount} PAX already checked in. Day ${dayNumber}: ${totalReps} reps (${repsPerExercise} each).`,
      }
    }
    if (earlyMonth) {
      return {
        greeting: `Good morning, ${userName}.`,
        body: `Day ${dayNumber} of ${totalDays}. ${totalReps} reps, ${repsPerExercise} each. Let's start strong.`,
      }
    }
    if (nearEnd) {
      return {
        greeting: `Morning, ${userName}.`,
        body: `Day ${dayNumber} — ${daysLeft} left in the challenge. ${totalReps} reps. Don't let up.`,
      }
    }
    return {
      greeting: `Morning, ${userName}.`,
      body: `Day ${dayNumber}: ${totalReps} reps on deck (${repsPerExercise} each). Start a set now.`,
    }
  }

  if (tod === 'afternoon') {
    if (majorityDone) {
      return {
        greeting: `Clock's ticking, ${userName}.`,
        body: `${completedCount}/${totalPAX} PAX are done. Day ${dayNumber}: ${totalReps} reps waiting on you.`,
      }
    }
    if (activeCount > 0) {
      return {
        greeting: `Afternoon, ${userName}.`,
        body: `${activeCount} PAX are in the middle of it right now. Day ${dayNumber}: ${totalReps} reps.`,
      }
    }
    return {
      greeting: `Afternoon, ${userName}.`,
      body: `Day ${dayNumber}: ${totalReps} reps (${repsPerExercise} each). ${completedCount > 0 ? `${completedCount} PAX down.` : 'Get a set in now.'}`,
    }
  }

  if (tod === 'evening') {
    if (majorityDone) {
      return {
        greeting: `Don't get left behind, ${userName}.`,
        body: `${completedCount}/${totalPAX} PAX are done. ${totalReps} reps before tonight's over.`,
      }
    }
    if (nearEnd) {
      return {
        greeting: `Evening, ${userName}.`,
        body: `${daysLeft} days left in the challenge. Day ${dayNumber}: ${totalReps} reps — don't skip tonight.`,
      }
    }
    return {
      greeting: `Evening, ${userName}.`,
      body: `Day ${dayNumber} isn't done yet. ${totalReps} reps before you call it a night.`,
    }
  }

  // night
  if (majorityDone) {
    return {
      greeting: `Last call, ${userName}.`,
      body: `${completedCount}/${totalPAX} PAX are done. ${totalReps} reps on the clock for day ${dayNumber}.`,
    }
  }
  if (nearEnd) {
    return {
      greeting: `Last call, ${userName}.`,
      body: `Day ${dayNumber}, ${daysLeft} left. ${totalReps} reps — don't let tonight slip.`,
    }
  }
  return {
    greeting: `Still up, ${userName}?`,
    body: `${totalReps} reps on the board for day ${dayNumber}. Get it done.`,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WelcomeMessage(props: WelcomeMessageProps) {
  const hour = getHourPT()
  const isDone = props.completionFraction >= 1
  const inProgress = (props.loggedReps > 0 || props.completionFraction > 0) && props.completionFraction < 1
  const { greeting, body } = getWelcomeMessage({ ...props, hour })

  return (
    <div
      className={cn(
        'rounded-2xl px-4 py-3 border flex items-start gap-3',
        isDone
          ? 'bg-green-950/40 border-green-800/60'
          : inProgress
          ? 'bg-orange-950/30 border-orange-800/40'
          : 'bg-zinc-900 border-zinc-800'
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isDone ? 'bg-green-500/25' : inProgress ? 'bg-orange-500/20' : 'bg-zinc-800'
        )}
      >
        {isDone ? (
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : inProgress ? (
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-bold text-sm',
          isDone ? 'text-green-300' : inProgress ? 'text-orange-200' : 'text-white'
        )}>
          {greeting}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
