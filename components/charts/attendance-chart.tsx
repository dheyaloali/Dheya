"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function AttendanceChart({ loading = false }: { loading?: boolean }) {
  const [data, setData] = useState<{ date: string; attendance: number }[]>([])
  useEffect(() => {
    if (!loading) {
      fetch("/api/admin/dashboard/attendance/daily")
        .then((res) => res.json())
        .then((days) => {
          setData(days.map((d: any) => ({ date: `Day ${d.day}`, attendance: d.presentCount })))
        })
    }
  }, [loading])

  // Skeleton data for loading state (e.g., 10 days, all zeros)
  const skeletonData = Array.from({ length: 10 }).map((_, i) => ({ date: `Day ${i + 1}`, attendance: 0 }))
  const chartData = loading ? skeletonData : data

  // If not loading and no data, show empty state
  if (!loading && data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground text-lg">
        No attendance data for the current month.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value, name) => [value, name === "attendance" ? "Present" : "Total Employees"]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Line
          type="monotone"
          strokeWidth={2}
          dataKey="attendance"
          stroke="#4f46e5"
          opacity={loading ? 0.3 : 1}
          isAnimationActive={!loading}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
