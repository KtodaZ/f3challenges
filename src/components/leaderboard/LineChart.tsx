'use client'

import { useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'

export interface LinePoint {
  /** X-axis label shown sparsely along the bottom (e.g. day number). */
  label: string
  /** Full label used inside the tooltip (e.g. "Wed, Apr 15"). */
  fullLabel: string
  value: number
}

interface LineChartProps {
  points: LinePoint[]
  /** Line + marker color (hex). */
  color: string
  /** Formats a value for the tooltip / y-axis. */
  formatValue?: (v: number) => string
  /** Force a y-axis maximum; otherwise derived from the data. */
  yMax?: number
  height?: number
  /** Short unit shown under the hovered value (e.g. "reps", "done"). */
  unit?: string
}

const PAD = { top: 12, right: 14, bottom: 22, left: 34 }

/** Measure a container's width so the SVG can be drawn crisply in real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function LineChart({
  points,
  color,
  formatValue = v => v.toLocaleString(),
  yMax,
  height = 160,
  unit,
}: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const max = useMemo(() => {
    const dataMax = points.reduce((m, p) => Math.max(m, p.value), 0)
    return yMax ?? Math.max(dataMax, 1)
  }, [points, yMax])

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom

  const xFor = useCallback(
    (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW),
    [plotW, points.length]
  )
  const yFor = useCallback(
    (v: number) => PAD.top + plotH - (v / max) * plotH,
    [plotH, max]
  )

  const linePath = useMemo(() => {
    if (points.length === 0 || width === 0) return ''
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
      .join(' ')
  }, [points, width, xFor, yFor])

  const areaPath = useMemo(() => {
    if (!linePath) return ''
    const baseY = (PAD.top + plotH).toFixed(1)
    return `${linePath} L${xFor(points.length - 1).toFixed(1)},${baseY} L${xFor(0).toFixed(1)},${baseY} Z`
  }, [linePath, points.length, plotH, xFor])

  // Three horizontal gridlines: 0, mid, max
  const gridVals = [0, max / 2, max]

  // Sparse x labels — first, last, and a few between, avoiding clutter
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  const handleMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (points.length === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = plotW <= 0 ? 0 : (x - PAD.left) / plotW
      const idx = Math.round(ratio * (points.length - 1))
      setActive(Math.min(points.length - 1, Math.max(0, idx)))
    },
    [points.length, plotW]
  )

  const gradId = useMemo(() => `lc-grad-${Math.random().toString(36).slice(2, 8)}`, [])

  const activePoint = active !== null ? points[active] : null

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && points.length > 0 && (
        <svg width={width} height={height} className="block">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines + y labels */}
          {gridVals.map((v, i) => {
            const y = yFor(v)
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="#3f3f46"
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? undefined : '3 3'}
                  opacity={i === 0 ? 0.8 : 0.4}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500"
                  style={{ fontSize: 9 }}
                >
                  {formatValue(Math.round(v))}
                </text>
              </g>
            )
          })}

          {/* Area + line */}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* X labels */}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={i}
                x={xFor(i)}
                y={height - 6}
                textAnchor="middle"
                className="fill-zinc-500"
                style={{ fontSize: 9 }}
              >
                {p.label}
              </text>
            ) : null
          )}

          {/* Active crosshair + marker */}
          {activePoint && (
            <g>
              <line
                x1={xFor(active!)}
                x2={xFor(active!)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke={color}
                strokeWidth={1}
                opacity={0.4}
              />
              <circle cx={xFor(active!)} cy={yFor(activePoint.value)} r={4.5} fill={color} stroke="#18181b" strokeWidth={2} />
            </g>
          )}

          {/* Pointer capture surface */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={handleMove}
            onPointerMove={e => { if (e.pointerType === 'mouse') handleMove(e) }}
            onPointerLeave={() => setActive(null)}
            onPointerCancel={() => setActive(null)}
            // 'auto' lets the parent carousel swipe / page scroll through this
            // surface on touch; a tap still selects the nearest point.
            style={{ touchAction: 'auto' }}
          />
        </svg>
      )}

      {/* Tooltip */}
      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 shadow-xl"
          style={{
            left: Math.min(Math.max(xFor(active!), 44), width - 44),
            top: 0,
          }}
        >
          <p className="text-[11px] font-semibold text-white whitespace-nowrap">
            {formatValue(activePoint.value)}
            {unit ? <span className="text-zinc-400 font-normal"> {unit}</span> : null}
          </p>
          <p className="text-[10px] text-zinc-400 whitespace-nowrap">{activePoint.fullLabel}</p>
        </div>
      )}
    </div>
  )
}
