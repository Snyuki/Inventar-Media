import * as Dialog from "@radix-ui/react-dialog";
import { X, ScanBarcode, Keyboard } from "lucide-react";
import { PreferredInput } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  email: string | null;
  preferredInput: PreferredInput;
  onPreferredInputChange: (value: PreferredInput) => void;
}

export default function SettingsModal({
  open,
  onClose,
  email,
  preferredInput,
  onPreferredInputChange,
}: Props) {

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <Dialog.Content
            className="bg-card rounded-2xl shadow-xl w-full max-w-sm"
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-subtle">
              <Dialog.Title className="text-base font-semibold text-primary">
                Einstellungen
              </Dialog.Title>
              <Dialog.Close className="p-1 text-subtle hover:text-primary transition-colors">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Account */}
              <div>
                <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-2">
                  Account
                </p>
                <p className="text-sm text-primary">{email ?? "—"}</p>
              </div>

              <div className="border-t border-subtle" />

              {/* Input method -> only for logged-in users */}
              {email && (
                <div>
                  <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-3">
                    Standard Eingabemethode
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onPreferredInputChange("barcode_scanner")}
                      className={`flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors ${
                        preferredInput === "barcode_scanner"
                          ? "border-blue-600 bg-count-badge-bg text-count-badge-text"
                          : "border-default bg-fill text-secondary hover:bg-hover"
                      }`}
                    >
                      <ScanBarcode className="w-5 h-5" />
                      <span className="text-xs font-medium">Barcode Scanner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreferredInputChange("manual_input")}
                      className={`flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors ${
                        preferredInput === "manual_input"
                          ? "border-blue-600 bg-count-badge-bg text-count-badge-text"
                          : "border-default bg-fill text-secondary hover:bg-hover"
                      }`} 
                    >
                      <Keyboard className="w-5 h-5" />
                      <span className="text-xs font-medium">Manuelle Eingabe</span>
                    </button>
                  </div>
                  <p className="text-xs text-subtle mt-2">
                    Bestimmt wie der „Item hinzufügen" Dialog standardmäßig öffnet.
                  </p>
                </div>
              )}

            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}