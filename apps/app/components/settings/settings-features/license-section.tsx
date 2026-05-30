"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { formatDate } from "@radarboard/utils/format-date-time";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface LicenseStatus {
  active: boolean;
  plan: string | null;
  email: string | null;
  expiresAt: number | null;
  error: string | null;
}

export function LicenseKeySection() {
  const effectiveLocale = useEffectiveLocale();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.license);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Ignore — license API may not be available
    }
  }, []);

  useEffect(() => {
    fetchStatus().catch(() => undefined);
  }, [fetchStatus]);

  const handleActivate = () => {
    if (!keyInput.trim()) return;
    setLoading(true);
    const run = async () => {
      try {
        const res = await fetch(API_ROUTES.license, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licenseKey: keyInput.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error("Invalid license key", { description: data.error });
          return;
        }
        toast.success("License activated", {
          description: `${data.plan} plan activated for ${data.email}`,
        });
        setKeyInput("");
        fetchStatus().catch(() => undefined);
      } catch {
        toast.error("Failed to activate license");
      } finally {
        setLoading(false);
      }
    };
    run().catch(() => undefined);
  };

  const handleRemove = () => {
    setLoading(true);
    const run = async () => {
      try {
        await fetch(API_ROUTES.license, { method: "DELETE" });
        toast.success("License removed");
        setStatus(null);
        fetchStatus().catch(() => undefined);
      } catch {
        toast.error("Failed to remove license");
      } finally {
        setLoading(false);
      }
    };
    run().catch(() => undefined);
  };

  const formatExpiry = (ts: number) => {
    const now = Math.floor(Date.now() / 1000);
    const yearsLeft = (ts - now) / (365.25 * 86400);
    if (yearsLeft > 50) return "Lifetime";
    return formatDate(ts * 1000, { locale: effectiveLocale }) ?? "";
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
          License
        </span>
      </div>

      {status?.active === true ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-foreground-secondary text-w-sm">
                  Active License
                </span>
                <Badge variant="success" size="xs">
                  {status.plan}
                </Badge>
              </div>
              <div className="mt-0.5 font-mono text-dim text-w-xs">
                {status.email}
                {status.expiresAt != null && (
                  <>
                    {" "}
                    ·{" "}
                    {formatExpiry(status.expiresAt) === "Lifetime"
                      ? "Lifetime"
                      : `Expires ${formatExpiry(status.expiresAt)}`}
                  </>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={loading}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-3">
          <div className="font-mono text-foreground-secondary text-w-sm">Activate License</div>
          <div className="mt-0.5 font-mono text-dim text-w-xs">
            Enter a license key to unlock pro features on this device.
          </div>
          {status?.error != null && (
            <div className="mt-1 font-mono text-destructive text-w-xs">{status.error}</div>
          )}
          <div className="mt-3 flex gap-2">
            <Input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your license key..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleActivate();
              }}
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleActivate}
              disabled={loading || !keyInput.trim()}
            >
              Activate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
