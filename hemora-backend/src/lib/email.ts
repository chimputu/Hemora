import nodemailer from "nodemailer";

// ── Configuration ──

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "noreply@hemora.zm";
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:8081";

// ── Transporter (lazy-initialized) ──

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn(
            "[Email] SMTP not configured. Emails will be logged to console instead. " +
            "Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to enable email sending."
        );
        // Create a test transporter that logs to console
        transporter = nodemailer.createTransport({
            jsonTransport: true,
        });
        return transporter;
    }

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    // Verify connection configuration
    transporter.verify((error: Error | null) => {
        if (error) {
            console.error("[Email] SMTP connection failed:", error.message);
        } else {
            console.log("[Email] SMTP connection verified successfully");
        }
    });

    return transporter;
}

// ── Send Email ──

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        const transport = getTransporter();

        const info = await transport.sendMail({
            from: `"HEMORA" <${smtpFrom}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || stripHtml(options.html),
        });

        // Log for debugging when using jsonTransport (dev mode)
        if (typeof info === "string") {
            console.log("[Email] (dev mode)", info);
        } else {
            console.log("[Email] Sent:", info.messageId);
        }

        return true;
    } catch (error: any) {
        console.error("[Email] Failed to send email:", error.message);
        return false;
    }
}

// ── Email Templates ──

export function passwordResetEmail(resetToken: string): { subject: string; html: string } {
    const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;

    return {
        subject: "Reset Your HEMORA Password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #c62828;">HEMORA Password Reset</h2>
                <p>You requested a password reset for your HEMORA account.</p>
                <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
                <div style="margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #c62828; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    HEMORA — AI-Based Blood Forecasting and Donor Mobilisation System
                </p>
            </div>
        `,
    };
}

export function emailVerificationEmail(verifyToken: string): { subject: string; html: string } {
    const verifyUrl = `${appBaseUrl}/verify-email?token=${verifyToken}`;

    return {
        subject: "Verify Your HEMORA Email",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #c62828;">Welcome to HEMORA</h2>
                <p>Thank you for registering with HEMORA. Please verify your email address to complete your registration.</p>
                <p>Click the button below to verify your email. This link will expire in 24 hours.</p>
                <div style="margin: 30px 0;">
                    <a href="${verifyUrl}" 
                       style="background-color: #c62828; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 4px; display: inline-block;">
                        Verify Email
                    </a>
                </div>
                <p>If you did not create this account, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    HEMORA — AI-Based Blood Forecasting and Donor Mobilisation System
                </p>
            </div>
        `,
    };
}

// ── Helpers ──

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ── Check if email is configured ──

export function isEmailConfigured(): boolean {
    return !!(smtpHost && smtpUser && smtpPass);
}
