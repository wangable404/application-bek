const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log("Ошибка соединения с почтой:", error);
  } else {
    console.log("Соединение с почтой успешно:", success);
  }
});


const sendVerificationMail = async (to, code) => {
  try {
    const info = await transporter.sendMail({
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
    console.log("Email отправлен:", info.response);
  } catch (err) {
    console.log("Ошибка отправки email:", err);
  }
};

module.exports = { sendVerificationMail };
