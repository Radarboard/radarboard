"use client";

import { useStore } from "@tanstack/react-store";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatActions, chatStore } from "./chat-store";

/**
 * Manages the chat drawer width with drag-to-resize and localStorage persistence.
 * Persisted width is backed by chatStore; isDragging is local transient state.
 */
export function useChatResize() {
  const width = useStore(chatStore, (s) => s.chatWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsDragging(true);
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging the left edge: moving left = wider, moving right = narrower
      const delta = startXRef.current - e.clientX;
      chatActions.setChatWidth(startWidthRef.current + delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return { width, setWidth: chatActions.setChatWidth, isDragging, handleDragStart };
}
