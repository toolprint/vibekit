"use client";

import { ExternalLink, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import TVStatic from "../tv-static";
import { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Files from "./code";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Preview({ session }: { session?: Doc<"sessions"> }) {
  return (
    <div className="col-span-3 bg-muted rounded-lg border overflow-hidden flex flex-col">
      <Tabs defaultValue="preview" className="h-full gap-0">
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
            {session?.status === "RUNNING" || session?.status === "CUSTOM" ? (
              <iframe
                src={session.tunnelUrl}
                className="w-full h-full border-none"
              />
            ) : (
              <div className="max-w-xs rounded-lg h-[200px] mt-[30%] mx-auto w-full flex items-center justify-center">
                <TVStatic
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
