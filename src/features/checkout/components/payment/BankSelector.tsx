// src/features/checkout/components/payment/BankSelector.tsx

import { BankMethodCard } from "./BankMethodCard";

interface BankSelectorProps {
  methods: any[];
  selectedProviderCode: string | null;
  onSelect: (code: string) => void;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
  sym: string;
  total: string;
}

export function BankSelector({
  methods,
  selectedProviderCode,
  onSelect,
  onCopy,
  copiedField,
  sym,
  total,
}: BankSelectorProps) {
  if (methods.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground px-1">
        Send payment via
      </p>
      {methods.map((method: any) => {
        const code = method.provider_code ?? method.providerCode;
        return (
          <BankMethodCard
            key={code}
            method={method}
            isSelected={code === selectedProviderCode}
            onSelect={() => onSelect(code)}
            onCopy={onCopy}
            copiedField={copiedField}
            sym={sym}
            total={total}
          />
        );
      })}
    </div>
  );
}