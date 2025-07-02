"use client";

import { ExternalLink, Maximize2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import BootingMachine from "../booting-machine";
import { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Files from "./code";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUrlAvailability } from "@/lib/hooks";

export default function Preview({ session }: { session?: Doc<"sessions"> }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [activeTab, setActiveTab] = useState("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const shouldCheckUrl = Boolean(
    session?.tunnelUrl &&
      (session?.status === "RUNNING" || session?.status === "CUSTOM")
  );

  const { isUrlReady, isChecking, checkUrl } = useUrlAvailability({
    url: session?.tunnelUrl,
    enabled: shouldCheckUrl && activeTab === "preview",
  });

  const shouldShowIframe =
    shouldCheckUrl && isUrlReady && activeTab === "preview";
  const shouldShowLoading =
    shouldCheckUrl && activeTab === "preview" && (!isUrlReady || isChecking);

  // Trigger URL check when switching to preview tab
  useEffect(() => {
    if (
      activeTab === "preview" &&
      shouldCheckUrl &&
      !isUrlReady &&
      !isChecking
    ) {
      checkUrl();
    }
  }, [activeTab, shouldCheckUrl, isUrlReady, isChecking, checkUrl]);

  return (
    <div className="w-full bg-muted rounded-lg border overflow-hidden flex flex-col">
      <Tabs
        defaultValue="preview"
        className="h-full gap-0"
        onValueChange={setActiveTab}
      >
        <div className="flex items-center p-2 border-b bg-background justify-between">
          {/* Left side - Home and Refresh */}
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          {/* Right side - New Window and Fullscreen */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <TabsContent value="preview" className="flex-1 h-full">
          <div className="flex-1 h-full overflow-hidden relative">
            {shouldShowIframe ? (
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={session?.tunnelUrl}
                className="w-full h-full border-none"
                onLoad={() => {
                  // Additional confirmation that iframe loaded successfully
                  if (!isUrlReady) {
                    checkUrl();
                  }
                }}
                onError={() => {
                  // If the main iframe fails to load, retry
                  setIframeKey((prev) => prev + 1);
                  setTimeout(() => {
                    if (session?.tunnelUrl) {
                      checkUrl();
                    }
                  }, 2000);
                }}
              />
            ) : shouldShowLoading ? (
              <div className="max-w-xs rounded-lg h-[200px] mt-[25%] mx-auto w-full flex gap-0 items-center justify-center">
                <BootingMachine
                  label={isChecking ? "GENERATING PREIVEW" : "WAITING FOR URL"}
                  size="lg"
                />
              </div>
            ) : (
              <div className="max-w-xs rounded-lg h-[200px] mt-[25%] mx-auto w-full flex items-center justify-center">
                <BootingMachine
                  label={
                    session?.status?.replace(/_/g, " ") ?? "BOOTING MACHINE..."
                  }
                  size="lg"
                />
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="code" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100%-0px)]">
            <Files session={session!} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
