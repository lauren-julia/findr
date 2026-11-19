const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

function resolveInlineItemImage(imageUrl, itemName) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { imageHtml: '', attachments: [] };
  }

  let src = '';
  const attachments = [];

  if (/^https?:\/\//i.test(imageUrl)) {
    src = imageUrl;
  } else if (imageUrl.startsWith('/api/uploads/')) {
    const relPath = imageUrl.slice('/api/uploads/'.length).replace(/^\/+/, '');
    const filePath = path.resolve(UPLOADS_DIR, relPath);
    if (filePath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(filePath)) {
      attachments.push({
        filename: path.basename(filePath),
        path: filePath,
        cid: 'item-photo'
      });
      src = 'cid:item-photo';
    }
  }

  if (!src) {
    return { imageHtml: '', attachments: [] };
  }

  const imageHtml = `
    <div style="margin: 0 0 14px; text-align: center;">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(itemName || 'Item photo')}" style="display: block; width: 100%; max-height: 220px; object-fit: cover; border-radius: 10px; border: 1px solid #eae7e2;" />
    </div>
  `;
  return { imageHtml, attachments };
}

const emailPort = Number(process.env.EMAIL_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: emailPort === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFirstName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return parts.slice(0, -1).join(' ');
}

function renderEmailLayout({ badge, title, bodyHtml, footerNote }) {
  return `
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <div style="margin: 0; padding: 32px 16px; background-color: #faf9f6; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eae7e2; border-radius: 15px; overflow: hidden;">
        <tr>
          <td style="background-color: #006b22; padding: 20px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">Findr.</span>
                  <span style="display: block; font-size: 11px; color: #d1fae5; margin-top: 2px;">USC DCISM</span>
                </td>
                ${badge ? `<td align="right"><span style="display: inline-block; padding: 5px 12px; border-radius: 20px; background-color: rgba(255,255,255,0.16); color: #ffffff; font-size: 11px; font-weight: 700;">${escapeHtml(badge)}</span></td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px;">
            <h2 style="margin: 0 0 14px; font-size: 20px; font-weight: 800; color: #111827;">${escapeHtml(title)}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 28px; background-color: #faf9f6; border-top: 1px solid #eae7e2; font-size: 12px; color: #6b7280; line-height: 1.5;">
            ${footerNote || 'This is an automated message from Findr. Please do not reply directly unless specified.'}
          </td>
        </tr>
      </table>
    </div>
  `;
}

exports.sendVerificationEmail = async (toEmail, fullName, token) => {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
  const verificationUrl = `${publicUrl}/api/auth/verify?token=${token}`;
  const fromAddress = process.env.EMAIL_USER
    ? `"Findr Support" <${process.env.EMAIL_USER}>`
    : '"Findr Support" <no-reply@findr.usc.edu.ph>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Verify Your Findr Account',
    html: renderEmailLayout({
      badge: 'Account Verification',
      title: `Welcome to Findr, ${escapeHtml(getFirstName(fullName))}!`,
      bodyHtml: `
        <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #374151;">
          Thank you for registering with your <strong>@usc.edu.ph</strong> email address. Click the button below to verify your account and get started:
        </p>
        <p style="margin: 24px 0 8px; text-align: center;">
          <a href="${verificationUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
            Verify Account
          </a>
        </p>
      `,
      footerNote: 'This verification link will expire in 24 hours.'
    })
  };

  await transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (toEmail, fullName, token) => {
  const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${frontendBase}/#/reset-password?token=${token}`;
  const fromAddress = process.env.EMAIL_USER
    ? `"Findr Support" <${process.env.EMAIL_USER}>`
    : '"Findr Support" <no-reply@findr.usc.edu.ph>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Reset Your Findr Password',
    html: renderEmailLayout({
      badge: 'Password Reset',
      title: 'Reset Your Password',
      bodyHtml: `
        <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #374151;">
          Hi ${escapeHtml(getFirstName(fullName))}, we received a request to reset your Findr password.
        </p>
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #374151;">
          Click the button below to choose a new password:
        </p>
        <p style="margin: 24px 0 8px; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
            Reset Password
          </a>
        </p>
      `,
      footerNote: 'This password reset link will expire in 30 minutes. If you did not request this, you can safely ignore this email.'
    })
  };

  await transporter.sendMail(mailOptions);
};

exports.sendLostFoundClaimEmail = async ({
  toEmail,
  posterName,
  itemName,
  imageUrl,
  postType,
  categoryName,
  campusCode,
  location,
  dateEvent,
  claimType,
  claimantName,
  claimantEmail,
  note
}) => {
  const fromAddress = process.env.EMAIL_USER
    ? `"Findr Lost & Found" <${process.env.EMAIL_USER}>`
    : '"Findr Lost & Found" <no-reply@findr.usc.edu.ph>';

  const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const requestsUrl = `${frontendBase}/#/lost-and-found/requests`;

  const isFound = postType === 'Found';
  const typeBg = isFound ? '#eaf5ec' : '#fff3d9';
  const typeColor = isFound ? '#086322' : '#8a5900';
  const { imageHtml, attachments } = resolveInlineItemImage(imageUrl, itemName);

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: `[Findr] New "${claimType}" claim for ${itemName}`,
    attachments,
    html: renderEmailLayout({
      badge: 'Lost & Found',
      title: 'New Claim Submitted',
      bodyHtml: `
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #374151;">
          Hi ${escapeHtml(getFirstName(posterName))}, a fellow Carolinian submitted ${claimType === 'I Found This' ? 'an' : 'a'} <strong>${escapeHtml(claimType)}</strong> claim on your post.
        </p>
        <div style="background-color: #faf9f6; border: 1px solid #eae7e2; border-radius: 12px; padding: 18px 20px; margin: 18px 0;">
          <div style="margin-bottom: 12px;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; background-color: ${typeBg}; color: ${typeColor}; font-size: 11px; font-weight: 800;">
              ${escapeHtml(postType)}
            </span>
          </div>
          ${imageHtml}
          <p style="margin: 0 0 12px; font-size: 17px; font-weight: 800; color: #111827; line-height: 1.4;">${escapeHtml(itemName)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Location:</strong> ${escapeHtml(location || 'Campus area')}, ${escapeHtml(campusCode)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Date ${isFound ? 'Found' : 'Lost'}:</strong> ${escapeHtml(dateEvent)}</p>
          <hr style="border: none; border-top: 1px solid #eae7e2; margin: 14px 0;" />
          <p style="margin: 8px 0; font-size: 13px; color: #374151; line-height: 1.65;"><strong>Claimant:</strong> ${escapeHtml(claimantName)} (${escapeHtml(claimantEmail)})</p>
          <p style="margin: 8px 0; font-size: 13px; color: #374151; line-height: 1.65;"><strong>Claim Type:</strong> ${escapeHtml(claimType)}</p>
          ${note ? `<p style="margin: 8px 0 0; font-size: 13px; color: #374151; line-height: 1.65;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
        </div>
        <p style="margin: 22px 0 12px;">
          <a href="${requestsUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
            View Claims
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #4b5563;">
          Review the details and approve/decline this claim in <strong>Lost &amp; Found &rarr; View Claims</strong>.
        </p>
      `,
      footerNote: 'You received this email because you posted a Lost & Found listing on Findr.'
    })
  };

  await transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (toEmail, fullName, token) => {
  const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${frontendBase}/#/reset-password?token=${token}`;
  const fromAddress = process.env.EMAIL_USER
    ? `"Findr Support" <${process.env.EMAIL_USER}>`
    : '"Findr Support" <no-reply@findr.usc.edu.ph>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Reset Your Findr Password',
    html: renderEmailLayout({
      badge: 'Password Reset',
      title: 'Reset Your Password',
      bodyHtml: `
        <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #374151;">
          Hi ${escapeHtml(getFirstName(fullName))}, we received a request to reset your Findr password.
        </p>
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #374151;">
          Click the button below to choose a new password:
        </p>
        <p style="margin: 24px 0 8px; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
            Reset Password
          </a>
        </p>
      `,
      footerNote: 'This password reset link will expire in 30 minutes. If you did not request this, you can safely ignore this email.'
    })
  };

  await transporter.sendMail(mailOptions);
};

exports.sendMarketplaceRequestEmail = async ({
  toEmail,
  sellerName,
  itemName,
  price,
  condition,
  imageUrl,
  categoryName,
  campusCode,
  buyerName,
  buyerEmail
}) => {
  const fromAddress = process.env.EMAIL_USER
    ? `"Findr Marketplace" <${process.env.EMAIL_USER}>`
    : '"Findr Marketplace" <no-reply@findr.usc.edu.ph>';

  const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const requestsUrl = `${frontendBase}/#/marketplace/requests`;
  const formattedPrice = `PHP ${Number(price).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  const { imageHtml, attachments } = resolveInlineItemImage(imageUrl, itemName);

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: `[Findr] New buy request for ${itemName}`,
    attachments,
    html: renderEmailLayout({
      badge: 'Marketplace',
      title: 'New Buy Request',
      bodyHtml: `
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #374151;">
          Hi ${escapeHtml(getFirstName(sellerName))}, a fellow Carolinian would like to buy one of your listings.
        </p>
        <div style="background-color: #faf9f6; border: 1px solid #eae7e2; border-radius: 12px; padding: 18px 20px; margin: 18px 0;">
          ${imageHtml}
          <p style="margin: 0 0 12px; font-size: 17px; font-weight: 800; color: #111827; line-height: 1.4;">${escapeHtml(itemName)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Price:</strong> ${escapeHtml(formattedPrice)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Condition:</strong> ${escapeHtml(condition)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Category:</strong> ${escapeHtml(categoryName)}</p>
          <p style="margin: 8px 0; font-size: 13px; color: #4b5563; line-height: 1.65;"><strong>Campus:</strong> ${escapeHtml(campusCode)}</p>
          <hr style="border: none; border-top: 1px solid #eae7e2; margin: 14px 0;" />
          <p style="margin: 8px 0; font-size: 13px; color: #374151; line-height: 1.65;"><strong>Buyer:</strong> ${escapeHtml(buyerName)} (${escapeHtml(buyerEmail)})</p>
        </div>
        <p style="margin: 22px 0 12px;">
          <a href="${requestsUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
            View Requests
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #4b5563;">
          Confirm or decline this request in <strong>Marketplace &rarr; View Requests</strong>. Payment and meet-up are arranged directly between you and the buyer.
        </p>
      `,
      footerNote: 'You received this email because you posted a Marketplace listing on Findr.'
    })
  };

  await transporter.sendMail(mailOptions);
};
