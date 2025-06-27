"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import * as Diff from "diff";

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged" | "modified";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  parts?: DiffPart[];
}

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  className?: string;
}

export default function DiffViewer({
  oldContent,
  newContent,
  className,
}: DiffViewerProps) {
  const diffLines = useMemo(() => {
    return computeDiff(oldContent, newContent);
  }, [oldContent, newContent]);

  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {/* Diff Content */}
      <div className="font-mono text-xs">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              line.type === "added" && "bg-green-50",
              line.type === "removed" && "bg-red-50",
              line.type === "modified" && "bg-yellow-50",
              line.type === "unchanged" && "bg-white"
            )}
          >
            {/* Line Numbers */}
            <div className="flex">
              <div className="w-10 px-2 py-1 text-right text-gray-400 border-r bg-gray-50 select-none">
                {line.oldLineNumber || ""}
              </div>
              <div className="w-10 px-2 py-1 text-right text-gray-400 border-r bg-gray-50 select-none">
                {line.newLineNumber || ""}
              </div>
            </div>

            {/* Diff Indicator */}
            <div className="w-8 px-2 py-1 text-center select-none">
              {line.type === "added" && (
                <span className="text-green-600 font-bold">+</span>
              )}
              {line.type === "removed" && (
                <span className="text-red-600 font-bold">-</span>
              )}
              {line.type === "modified" && (
                <span className="text-yellow-600 font-bold">~</span>
              )}
              {line.type === "unchanged" && (
                <span className="text-gray-400"> </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
              {line.type === "modified" && line.parts ? (
                <span>
                  {line.parts.map((part, partIndex) => (
                    <span
                      key={partIndex}
                      className={cn(
                        part.added && "bg-green-200 text-green-800",
                        part.removed && "bg-red-200 text-red-800 line-through",
                        !part.added && !part.removed && "text-gray-900"
                      )}
                    >
                      {part.value}
                    </span>
                  ))}
                </span>
              ) : (
                <span
                  className={cn(
                    line.type === "added" && "text-green-800",
                    line.type === "removed" && "text-red-800",
                    line.type === "unchanged" && "text-gray-900"
                  )}
                >
                  {line.content || " "}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const result: DiffLine[] = [];

  // Use diff package for line-level comparison first
  const lineDiff = Diff.diffLines(oldContent, newContent);

  let oldLineNumber = 1;
  let newLineNumber = 1;

  for (const change of lineDiff) {
    const lines = change.value.split("\n");
    // Remove the last empty line if it exists (from split)
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    if (change.added) {
      // Added lines
      for (const line of lines) {
        result.push({
          type: "added",
          content: line,
          newLineNumber: newLineNumber++,
        });
      }
    } else if (change.removed) {
      // Removed lines
      for (const line of lines) {
        result.push({
          type: "removed",
          content: line,
          oldLineNumber: oldLineNumber++,
        });
      }
    } else {
      // Unchanged lines
      for (const line of lines) {
        result.push({
          type: "unchanged",
          content: line,
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
        });
      }
    }
  }

  // Now enhance with character-level diffing for better precision
  return enhanceWithCharacterDiff(result);
}

function enhanceWithCharacterDiff(diffLines: DiffLine[]): DiffLine[] {
  // Look for adjacent removed/added pairs that might be modifications
  const final: DiffLine[] = [];
  let i = 0;

  while (i < diffLines.length) {
    const current = diffLines[i];
    const next = diffLines[i + 1];

    if (
      current?.type === "removed" &&
      next?.type === "added" &&
      current.oldLineNumber &&
      next.newLineNumber
    ) {
      // This is likely a modified line - do character-level diff
      const charDiff = Diff.diffChars(current.content, next.content);

      final.push({
        type: "modified",
        content: current.content,
        oldLineNumber: current.oldLineNumber,
        newLineNumber: next.newLineNumber,
        parts: charDiff,
      });

      i += 2; // Skip both lines
    } else {
      final.push(current);
      i++;
    }
  }

  return final;
}
