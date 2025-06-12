import nodemailer from 'nodemailer';

// Configure using environment variables for security
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS, // App password (not your Gmail password!)
  },
});

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials are not set in environment variables.');
  }
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
} 