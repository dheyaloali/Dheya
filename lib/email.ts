import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailOptions): Promise<boolean> {
  try {
    // Get email configuration from environment variables
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const from = emailUser || 'noreply@employeemanagementsystem.com';

    // Create a test account if no email configuration is provided (for development)
    if (!emailUser || !emailPass) {
      console.log('No email configuration found, using test account');
      const testAccount = await nodemailer.createTestAccount();
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      // Log the test email URL (for development)
      console.log('Test email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
      return true;
    }

    // Create transporter with Gmail configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // Send the email
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
} 