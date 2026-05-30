"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { EventsSection } from "../events";

export function ClientIssuesSection() {
  const [preset, setPreset] = useQueryState("eventsView", parseAsString);

  useEffect(() => {
    if (preset !== "client-issues") {
      setPreset("client-issues");
    }
  }, [preset, setPreset]);

  return <EventsSection />;
}
