"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { Textarea } from "@radarboard/ui/textarea";
import type { WidgetAuthField } from "@radarboard/widget-engine/widgets/registry";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface CredentialFieldsProps {
  credKey: string;
  fields: WidgetAuthField[];
  values: Record<string, string>;
  onUpdateField: (key: string, value: string) => void;
}

export function CredentialFields({
  credKey,
  fields,
  values,
  onUpdateField,
}: CredentialFieldsProps) {
  const [visiblePasswordKeys, setVisiblePasswordKeys] = useState<Set<string>>(new Set());

  return (
    <>
      {fields.map((field) => {
        const fieldId = `cred-${credKey}-${field.key}`;
        const isPassword = field.type === "password";
        const isVisible = visiblePasswordKeys.has(field.key);

        return (
          <div key={field.key}>
            <Label htmlFor={fieldId}>{field.label}</Label>
            {field.type === "textarea" || field.type === "file" ? (
              <Textarea
                id={fieldId}
                className="min-h-[80px]"
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => onUpdateField(field.key, e.target.value)}
              />
            ) : (
              <div className="relative">
                <Input
                  id={fieldId}
                  type={isPassword ? (isVisible ? "text" : "password") : "text"}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => onUpdateField(field.key, e.target.value)}
                  className={isPassword ? "pr-10" : undefined}
                />
                {isPassword ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    uppercase={false}
                    onClick={() =>
                      setVisiblePasswordKeys((current) => {
                        const next = new Set(current);
                        if (next.has(field.key)) {
                          next.delete(field.key);
                        } else {
                          next.add(field.key);
                        }
                        return next;
                      })
                    }
                    className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0 text-dim hover:bg-transparent hover:text-foreground-secondary"
                    aria-label={isVisible ? `Hide ${field.label}` : `Show ${field.label}`}
                  >
                    {isVisible ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
                  </Button>
                ) : null}
              </div>
            )}
            {Boolean(field.helpText) && <p className="mt-1 text-dim text-w-sm">{field.helpText}</p>}
          </div>
        );
      })}
    </>
  );
}
