import { sendAuthEmail } from "@leadflow/mail";

export const sendPasswordResetEmail = async (input: {
  resetUrl: string;
  toAddress: string;
}) => {
  await sendAuthEmail({
    toAddress: input.toAddress,
    subject: "Restablece tu contraseña de LeadFlow",
    title: "Restablece tu contraseña",
    paragraphs: [
      "Recibimos una solicitud para recuperar tu acceso a LeadFlow.",
      "Usa el enlace seguro para crear una nueva contraseña y volver a entrar a tu cuenta.",
    ],
    action: {
      label: "Crear nueva contraseña",
      href: input.resetUrl,
    },
    securityNote:
      "Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.",
  });
};
