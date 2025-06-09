"use client";

import { useRef, useEffect, useState } from "react";

export default function TaskForm() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "100px"; // Reset to min height
      textarea.style.height = Math.max(100, textarea.scrollHeight) + "px";
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="p-0.5 rounded-lg bg-muted">
        <div className="flex flex-col gap-y-2 border bg-background rounded-lg p-4">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Create a new task to get started"
            className="w-full min-h-[100px] resize-none border-none p-0 focus:outline-none focus:border-transparent overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
