"use client";

import Toolbar from "./toolbar";
import { useSessionStore } from "@/stores/sessions";
import { useParams } from "next/navigation";
import TVStatic from "../tv-static";

export default function Preview() {
  const params = useParams();
  const sessionId = params.id as string;
  const { getSessionById } = useSessionStore();
  const session = getSessionById(sessionId);

  return (
    <div className="col-span-3 bg-muted rounded-lg border overflow-hidden flex flex-col">
      <Toolbar />
      <div className="flex-1 overflow-hidden relative">
        {session && session.tunnelUrl ? (
          <iframe
            src={session.tunnelUrl}
            className="w-full h-full border-none"
          />
        ) : (
          <div className="max-w-xs rounded-lg h-[200px] mt-[30%] mx-auto w-full flex items-center justify-center">
            <TVStatic label="BOOTING MACHINE..." size="lg" />
          </div>
        )}
      </div>
    </div>
  );
}
