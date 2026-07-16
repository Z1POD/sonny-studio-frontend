// src/features/payment/components/BankMethodCard.tsx

import { DetailRow } from "./DetailRow";

interface BankMethodCardProps {
  method: any;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
  sym: string;
  total: string;
}

export function BankMethodCard({
  method,
  isSelected,
  onSelect,
  onCopy,
  copiedField,
  sym,
  total,
}: BankMethodCardProps) {
  const code = method.provider_code ?? method.providerCode;
  const name = method.provider_name ?? method.providerName;
  const logo = method.provider_logo ?? method.providerLogo;
  const acctName = method.account_name ?? method.accountName;
  const acctNum = method.account_number ?? method.accountNumber;
  const acctType = method.account_type ?? method.accountType;

  return (
    <button
      key={code}
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 p-4 transition ${
        isSelected
          ? "border-emerald-400/20 bg-primary/5"
          : "border-border bg-surface hover:border-border/60"
      }`}
    >
      <div className="flex items-center gap-3">
        {logo && (
          <img
            src={logo}
            alt={name}
            className="h-8 w-8 rounded-lg object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          {acctType && (
            <p className="text-xs text-muted-foreground">{acctType}</p>
          )}
        </div>
        <div
          className={`h-4 w-4 shrink-0 rounded-full border-2 transition ${
            isSelected
              ? "border-emerald-400/20 bg-primary"
              : "border-muted-foreground/30"
          }`}
        />
      </div>

      {isSelected && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          <DetailRow label="Account name" value={acctName} />
          <DetailRow
            label="Account number"
            value={acctNum}
            onCopy={() => onCopy(acctNum, "account")}
            copied={copiedField === "account"}
          />
          <DetailRow
            label="Amount to send"
            value={`${sym} ${total}`}
            onCopy={() => onCopy(total, "amount")}
            copied={copiedField === "amount"}
          />
        </div>
      )}
    </button>
  );
}
