import type { Metadata } from "next";
import GuidelinesContent from "@/components/GuidelinesContent";

export const metadata: Metadata = {
  title: "Advertising Guidelines",
  description: "Banner specs and content rules for advertising on BoatyardJobs.",
};

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">Advertising guidelines</h1>
      <div className="mt-3">
        <GuidelinesContent />
      </div>
    </div>
  );
}
