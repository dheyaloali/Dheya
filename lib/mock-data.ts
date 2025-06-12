import { v4 as uuidv4 } from "uuid"

// Types
export type UserRole = "Administrator" | "Manager" | "HR Specialist" | "Employee"
export type UserStatus = "Active" | "Inactive" | "On Leave"
export type AttendanceStatus = "Present" | "Late" | "Absent"
export type DocumentStatus = "Pending" | "Approved" | "Rejected"
export type PaymentStatus = "Pending" | "Paid" | "Cancelled"

// User interface
export interface User {
  id: string
  username: string
  email: string
  password: string // Plain text for demo purposes only
  name: string
  role: UserRole
  city?: string
  position?: string
  status: UserStatus
  joinDate?: Date
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

// Other interfaces
export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: Date
  checkIn?: string
  checkOut?: string
  status: AttendanceStatus
  workHours?: number
  notes?: string
}

export interface SalaryRecord {
  id: string
  employeeId: string
  employeeName: string
  month: string
  year: number
  baseSalary: number
  bonus: number
  deductions: number
  netSalary: number
  status: PaymentStatus
  paymentDate?: Date
}

export interface Document {
  id: string
  employeeId: string
  employeeName: string
  title: string
  documentType: string
  filePath: string
  fileSize?: number
  mimeType?: string
  description?: string
  status: DocumentStatus
  uploadDate: Date
  approvedBy?: string
  approvedDate?: Date
}

export interface Product {
  id: string
  name: string
  category?: string
  price: number
  stockLevel: number
  reorderThreshold?: number
}

export interface SalesRecord {
  id: string
  employeeId: string
  employeeName: string
  productId: string
  productName: string
  customerName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  saleDate: Date
  notes?: string
}

export interface SalesTarget {
  id: string
  employeeId: string
  month: number
  year: number
  targetAmount: number
}

// Admin credentials
export const ADMIN_EMAIL = "admin@example.com"
export const ADMIN_PASSWORD = "admin123"

// Demo users
export const demoUsers = [
  {
    id: "1",
    name: "Admin User",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    userType: "admin",
  },
  {
    id: "2",
    name: "John Worker",
    email: "worker@example.com",
    password: "worker123",
    userType: "worker",
  },
  {
    id: "3",
    name: "Jane Employee",
    email: "jane@example.com",
    password: "jane123",
    userType: "worker",
  },
]

// Mock data
const users: User[] = [
  {
    id: "101",
    username: "johndoe",
    email: "john.doe@example.com",
    password: "password123",
    name: "John Doe",
    role: "Employee",
    city: "New York",
    position: "Software Engineer",
    status: "Active",
    joinDate: new Date("2022-01-15"),
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "102",
    username: "janedoe",
    email: "jane.doe@example.com",
    password: "password456",
    name: "Jane Doe",
    role: "HR Specialist",
    city: "Los Angeles",
    position: "HR Manager",
    status: "Active",
    joinDate: new Date("2021-05-20"),
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "103",
    username: "peterjones",
    email: "peter.jones@example.com",
    password: "password789",
    name: "Peter Jones",
    role: "Manager",
    city: "Chicago",
    position: "Team Lead",
    status: "Active",
    joinDate: new Date("2020-11-01"),
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]
export const mockEmployees = users;

const attendanceRecords: AttendanceRecord[] = [
  {
    id: "201",
    employeeId: "101",
    employeeName: "John Doe",
    date: new Date("2023-01-01"),
    checkIn: "09:00",
    checkOut: "17:00",
    status: "Present",
    workHours: 8,
    notes: "Regular work day",
  },
  {
    id: "202",
    employeeId: "102",
    employeeName: "Jane Doe",
    date: new Date("2023-01-01"),
    checkIn: "09:30",
    checkOut: "17:30",
    status: "Present",
    workHours: 8,
    notes: "Regular work day",
  },
  {
    id: "203",
    employeeId: "103",
    employeeName: "Peter Jones",
    date: new Date("2023-01-01"),
    checkIn: "10:00",
    checkOut: "18:00",
    status: "Late",
    workHours: 8,
    notes: "Arrived late",
  },
  {
    id: "204",
    employeeId: "104",
    employeeName: "Absent Employee",
    date: new Date("2023-01-01"),
    checkIn: undefined,
    checkOut: undefined,
    status: "Absent",
    workHours: 0,
    notes: "Absent",
  },
]

const salaryRecords: SalaryRecord[] = [
  {
    id: "301",
    employeeId: "101",
    employeeName: "John Doe",
    month: "January",
    year: 2023,
    baseSalary: 60000,
    bonus: 5000,
    deductions: 1000,
    netSalary: 64000,
    status: "Paid",
    paymentDate: new Date("2023-01-31"),
  },
  {
    id: "302",
    employeeId: "102",
    employeeName: "Jane Doe",
    month: "January",
    year: 2023,
    baseSalary: 70000,
    bonus: 8000,
    deductions: 1200,
    netSalary: 76800,
    status: "Paid",
    paymentDate: new Date("2023-01-31"),
  },
]

const documents: Document[] = [
  {
    id: "401",
    employeeId: "101",
    employeeName: "John Doe",
    title: "Employment Contract",
    documentType: "Contract",
    filePath: "/documents/101/contract.pdf",
    fileSize: 2,
    mimeType: "application/pdf",
    description: "Employment contract for John Doe",
    status: "Approved",
    uploadDate: new Date("2022-01-15"),
    approvedBy: "Jane Doe",
    approvedDate: new Date("2022-01-16"),
  },
  {
    id: "402",
    employeeId: "102",
    employeeName: "Jane Doe",
    title: "Performance Review",
    documentType: "Review",
    filePath: "/documents/102/review.pdf",
    fileSize: 1.5,
    mimeType: "application/pdf",
    description: "Performance review for Jane Doe",
    status: "Pending",
    uploadDate: new Date("2023-02-01"),
  },
]

const products: Product[] = [
  {
    id: "501",
    name: "Laptop",
    category: "Electronics",
    price: 1200,
    stockLevel: 50,
    reorderThreshold: 10,
  },
  {
    id: "502",
    name: "Office Chair",
    category: "Furniture",
    price: 200,
    stockLevel: 100,
    reorderThreshold: 20,
  },
]
export const mockProducts = products;

const salesRecords: SalesRecord[] = [
  {
    id: "601",
    employeeId: "101",
    employeeName: "John Doe",
    productId: "501",
    productName: "Laptop",
    customerName: "Acme Corp",
    quantity: 2,
    unitPrice: 1200,
    totalAmount: 2400,
    saleDate: new Date("2023-01-15"),
    notes: "Bulk order",
  },
  {
    id: "602",
    employeeId: "102",
    employeeName: "Jane Doe",
    productId: "502",
    productName: "Office Chair",
    customerName: "Beta Inc",
    quantity: 5,
    unitPrice: 200,
    totalAmount: 1000,
    saleDate: new Date("2023-01-20"),
    notes: "Regular sale",
  },
]

const salesTargets: SalesTarget[] = [
  {
    id: "701",
    employeeId: "101",
    month: 1,
    year: 2023,
    targetAmount: 3000,
  },
  {
    id: "702",
    employeeId: "102",
    month: 1,
    year: 2023,
    targetAmount: 1500,
  },
]

// Mock API functions
export const mockApi = {
  // Login function
  login: async (email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const user = demoUsers.find((u) => u.email === email && u.password === password)

    if (!user) {
      throw new Error("Invalid credentials")
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType,
    }
  },

  // Register function
  register: async (name: string, email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check if email is already taken
    if (demoUsers.some((u) => u.email === email)) {
      throw new Error("Email already in use")
    }

    // In a real app, we would add the user to the database
    // For demo purposes, we'll just return success
    return {
      success: true,
      message: "User registered successfully",
    }
  },
  // Employee functions
  getEmployees: async (page = 1, pageSize = 10, filters = {}) => {
    const filteredUsers = [...users]

    // Apply filters
    if (filters) {
      // Filter implementation would go here
    }

    // Paginate
    const start = (page - 1) * pageSize
    const paginatedUsers = filteredUsers.slice(start, start + pageSize)

    return {
      employees: paginatedUsers,
      total: filteredUsers.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredUsers.length / pageSize),
    }
  },

  getEmployeeById: async (id: string) => {
    const user = users.find((u) => u.id === id)
    return user || null
  },

  // Attendance functions
  getAttendanceRecords: async (employeeId: string, startDate?: string, endDate?: string) => {
    let records = attendanceRecords.filter((r) => r.employeeId === employeeId)

    if (startDate) {
      const start = new Date(startDate)
      records = records.filter((r) => r.date >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      records = records.filter((r) => r.date <= end)
    }

    return records
  },

  createAttendanceRecord: async (record: Partial<AttendanceRecord>) => {
    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      employeeId: record.employeeId || "",
      employeeName: users.find((u) => u.id === record.employeeId)?.name || "",
      date: record.date || new Date(),
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      status: record.status || "Present",
      workHours: record.workHours,
      notes: record.notes,
    }

    attendanceRecords.push(newRecord)
    return newRecord
  },

  // Salary functions
  getSalaryRecords: async (employeeId: string, year?: number) => {
    let records = salaryRecords.filter((r) => r.employeeId === employeeId)

    if (year) {
      records = records.filter((r) => r.year === year)
    }

    return records
  },

  // Document functions
  getEmployeeDocuments: async (employeeId: string, status?: string) => {
    let docs = documents.filter((d) => d.employeeId === employeeId)

    if (status) {
      docs = docs.filter((d) => d.status === status)
    }

    return docs
  },

  // Sales functions
  getSalesRecords: async (page = 1, pageSize = 10, filters = {}) => {
    const filteredRecords = [...salesRecords]

    // Apply filters
    if (filters) {
      // Filter implementation would go here
    }

    // Paginate
    const start = (page - 1) * pageSize
    const paginatedRecords = filteredRecords.slice(start, start + pageSize)

    return {
      salesRecords: paginatedRecords,
      total: filteredRecords.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredRecords.length / pageSize),
    }
  },

  getProducts: async () => {
    return products
  },

  getSalesStatistics: async (employeeId: string, year: number, month?: number) => {
    let records = salesRecords.filter((r) => r.employeeId === employeeId)

    // Filter by year and month
    records = records.filter((r) => {
      const recordYear = r.saleDate.getFullYear()
      const recordMonth = r.saleDate.getMonth() + 1

      if (month) {
        return recordYear === year && recordMonth === month
      }
      return recordYear === year
    })

    // Calculate statistics
    const totalSales = records.reduce((sum, record) => sum + record.totalAmount, 0)
    const totalTransactions = records.length
    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0
    const largestSale = records.length > 0 ? Math.max(...records.map((r) => r.totalAmount)) : 0

    // Get product sales breakdown
    const productSales: any[] = []
    const productMap = new Map()

    records.forEach((record) => {
      const key = record.productId
      if (!productMap.has(key)) {
        productMap.set(key, {
          product_name: record.productName,
          quantity_sold: 0,
          total_amount: 0,
        })
      }

      const product = productMap.get(key)
      product.quantity_sold += record.quantity
      product.total_amount += record.totalAmount
    })

    productMap.forEach((value) => {
      productSales.push(value)
    })

    // Get target
    const target = salesTargets.find(
      (t) => t.employeeId === employeeId && t.year === year && (!month || t.month === month),
    )

    const targetAmount = target ? target.targetAmount : 0

    return {
      salesStats: {
        total_sales: totalSales,
        total_transactions: totalTransactions,
        average_sale: averageSale,
        largest_sale: largestSale,
      },
      productSales,
      targetAmount,
      targetAchievement: targetAmount > 0 ? (totalSales / targetAmount) * 100 : null,
    }
  },
}
