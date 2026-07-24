'use client'

import { cn } from '@/lib/utils'
import { formatRemainingWork, getRemainingNudge } from '@/lib/challenges'
import type { RemainingExercise } from '@/lib/challenges'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WelcomeMessageProps {
  userName: string
  dayNumber: number
  totalDays: number
  totalReps: number
  repsPerExercise: number
  exerciseCount: number
  completionFraction: number  // precise 0–1 fraction of reps done
  loggedReps: number
  streak: number
  completedCount: number      // PAX who finished today
  totalPAX: number
  activeCount: number         // PAX in progress today
  incompleteNames: string[]   // display names of PAX who haven't finished
  remaining: RemainingExercise[] // today's exercises still to do
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

// Stable per user+day so message doesn't flicker on re-renders, but varies each day
function makePick(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return function pick<T>(arr: T[]): T {
    return arr[Math.abs(h++) % arr.length]
  }
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
    completionFraction,
    loggedReps,
    streak,
    completedCount,
    totalPAX,
    activeCount,
    incompleteNames,
    remaining,
    exerciseCount,
  } = ctx

  const pick = makePick(`${userName}-${dayNumber}`)

  const tod = getTimeOfDay(hour)
  const daysLeft = totalDays - dayNumber
  const nearEnd = daysLeft <= 5
  const earlyMonth = dayNumber <= 5
  const isDone = completionFraction >= 1
  const inProgress = (loggedReps > 0 || completionFraction > 0) && completionFraction < 1
  const paxNotDone = totalPAX - completedCount
  const majorityDone = totalPAX > 0 && completedCount / totalPAX > 0.5

  const repsRemaining = Math.max(0, totalReps - loggedReps)

  // Exercise-aware "what's left" copy: "20 incline merkins and 20 decline
  // merkins" instead of "40 reps". nudge is a full custom sentence ("finish
  // those dead hangs...") available when ≤3 exercises remain.
  const workLeft = remaining.length > 0
    ? formatRemainingWork(remaining, exerciseCount)
    : `${repsRemaining} reps`
  let seedH = 0
  for (let i = 0; i < userName.length; i++) seedH = (Math.imul(31, seedH) + userName.charCodeAt(i)) | 0
  const nudge = getRemainingNudge(remaining, Math.abs(seedH) + dayNumber)

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
      return pick([
        { greeting: `Clean sweep, ${userName}.`, body: `Every PAX locked in on day ${dayNumber}. Full crew. That's what it's about.` },
        { greeting: `Full house, ${userName}.`, body: `Everyone checked in on day ${dayNumber}. This is what the crew looks like when it locks in.` },
        { greeting: `Nobody left behind.`, body: `Every single PAX done on day ${dayNumber}. The whole group showed up today.` },
      ])
    }
    if (paxNotDone === 1 && incompleteNames.length > 0) {
      return pick([
        { greeting: `You're done — now go get ${incompleteNames[0]}.`, body: `One PAX still needs to check in. Drop a shoutout and pull 'em across the line.` },
        { greeting: `Almost a clean sweep.`, body: `Just ${incompleteNames[0]} left. Give 'em a nudge and make it a full house.` },
        { greeting: `One more, ${userName}.`, body: `${incompleteNames[0]} hasn't logged yet — send some heat their way.` },
      ])
    }
    if (paxNotDone > 0 && paxNotDone <= 3 && incompleteNames.length > 0) {
      return pick([
        { greeting: `Locked in. Help finish the crew.`, body: `${nameList(incompleteNames)} still need${paxNotDone === 1 ? 's' : ''} to check in — give 'em a push.` },
        { greeting: `You're done, now pull the rest across.`, body: `${nameList(incompleteNames)} still out there. A shoutout goes a long way.` },
        { greeting: `Good work. Now recruit.`, body: `${paxNotDone} PAX still need to log — ${nameList(incompleteNames.slice(0, 2))} included.` },
      ])
    }
    if (paxNotDone > 3 && incompleteNames.length > 0) {
      return pick([
        { greeting: `You're done, ${userName}. Push the crew.`, body: `${paxNotDone} PAX haven't checked in yet — ${nameList(incompleteNames.slice(0, 2))} still out there.` },
        { greeting: `Checked off. Now make some noise.`, body: `${paxNotDone} PAX still need to log. Drop a shoutout and get 'em moving.` },
        { greeting: `Your work is done. Theirs isn't.`, body: `${paxNotDone} PAX still on the clock — ${nameList(incompleteNames.slice(0, 2))} among them.` },
      ])
    }
    if (nearEnd) {
      return pick([
        { greeting: `Day ${dayNumber} done, ${userName}.`, body: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left. Don't let up now.` },
        { greeting: `${daysLeft} days left. You're not stopping now.`, body: `Day ${dayNumber} locked. Finish what you started.` },
        { greeting: `Almost there, ${userName}.`, body: `Day ${dayNumber} checked off. ${daysLeft} more to go — this is the finish line push.` },
      ])
    }
    if (streak >= 3) {
      return pick([
        { greeting: `${streak} days straight, ${userName}.`, body: `Day ${dayNumber} checked off. ${paxNotDone > 0 ? `${paxNotDone} PAX still going — push 'em.` : "Everyone's rolling."}` },
        { greeting: `Streak intact. Day ${dayNumber} done.`, body: `${streak} in a row. Keep showing up like this.` },
        { greeting: `${streak}-day run and counting.`, body: `Day ${dayNumber} in the books. Don't let tomorrow break it.` },
      ])
    }
    return pick([
      { greeting: `Locked in, ${userName}.`, body: `${completedCount}/${totalPAX} PAX done today.${paxNotDone > 0 ? ` Encourage ${nameList(incompleteNames.slice(0, 2))} to close it out.` : ''}` },
      { greeting: `Day ${dayNumber} done.`, body: `${completedCount} PAX checked in.${paxNotDone > 0 ? ` ${nameList(incompleteNames.slice(0, 2))} still needs to finish.` : ' Nice work today.'}` },
      { greeting: `That's it for day ${dayNumber}, ${userName}.`, body: `${completedCount}/${totalPAX} PAX accounted for.${paxNotDone > 0 ? ` Push ${nameList(incompleteNames.slice(0, 2))} to close it out.` : ''}` },
    ])
  }

  // ── In progress ─────────────────────────────────────────────────────────────

  if (inProgress) {
    if (tod === 'night') {
      const options = [
        { greeting: `Finish it, ${userName}.`, body: `Only ${workLeft} left — don't go to bed without checking this one off.` },
        { greeting: `Don't sleep on this, ${userName}.`, body: `${workLeft} standing between you and a clean day ${dayNumber}.` },
        { greeting: `Almost there — close it out.`, body: `Just ${workLeft} left. Finish before you hit the rack.` },
      ]
      if (nudge) options.push({ greeting: `Last push, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (tod === 'evening') {
      const options = [
        { greeting: `Almost there, ${userName}.`, body: `Only ${workLeft} to close out day ${dayNumber}. ${majorityDone ? `${completedCount} PAX already done.` : 'Finish strong.'}` },
        { greeting: `Finish what you started.`, body: `${workLeft} left on day ${dayNumber}. Evening's burning — don't leave it unfinished.` },
        { greeting: `So close, ${userName}.`, body: `${workLeft} and day ${dayNumber} is done. ${majorityDone ? `${completedCount} PAX already wrapped up.` : 'Get it done tonight.'}` },
      ]
      if (nudge) options.push({ greeting: `So close, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (streak >= 3) {
      const options = [
        { greeting: `${streak}-day streak on the line.`, body: `Only ${workLeft} left, ${userName}. Keep it rolling.` },
        { greeting: `Don't stop now, ${userName}.`, body: `${workLeft} to protect a ${streak}-day streak.` },
        { greeting: `${streak} days in a row. Finish it.`, body: `${workLeft} left. You're not letting this one slip.` },
      ]
      if (nudge) options.push({ greeting: `${streak}-day streak on the line.`, body: nudge })
      return pick(options)
    }
    if (majorityDone) {
      const options = [
        { greeting: `Don't stop now, ${userName}.`, body: `Only ${workLeft} to go. ${completedCount} PAX already wrapped up.` },
        { greeting: `Crew's moving — keep up.`, body: `${completedCount} PAX are done. ${workLeft} left for you.` },
        { greeting: `You started, so finish.`, body: `${workLeft} left. ${completedCount} PAX already logged it today.` },
      ]
      if (nudge) options.push({ greeting: `Crew's moving — keep up.`, body: nudge })
      return pick(options)
    }
    const options = [
      { greeting: `Good start, ${userName}.`, body: `Only ${workLeft} left on day ${dayNumber}. Knock it out.` },
      { greeting: `Keep the momentum, ${userName}.`, body: `${workLeft} to go. You're already moving — don't stop.` },
      { greeting: `Halfway counts for nothing, ${userName}.`, body: `${workLeft} left. Finish the day.` },
    ]
    if (nudge) options.push({ greeting: `Good start, ${userName}.`, body: nudge })
    return pick(options)
  }

  // ── Not started ─────────────────────────────────────────────────────────────
  // workLeft here is the digestible day framing ("8 exercises"), and nudge is
  // the fresh-day starter line ("Start with the lunges — momentum does the rest.")

  if (streak >= 2) {
    const paxLine = completedCount > 0 ? ` ${completedCount} PAX already in.` : ''
    const dayLine = `Day ${dayNumber}: ${workLeft}.`
    if (tod === 'evening' || tod === 'night') {
      const options = [
        { greeting: `Don't lose it now, ${userName}.`, body: `${streak}-day streak on the line. ${dayLine}${paxLine}` },
        { greeting: `Streak's still alive — keep it that way.`, body: `${streak} days running. ${dayLine}${paxLine}` },
        { greeting: `${streak} days. Don't let tonight end that.`, body: `${dayLine}${paxLine} Protect the streak.` },
      ]
      if (nudge) options.push({ greeting: `${streak}-day streak on the line.`, body: nudge })
      return pick(options)
    }
    const options = [
      { greeting: `Rise up, ${userName}.`, body: `${streak}-day streak on the line. ${dayLine}${paxLine}` },
      { greeting: `${streak} days and counting, ${userName}.`, body: `Keep it alive. ${dayLine}${paxLine}` },
      { greeting: `Protect the streak, ${userName}.`, body: `${streak} days running. ${dayLine}${paxLine}` },
      { greeting: `Don't break it now.`, body: `${streak}-day streak. ${dayLine}${paxLine}` },
    ]
    if (nudge) options.push({ greeting: `Protect the streak, ${userName}.`, body: nudge })
    return pick(options)
  }

  if (tod === 'morning') {
    if (completedCount > 0) {
      const options = [
        { greeting: `Rise up, ${userName}.`, body: `${completedCount} PAX already checked in. Day ${dayNumber}: ${workLeft}.` },
        { greeting: `${completedCount} PAX are ahead of you.`, body: `Day ${dayNumber}: ${workLeft}. Get after it.` },
        { greeting: `The crew is already moving.`, body: `${completedCount} PAX checked in. ${workLeft} on your list — don't let 'em get too far ahead.` },
      ]
      if (nudge) options.push({ greeting: `Rise up, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (earlyMonth) {
      const options = [
        { greeting: `Good morning, ${userName}.`, body: `Day ${dayNumber} of ${totalDays}: ${workLeft}. Let's start strong.` },
        { greeting: `Day ${dayNumber}. Let's build the habit.`, body: `${workLeft} on today's list. Early days set the tone for the whole month.` },
        { greeting: `Fresh start, ${userName}.`, body: `Day ${dayNumber} of ${totalDays}. ${workLeft} to check off — make it count.` },
      ]
      if (nudge) options.push({ greeting: `Good morning, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (nearEnd) {
      const options = [
        { greeting: `Morning, ${userName}.`, body: `Day ${dayNumber} — ${daysLeft} left in the challenge. ${workLeft} today. Don't let up.` },
        { greeting: `${daysLeft} days left. Go.`, body: `Day ${dayNumber}: ${workLeft}. You've come too far to coast now.` },
        { greeting: `Finish line's close, ${userName}.`, body: `${daysLeft} days remain. Day ${dayNumber}: ${workLeft} — lock it in.` },
      ]
      if (nudge) options.push({ greeting: `Morning, ${userName}.`, body: nudge })
      return pick(options)
    }
    const options = [
      { greeting: `Morning, ${userName}.`, body: `Day ${dayNumber}: ${workLeft} on deck. Start with one — momentum does the rest.` },
      { greeting: `Rise and grind, ${userName}.`, body: `Day ${dayNumber} is waiting: ${workLeft}.` },
      { greeting: `New day, same mission.`, body: `Day ${dayNumber}: ${workLeft}. Get the first one in.` },
      { greeting: `Up and at 'em, ${userName}.`, body: `${workLeft} on the board for day ${dayNumber}. Let's go.` },
    ]
    if (nudge) options.push({ greeting: `Morning, ${userName}.`, body: nudge })
    return pick(options)
  }

  if (tod === 'afternoon') {
    if (majorityDone) {
      const options = [
        { greeting: `Clock's ticking, ${userName}.`, body: `${completedCount}/${totalPAX} PAX are done. Day ${dayNumber}: ${workLeft} waiting on you.` },
        { greeting: `More than half the crew is done.`, body: `${completedCount}/${totalPAX} PAX checked in. ${workLeft} on your list — don't fall behind.` },
        { greeting: `The crew isn't waiting, ${userName}.`, body: `${completedCount} PAX already logged day ${dayNumber}. ${workLeft} — get on it.` },
      ]
      if (nudge) options.push({ greeting: `Clock's ticking, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (activeCount > 0) {
      const options = [
        { greeting: `Afternoon, ${userName}.`, body: `${activeCount} PAX are in the middle of it right now. Day ${dayNumber}: ${workLeft}.` },
        { greeting: `The crew is grinding.`, body: `${activeCount} PAX are mid-workout. ${workLeft} on your list — jump in.` },
        { greeting: `${activeCount} PAX are already going, ${userName}.`, body: `Day ${dayNumber}: ${workLeft}. Join 'em.` },
      ]
      if (nudge) options.push({ greeting: `Afternoon, ${userName}.`, body: nudge })
      return pick(options)
    }
    const options = [
      { greeting: `Afternoon, ${userName}.`, body: `Day ${dayNumber}: ${workLeft}. ${completedCount > 0 ? `${completedCount} PAX down.` : 'Get the first one in now.'}` },
      { greeting: `Afternoon check-in, ${userName}.`, body: `Day ${dayNumber} isn't going to log itself. ${workLeft} — get started.` },
      { greeting: `Still time today, ${userName}.`, body: `${workLeft} on the board for day ${dayNumber}. Knock one out this afternoon.` },
    ]
    if (nudge) options.push({ greeting: `Still time today, ${userName}.`, body: nudge })
    return pick(options)
  }

  if (tod === 'evening') {
    if (majorityDone) {
      const options = [
        { greeting: `Don't get left behind, ${userName}.`, body: `${completedCount}/${totalPAX} PAX are done. ${workLeft} before tonight's over.` },
        { greeting: `The crew already handled it.`, body: `${completedCount}/${totalPAX} PAX logged day ${dayNumber}. ${workLeft} — your turn.` },
        { greeting: `Everyone else showed up, ${userName}.`, body: `${completedCount} PAX are done. You've still got ${workLeft} before tonight ends.` },
      ]
      if (nudge) options.push({ greeting: `Don't get left behind, ${userName}.`, body: nudge })
      return pick(options)
    }
    if (nearEnd) {
      const options = [
        { greeting: `Evening, ${userName}.`, body: `${daysLeft} days left in the challenge. Day ${dayNumber}: ${workLeft} — don't skip tonight.` },
        { greeting: `So close to the finish.`, body: `${daysLeft} days remain. Day ${dayNumber}: ${workLeft}. This isn't the time to ease up.` },
        { greeting: `${daysLeft} days left — protect that.`, body: `Day ${dayNumber}: ${workLeft}. Don't let this evening slip.` },
      ]
      if (nudge) options.push({ greeting: `Evening, ${userName}.`, body: nudge })
      return pick(options)
    }
    const options = [
      { greeting: `Evening, ${userName}.`, body: `Day ${dayNumber} isn't done yet. ${workLeft} before you call it a night.` },
      { greeting: `Don't let today go unmarked.`, body: `${workLeft} left on day ${dayNumber}. You've still got time tonight.` },
      { greeting: `Night's not over yet, ${userName}.`, body: `Day ${dayNumber}: ${workLeft}. Get it in before you wind down.` },
    ]
    if (nudge) options.push({ greeting: `Night's not over yet, ${userName}.`, body: nudge })
    return pick(options)
  }

  // night
  if (majorityDone) {
    const options = [
      { greeting: `Last call, ${userName}.`, body: `${completedCount}/${totalPAX} PAX are done. ${workLeft} on the clock for day ${dayNumber}.` },
      { greeting: `Clock's almost out.`, body: `${completedCount} PAX logged it. ${workLeft} remaining for day ${dayNumber} — last chance.` },
      { greeting: `Don't let the day end like this.`, body: `${completedCount}/${totalPAX} PAX finished. ${workLeft} — you've still got time.` },
    ]
    if (nudge) options.push({ greeting: `Last call, ${userName}.`, body: nudge })
    return pick(options)
  }
  if (nearEnd) {
    const options = [
      { greeting: `Last call, ${userName}.`, body: `Day ${dayNumber}, ${daysLeft} left. ${workLeft} — don't let tonight slip.` },
      { greeting: `${daysLeft} days left. Don't waste one.`, body: `Day ${dayNumber}: ${workLeft}. Tonight's the last shot.` },
      { greeting: `Almost at the finish line.`, body: `${daysLeft} days remain. Day ${dayNumber}: ${workLeft} — get it done tonight.` },
    ]
    if (nudge) options.push({ greeting: `Last call, ${userName}.`, body: nudge })
    return pick(options)
  }
  const options = [
    { greeting: `Still up, ${userName}?`, body: `${workLeft} on the board for day ${dayNumber}. Get it done.` },
    { greeting: `Late but not too late.`, body: `Day ${dayNumber}: ${workLeft}. Don't let the clock run out on this one.` },
    { greeting: `Last chance tonight, ${userName}.`, body: `${workLeft} left for day ${dayNumber}. You know what to do.` },
  ]
  if (nudge) options.push({ greeting: `Late but not too late.`, body: nudge })
  return pick(options)
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
