import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS setup to allow Render to call this endpoint
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, html, secret } = req.body;

  // Protect the endpoint so only our Render API can use it
  if (secret !== process.env.VERCEL_SMTP_SECRET && process.env.VERCEL_SMTP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized call' });
  }

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    return res.status(500).json({ error: 'SMTP credentials not configured on Vercel' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from: `MistriJi <${user}>`,
      to,
      subject,
      html
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Nodemailer Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
