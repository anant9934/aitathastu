"use client";

/**
 * EORA SPEECH BUBBLE — VERSION 1.0
 * Compact, accessible speech bubble that sits above or beside the avatar.
 * Respects reduced-motion preferences.
 */

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface EoraSpeechBubbleProps {
  text: string;
  actionLabel?: string;
  actionUrl?: string;
  onActionClick?: (url: string) => void;
  onClose?: () => void;
  /** aria-live region priority */
  ariaLive?: "polite" | "assertive";
  className?: string;
  style?: React.CSSProperties;
  reducedMotion?: boolean;
}

export function EoraSpeechBubble({
  text,
  actionLabel,
  actionUrl,
  onActionClick,
  onClose,
  ariaLive = "polite",
  className = "",
  style,
  reducedMotion = false,
}: EoraSpeechBubbleProps) {
  const [visible, setVisible] = useState(false);
  const prevText = useRef(text);

  // Fade in when text changes
  useEffect(() => {
    if (text && text !== prevText.current) {
      prevText.current = text;
    }
    if (text) {
      // Small delay to allow CSS transition
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [text]);

  if (!text) return null;

  const handleActionClick = () => {
    if (onActionClick && actionUrl) {
      onActionClick(actionUrl);
    } else if (actionUrl) {
      window.location.assign(actionUrl);
    }
  };

  return (
    <div
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
      className={`eora-speech-bubble ${visible ? "eora-speech-bubble--visible" : ""} ${
        reducedMotion ? "eora-speech-bubble--no-motion" : ""
      } ${className}`}
      style={style}
    >
      {/* Close button */}
      {onClose && (
        <button
          type="button"
          className="eora-speech-bubble__close"
          onClick={onClose}
          aria-label="Dismiss EORA message"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}

      {/* Message text */}
      <p className="eora-speech-bubble__text">{text}</p>

      {/* Optional action */}
      {actionLabel && (
        <button
          type="button"
          className="eora-speech-bubble__action"
          onClick={handleActionClick}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
