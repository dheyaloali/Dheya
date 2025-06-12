"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function AttendanceChart() {
  const [data, setData] = useState<{ date: string; attendance: number }[]>([])
  useEffect(() => {
    fetch("/api/admin/dashboard/attendance/daily")
      .then((res) => res.json())
      .then((days) => {
        setData(days.map((d: any) => ({ date: `Day ${d.day}`, attendance: d.presentCount })))
      })
  }, [])
  return (
    data.length === 0 ? (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground text-lg">
        No attendance data for the current month.
      </div>
    ) : (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value, name) => [value, name === "attendance" ? "Present" : "Total Employees"]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Line type="monotone" strokeWidth={2} dataKey="attendance" stroke="#4f46e5" />
      </LineChart>
    </ResponsiveContainer>
    )
  )
}
