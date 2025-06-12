"use client";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useEffect, useRef } from "react";

import TaskNavbar from "./_components/navbar";
import MessageInput from "./_components/message-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchRealtimeSubscriptionToken } from "@/app/actions/inngest";
import { useTaskStore } from "@/stores/tasks";
import { Terminal } from "lucide-react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Markdown } from "@/components/markdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  id: string;
}

export default function TaskClientPage({ id }: Props) {
  const { getTaskById, updateTask } = useTaskStore();
  const task = getTaskById(id);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Function to get the output message for a given shell call message
  const getOutputForCall = (callId: string) => {
    return task?.messages.find(
      (message) =>
        message.type === "local_shell_call_output" &&
        message.data?.call_id === callId
    );
  };

  const { latestData } = useInngestSubscription({
    refreshToken: fetchRealtimeSubscriptionToken,
    bufferInterval: 0,
    enabled: true,
  });

  useEffect(() => {
    if (latestData?.channel === "tasks" && latestData.topic === "update") {
      console.log(latestData.data);
    }
  }, [latestData]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [task?.messages]);

  useEffect(() => {
    if (task) {
      updateTask(task.id, {
        hasChanges: false,
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <TaskNavbar id={id} />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for chat messages */}
        <div className="w-150 border-r border-border bg-card flex flex-col relative">
          <ScrollArea className="flex-1 pb-[120px]">
            <div className="p-4 flex flex-col gap-y-4 h-[calc(100vh-200px)]">
              <div className="bg-muted rounded-xl px-4 py-3 text-right w-fit self-end">
                <p>{task?.title}</p>
              </div>
              {task?.messages
                .filter(
                  (message) =>
                    (message.role === "assistant" || message.role === "user") &&
                    message.type === "message"
                )

                .map((message) => {
                  return (
                    <div
                      key={message.data?.id as string}
                      className="mt-4 flex-wrap flex flex-col"
                    >
                      {message.role === "assistant" && (
                        <Markdown
                          repoUrl={
                            task?.repository
                              ? `https://github.com/${task.repository}`
                              : undefined
                          }
                          branch={task?.branch}
                        >
                          {message.data?.text as string}
                        </Markdown>
                      )}
                      {message.role === "user" && (
                        <div className="bg-muted rounded-xl px-4 py-3 text-right self-end w-fit">
                          <p>{message.data?.text as string}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              {task?.status === "IN_PROGRESS" && (
                <div className="flex items-start gap-x-2 mt-4">
                  <Terminal className="size-4 text-muted-foreground" />
                  <p className="-mt-1">
                    <TextShimmer>
                      {task?.statusMessage
                        ? `${task.statusMessage}...`
                        : "Working on task..."}
                    </TextShimmer>
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message input component */}
          <MessageInput task={task!} />
        </div>

        {/* Right panel for details */}
        <div className="flex-1 bg-muted relative">
          {/* Fade overlay at the top */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-muted to-transparent pointer-events-none z-10" />
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="max-w-3xl mx-auto w-full py-10">
              {/* Details content will go here */}
              <div className="flex flex-col gap-y-10">
                {task?.messages.map((message) => {
                  if (message.type === "local_shell_call") {
                    const output = getOutputForCall(
                      message.data?.call_id as string
                    );
                    return (
                      <div
                        key={message.data?.call_id as string}
                        className="flex flex-col"
                      >
                        <div className="flex items-start gap-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="font-medium font-mono text-sm -mt-1 truncate max-w-md cursor-help">
                                  {(
                                    message.data as {
                                      action?: { command?: string[] };
                                    }
                                  )?.action?.command
                                    ?.slice(1)
                                    .join(" ")}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-sm break-words">
                                  {(
                                    message.data as {
                                      action?: { command?: string[] };
                                    }
                                  )?.action?.command
                                    ?.slice(1)
                                    .join(" ")}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {output && (
                          <div className="mt-2">
                            <div className="rounded-md bg-background border">
                              <div className="flex items-center gap-2 bg-sidebar border-b p-4 py-2 rounded-t-lg">
                                <Terminal className="size-4 text-muted-foreground" />
                                <span className="font-medium text-sm">
                                  shell
                                </span>
                              </div>
                              <ScrollArea>
                                <pre className="whitespace-pre-wrap leading-relaxed p-4 max-h-[300px] text-[13px]">
                                  {(() => {
                                    try {
                                      const parsed = JSON.parse(
                                        (output.data as { output?: string })
                                          ?.output || "{}"
                                      );
                                      return parsed.output || "No output";
                                    } catch {
                                      return "Failed to parse output";
                                    }
                                  })()}
                                </pre>
                              </ScrollArea>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
