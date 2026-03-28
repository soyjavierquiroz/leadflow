import {
  PublicEyebrow,
  PublicSectionSurface,
  cx,
  flatBlockTitleClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type FaqSocialProofItem = {
  question: string;
  answer: string;
};

type FaqSocialProofProps = {
  eyebrow?: string;
  title?: string;
  items?: FaqSocialProofItem[];
  variant?: "default" | "flat";
};

const defaultFaqSocialProofItems: FaqSocialProofItem[] = [
  {
    question: "¿Es un medicamento?",
    answer:
      "No se presenta como sustituto de un tratamiento medico. Se plantea como apoyo dentro de un protocolo, y cualquier decision clinica debe revisarse con un profesional de salud.",
  },
  {
    question: "¿Por que no lo sabia mi medico?",
    answer:
      "No todos los profesionales revisan las mismas fuentes al mismo tiempo. Algunas lineas de evidencia tardan en difundirse o no forman parte del protocolo habitual de cada consulta.",
  },
];

export function FaqSocialProof({
  eyebrow = "Objeciones frecuentes",
  title = "Lo que muchos preguntan antes de decidir",
  items = defaultFaqSocialProofItems,
  variant = "default",
}: FaqSocialProofProps) {
  const safeItems = items.filter(
    (item) => item.question.trim() && item.answer.trim(),
  );

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <PublicSectionSurface
      variant={variant}
      className={variant === "flat" ? "py-6 text-left md:py-8" : ""}
    >
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral" className="text-slate-400">{eyebrow}</PublicEyebrow>
        <h2 className={`mt-3 ${flatBlockTitleClassName}`}>
          {title}
        </h2>
      </div>
      <div className="mt-8 space-y-3">
        {safeItems.map((item) => (
          <details
            key={item.question}
            className={cx(
              "group",
              variant === "flat"
                ? "rounded-[1.4rem] border border-slate-800 bg-slate-900 px-5 py-5"
                : "rounded-[1.6rem] border border-slate-800 bg-slate-900 p-5",
            )}
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-slate-100">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.answer}</p>
          </details>
        ))}
      </div>
    </PublicSectionSurface>
  );
}
