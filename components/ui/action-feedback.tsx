
"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";

function getDefaultMessage(method: string) {
  switch (method) {
    case "POST":
      return "اطلاعات با موفقیت ثبت شد.";
    case "PATCH":
    case "PUT":
      return "تغییرات با موفقیت ذخیره شد.";
    case "DELETE":
      return "عملیات حذف با موفقیت انجام شد.";
    default:
      return "عملیات انجام شد.";
  }
}

export default function ActionFeedback() {
  useEffect(() => {
    const originalFetch = window.fetch;

    const wrappedFetch: typeof window.fetch = async (
      input,
      init
    ) => {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      const urlString =
        input instanceof Request
          ? input.url
          : String(input);

      const url = new URL(urlString, window.location.origin);

      const shouldNotify =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/v1/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      if (!shouldNotify) {
        return originalFetch(input, init);
      }

      try {
        const response = await originalFetch(input, init);

        let payload: {
          message?: unknown;
          success?: unknown;
        } = {};

        try {
          payload = await response.clone().json();
        } catch {
          // The request may return an empty body.
        }

        const message =
          typeof payload.message === "string"
            ? payload.message
            : response.ok
              ? getDefaultMessage(method)
              : "عملیات انجام نشد. دوباره تلاش کنید.";

        if (response.ok && payload.success !== false) {
          toast.success(message, {
            duration: 3500,
          });
        } else {
          toast.error(message, {
            duration: 5000,
          });
        }

        return response;
      } catch (error) {
        if (
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          toast.error("ارتباط با سرور برقرار نشد.", {
            duration: 5000,
          });
        }

        throw error;
      }
    };

    window.fetch = wrappedFetch;

    return () => {
      // Restore the original fetch when this provider unmounts.
      if (window.fetch === wrappedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return (
    <Toaster
      position="top-center"
      dir="rtl"
      richColors
      closeButton
      visibleToasts={4}
      gap={12}
      duration={3500}
      toastOptions={{
        style: {
          fontFamily: "inherit",
          borderRadius: "14px",
          padding: "14px 16px",
          direction: "rtl",
          textAlign: "right",
        },
      }}
    />
  );
}
