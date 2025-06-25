"use client";

import { Plus, Edit2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/sessions";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isSession = pathname.includes("/session");

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Extract session ID from pathname
  const sessionId = isSession ? pathname.split("/session/")[1] : null;

  // Session store
  const { getSessionById, updateSession } = useSessionStore();
  const session = sessionId ? getSessionById(sessionId) : null;

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const originalValue = useRef<string>("");

  // Set mounted after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus and select text when editing starts
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (session) {
      originalValue.current = session.name;
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (sessionId && editRef.current) {
      const newValue = editRef.current.textContent?.trim() || "";
      if (newValue && newValue !== originalValue.current) {
        updateSession(sessionId, { name: newValue });
      } else if (!newValue) {
        // Restore original value if empty
        editRef.current.textContent = originalValue.current;
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (editRef.current) {
        editRef.current.textContent = originalValue.current;
      }
      setIsEditing(false);
    }
  };

  return (
    <div className="flex justify-between items-center pt-2">
      <div className="flex items-center gap-x-2">
        <Link
          passHref
          href="/"
          className="hover:opacity-30 transition-all duration-300"
        >
          <Image src="/logo.svg" alt="vibe0" width={70} height={70} />
        </Link>
        {mounted && isSession && session && (
          <span className="ml-1 text-muted-foreground/40">/</span>
        )}
        {mounted && isSession && session && (
          <div className="flex items-center gap-x-2">
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-x-1 px-1 py-1 rounded-md hover:bg-muted transition-colors group cursor-pointer"
            >
              <span
                ref={editRef}
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`text-sm font-medium outline-none ${
                  isEditing ? "bg-muted rounded" : ""
                }`}
              >
                {session.name}
              </span>
              {!isEditing && (
                <Edit2 className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-x-2">
        {isHome && (
          <Button className="h-8">
            <Plus /> New session
          </Button>
        )}
        {isSession && <Button className="h-8">Publish</Button>}
      </div>
    </div>
  );
}
