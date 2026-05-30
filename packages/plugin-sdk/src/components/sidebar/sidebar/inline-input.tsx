"use client";

import { Input } from "@radarboard/ui/input";
import { useEffect, useRef } from "react";

export interface InlineEditInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
}

export function InlineEditInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
}: InlineEditInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="px-3 py-1">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onSubmit}
        placeholder={placeholder}
        size="sm"
        className="bg-secondary"
      />
    </div>
  );
}
