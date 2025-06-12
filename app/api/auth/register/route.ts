import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ROLES } from "@/lib/auth";
import { isPasswordComplex, passwordComplexityMessage } from "@/lib/passwordUtils";
import path from "path";
import fs from "fs";
import { notifyUserOrEmployee } from "@/lib/notifications";
import { checkRateLimit } from '@/lib/rateLimiter';
import { validateFile } from '@/lib/validateFile';
import { sanitizeInput } from '@/lib/sanitizeInput';

// Function to verify reCAPTCHA token
async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error("reCAPTCHA secret key is not configured");
      return false;
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 registrations per hour per IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, { windowMs: 60 * 60 * 1000, max: 5 })) {
      return NextResponse.json({ success: false, message: "Too many registration attempts. Please try again later." }, { status: 429 });
    }
    // Parse multipart/form-data
    const formData = await req.formData();
    const name = sanitizeInput(formData.get("name")?.toString() || "");
    const email = sanitizeInput(formData.get("email")?.toString() || "");
    const password = formData.get("password")?.toString() || "";
    const city = sanitizeInput(formData.get("city")?.toString() || "");
    const phoneNumber = sanitizeInput(formData.get("phoneNumber")?.toString() || "");
    const picture = formData.get("picture") as File;
    const recaptchaToken = formData.get("recaptchaToken")?.toString() || "";
    const allowedCities = ["Jakarta", "Surabaya", "Bandung"];
    
    // Validate required fields
    if (!name || !email || !password || !city || !picture || !phoneNumber) {
      return NextResponse.json({ success: false, message: "missingFields" }, { status: 400 });
    }
    
    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json({ success: false, message: "recaptchaRequired" }, { status: 400 });
    }
    
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return NextResponse.json({ success: false, message: "recaptchaInvalid" }, { status: 400 });
    }
    
    // Validate phone number
    if (!/^\+?\d{8,15}$/.test(phoneNumber)) {
      return NextResponse.json({ success: false, message: "phoneInvalid" }, { status: 400 });
    }
    
    if (!allowedCities.includes(city)) {
      return NextResponse.json({ success: false, message: "invalidCity" }, { status: 400 });
    }
    
    // File validation
    const fileValidation = validateFile(picture, { allowedTypes: ["image/jpeg", "image/png", "image/webp"], maxSize: 2 * 1024 * 1024 });
    if (!fileValidation.valid) {
      return NextResponse.json({ success: false, message: fileValidation.message }, { status: 400 });
    }
    
    // Enforce password complexity
    if (!isPasswordComplex(password)) {
      return NextResponse.json({ success: false, message: "passwordRequirements" }, { status: 400 });
    }
    
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();
    
    // Prevent registration with reserved admin email
    if (normalizedEmail === process.env.ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "emailReserved" }, { status: 409 });
    }
    
    // Combine uniqueness check for email and name
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { name: { equals: name, mode: 'insensitive' } }
        ]
      }
    });
    
    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
      return NextResponse.json({ success: false, message: "emailTaken" }, { status: 409 });
    }
      if (existingUser.name && existingUser.name.toLowerCase() === name.toLowerCase()) {
      return NextResponse.json({ success: false, message: "nameTaken" }, { status: 409 });
      }
    }
    
    // Save the picture to /public/uploads (async)
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = (picture.name || "").split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    const arrayBuffer = await picture.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
    const pictureUrl = `/uploads/${fileName}`;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the user (role: employee, status: active)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phoneNumber,
        password: hashedPassword,
        role: "employee",
        isApproved: false,
        status: "active",
        employee: {
          create: {
            position: "New Employee",
            city,
          }
        }
      },
    });
    
    // Respond to the user first for faster UX
    const response = NextResponse.json({ success: true, message: "registrationSuccess" });
    // Send notifications asynchronously (fire-and-forget)
    (async () => {
      try {
    const now = new Date().toLocaleString();
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    if (admin) {
      await notifyUserOrEmployee({
        userId: admin.id,
        type: "admin_employee_registered",
            message: `A new employee registered: ${user.name} (${user.email}) on ${now}`,
        actionUrl: `/admin/employees/${user.employee?.id || ''}/details`,
        actionLabel: "Review Employee",
      });
    }
    await notifyUserOrEmployee({
      employeeId: user.employee?.id,
      type: "employee_registration_submitted",
          message: `Your registration was submitted and is pending approval on ${now}`,
      actionUrl: "/employee/profile",
      actionLabel: "View Status",
    });
      } catch (notifyError) {
        console.error("Notification error:", notifyError);
      }
    })();
    return response;
  } catch (error) {
    // Use a production logger in real deployments
    console.error("Registration error:", error);
    return NextResponse.json({ success: false, message: "registrationFailed" }, { status: 500 });
  }
} 