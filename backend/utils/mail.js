import nodemailer from 'nodemailer';

export async function sendMailWithFallback(mailOptions) {
  try {
    // Si no hay destinatario y estamos en producción no enviar
    if (!mailOptions.to) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('No hay destinatario en mailOptions y estamos en production; no se enviará correo.');
        return null;
      }
      const testAccount = await nodemailer.createTestAccount();
      const ethTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const sendOpts = { ...mailOptions, to: testAccount.user };
      const info = await ethTransporter.sendMail(sendOpts);
      console.log('No había destinatarios; enviado a Ethereal. Preview URL:', nodemailer.getTestMessageUrl(info));
      console.log('Ethereal creds (solo depuración):', testAccount);
      return { info, provider: 'ethereal', preview: nodemailer.getTestMessageUrl(info), testAccount };
    }

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
      try {
        await transporter.verify();
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado vía SMTP:', info && (info.messageId || info.response));
        return { info, provider: 'smtp' };
      } catch (smtpErr) {
        console.error('Error enviando vía SMTP:', smtpErr && smtpErr.message ? smtpErr.message : smtpErr);
        if (process.env.NODE_ENV !== 'production') {
          const testAccount = await nodemailer.createTestAccount();
          const ethTransporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
          const info = await ethTransporter.sendMail(mailOptions);
          const preview = nodemailer.getTestMessageUrl(info);
          console.log('SMTP falló — enviado con Ethereal para depuración. Preview URL:', preview);
          console.log('Ethereal creds (solo depuración):', testAccount);
          return { info, provider: 'ethereal', preview, testAccount };
        }
        return null;
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      const testAccount = await nodemailer.createTestAccount();
      const ethTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await ethTransporter.sendMail(mailOptions);
      console.log('SMTP no configurado; enviado con Ethereal. Preview URL:', nodemailer.getTestMessageUrl(info));
      console.log('Ethereal creds (solo depuración):', testAccount);
      return { info, provider: 'ethereal', preview: nodemailer.getTestMessageUrl(info), testAccount };
    }

    console.warn('No hay SMTP configurado y estamos en producción; no se envió correo.');
    return null;
  } catch (err) {
    console.error('Error en sendMailWithFallback:', err && err.message ? err.message : err);
    return null;
  }
}
