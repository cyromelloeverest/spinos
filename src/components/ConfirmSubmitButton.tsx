"use client";

// Botão de submit que pede confirmação antes de enviar o <form> pai.
export function ConfirmSubmitButton({ message, children, style }: { message: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
      style={style}
    >
      {children}
    </button>
  );
}
