import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const uploadDir = path.join(process.cwd(), "public", "uploads");

export async function POST(request: Request) {
  // Ensure upload directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Generate a unique filename
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const fileName = `${timestamp}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  // Read the file as an ArrayBuffer and write to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(filePath, buffer);

  const fileUrl = `/uploads/${fileName}`;
  return NextResponse.json({ success: true, url: fileUrl });
} 