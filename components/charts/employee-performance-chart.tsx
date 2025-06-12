"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const data = [
  {
    name: "Jane Davis",
    performance: 92,
    sales: 95,
    attendance: 98,
  },
  {
    name: "Robert Miller",
    performance: 88,
    sales: 90,
    attendance: 95,
  },
  {
    name: "Sarah Chen",
    performance: 85,
    sales: 88,
    attendance: 92,
  },
  {
    name: "Michael Johnson",
    performance: 82,
    sales: 85,
    attendance: 90,
  },
  {
    name: "Alicia Lopez",
    performance: 80,
    sales: 82,
    attendance: 88,
  },
]

export function EmployeePerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(value) => [`${value}%`, ""]} />
        <Legend />
        <Bar dataKey="performance" name="Overall Performance" fill="#4f46e5" />
        <Bar dataKey="sales" name="Sales Performance" fill="#0ea5e9" />
        <Bar dataKey="attendance" name="Attendance Rate" fill="#10b981" />
      </BarChart>
    </ResponsiveContainer>
  )
}
