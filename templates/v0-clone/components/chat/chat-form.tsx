"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";

type FormData = {
  message: string;
};

interface ChatFormProps {
  onSubmit: (message: string) => void | Promise<void>;
}

export default function ChatForm({ onSubmit }: ChatFormProps) {
  const { register, handleSubmit, reset, watch, formState } = useForm<FormData>(
    {
      defaultValues: {
        message: "",
      },
    }
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const messageValue = watch("message");
  const isMessageEmpty = !messageValue || messageValue.trim().length === 0;
  const { isSubmitting } = formState;

  // Combine both loading states
  const isFormSubmitting = isSubmitting || isLoading;

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isMessageEmpty && !isFormSubmitting) {
        handleSubmit(handleFormSubmit)();
      }
    }
  };

  const handleFormSubmit = async (data: FormData) => {
    if (!data.message.trim()) return;

    setIsLoading(true);
    try {
      await onSubmit(data.message.trim());
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
    }
  }, []);

  // Combine register with ref
  const { ref, ...registerProps } = register("message", { required: true });

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="rounded-lg border p-4 flex flex-col justify-between bg-background"
    >
      <textarea
        {...registerProps}
        ref={(e) => {
          ref(e);
          textareaRef.current = e;
        }}
        className="w-full resize-none focus:outline-none text-sm min-h-14 overflow-hidden"
        placeholder="Ask vibe0 to build..."
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={isFormSubmitting}
      />
      <Button
        size="icon"
        className="ml-auto size-8"
        type="submit"
        disabled={isMessageEmpty || isFormSubmitting}
      >
        {isFormSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUp className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
