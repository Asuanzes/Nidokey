"use client";

export function BookmarkletLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      draggable
      onClick={(e) => {
        e.preventDefault();
        alert("No hagas clic aquí: arrástralo a tu barra de marcadores.");
      }}
      className="inline-flex h-10 cursor-grab items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm hover:bg-primary-hover active:cursor-grabbing"
    >
      📥 Importar a BuySell
    </a>
  );
}

export function BookmarkletTextarea({ value }: { value: string }) {
  return (
    <textarea
      readOnly
      value={value}
      className="h-32 w-full rounded-md border border-border bg-bg p-3 font-mono text-[11px] text-text-muted"
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
