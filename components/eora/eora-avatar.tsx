"use client";

import React from "react";
import Image from "next/image";
import { EoraPose, getEoraAsset } from "@/lib/eora/avatar-registry";

export interface EoraAvatarProps {
  pose?: EoraPose;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function EoraAvatar({
  pose = "welcome-hand",
  alt,
  width = 500,
  height = 625,
  className = "",
  priority = false,
  onClick,
  style,
}: EoraAvatarProps) {
  const asset = getEoraAsset(pose);

  return (
    <Image
      src={asset.src}
      alt={alt || asset.alt}
      width={width}
      height={height}
      className={`object-contain select-none transition-transform duration-300 ${className}`}
      priority={priority}
      onClick={onClick}
      style={style}
    />
  );
}
