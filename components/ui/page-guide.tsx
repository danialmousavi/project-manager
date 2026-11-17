"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Lightbulb, Sparkles, X } from "lucide-react";
import type { PageGuideContent } from "@/lib/page-guides";

export type { PageGuideContent, PageGuideFeature, PageGuideSection } from "@/lib/page-guides";

type Props = {
  guide: PageGuideContent;
  className?: string;
};

export default function PageGuide({ guide, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Lightbulb size={17} aria-hidden="true" />
        راهنمای صفحه
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 bg-gradient-to-l from-emerald-700 to-teal-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-50">
                  <Sparkles size={15} aria-hidden="true" />
                  راهنمای استفاده
                </p>
                <h2 id={titleId} className="mt-1 text-lg font-extrabold">
                  {guide.title}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm leading-6 text-emerald-50">
                  {guide.summary}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="shrink-0 rounded-xl p-2 text-emerald-50 hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="بستن راهنما"
              >
                <X size={20} />
              </button>
            </header>

            <div className="space-y-3 p-5">
              {guide.sections.map((section, sectionIndex) => (
                <section key={section.title}>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {section.title}
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {section.features.map((feature, featureIndex) => (
                      <li
                        key={`${feature.title}-${featureIndex}`}
                        className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-800">
                          {(guide.sections
                            .slice(0, sectionIndex)
                            .reduce((total, previous) => total + previous.features.length, 0) + featureIndex + 1)
                            .toLocaleString("fa-IR")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              {feature.title}
                            </h4>
                            {feature.badge && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                                {feature.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-6 text-slate-600">
                            {feature.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}

              {guide.tip && (
                <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-950">
                  <strong>نکته: </strong>
                  {guide.tip}
                </aside>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
