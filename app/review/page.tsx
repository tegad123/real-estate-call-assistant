import { Suspense } from "react";
import ReviewClient from "@/app/review/review-client";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div>Loading review page...</div>}>
      <ReviewClient />
    </Suspense>
  );
}
