"use client";

import dynamic from "next/dynamic";
import type { AtlasInitialData } from "@/stores/atlas-store";
import { Skeleton } from "@/components/ui/skeleton";

const AtlasCanvas = dynamic(
  () => import("./atlas-canvas").then((mod) => mod.AtlasCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="px-6 py-8 md:px-10">
        <Skeleton className="h-[70vh] rounded-lg" />
      </div>
    ),
  },
);

export function AtlasClient({ initialData }: { initialData: AtlasInitialData }) {
  return <AtlasCanvas initialData={initialData} />;
}
