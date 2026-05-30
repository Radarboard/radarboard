"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { X } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { ExpenseTag } from "../types";

interface TagInputProps {
  selectedTagIds: string[];
  allTags: ExpenseTag[];
  onAdd: (tagName: string) => void;
  onRemove: (tagId: string) => void;
}

export function TagInput({ selectedTagIds, allTags, onAdd, onRemove }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectedTags = useMemo(
    () =>
      selectedTagIds.map((id) => allTags.find((t) => t.id === id)).filter(Boolean) as ExpenseTag[],
    [selectedTagIds, allTags]
  );

  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const q = inputValue.toLowerCase();
    return allTags
      .filter((t) => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [inputValue, allTags, selectedTagIds]);

  const handleAdd = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      onAdd(name.trim());
      setInputValue("");
      setShowSuggestions(false);
    },
    [onAdd]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd(inputValue);
      }
    },
    [handleAdd, inputValue]
  );

  return (
    <div className="space-y-1.5">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-item bg-accent/10 px-1.5 py-0.5 text-accent text-w-sm"
            >
              {tag.name}
              <Button
                type="button"
                onClick={() => onRemove(tag.id)}
                variant="ghost"
                size="icon-xs"
                uppercase={false}
                className="h-auto w-auto text-accent hover:text-accent"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </span>
          ))}
        </div>
      )}

      {/* Input with suggestions */}
      <div className="relative">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          variant="ghost"
          size="default"
          className="w-full text-foreground-secondary text-sm"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 rounded-item border border-border bg-surface-raised">
            {suggestions.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAdd(tag.name);
                }}
                variant="ghost"
                uppercase={false}
                fullWidth
                className="h-auto justify-start px-2 py-1 text-left text-foreground-secondary text-sm"
              >
                {tag.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
