const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendVerificationMail = async (to, code) => {
  await transporter.sendMail({
    from: `"Support" <${process.env.MAIL_USER}>`,
    to,
    subject: "Подтверждение почты",
    html: `
      <h2>Подтверждение email</h2>
      <p>Ваш код подтверждения:</p>
      <h1>${code}</h1>
      <p>Код действителен 10 минут</p>
    `,
  }); 
};

module.exports = { sendVerificationMail };
