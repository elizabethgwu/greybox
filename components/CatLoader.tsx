"use client";

import { useEffect, useRef } from "react";

interface CatLoaderProps {
  isLoading: boolean;
  onComplete: () => void;
}

export default function CatLoader({ isLoading, onComplete }: CatLoaderProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (isLoading) return;
    onCompleteRef.current();
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://cdn.weasyl.com/static/media/b6/34/c8/b634c8a486a841c8c36d0fd86ddd78944744fbf9bdaf18111bd2f67c2dfaa8cc.gif"
        alt="Loading..."
        className="w-24 h-24 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
      <p className="text-xs font-mono tracking-wider text-[#555]">
        mapping code structure...
      </p>
    </div>
  );
}
