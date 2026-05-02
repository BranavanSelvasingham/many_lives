export interface ObjectiveTrailItem {
  id: string;
  title: string;
  detail?: string;
  progress?: string;
  timestamp?: string;
  done?: boolean;
}

export interface ObjectiveTrailProps {
  objectiveText: string;
  checklistItems: ObjectiveTrailItem[];
  completedItems: ObjectiveTrailItem[];
  objectiveUpdatedAt?: string;
  subtitle?: string;
  className?: string;
  emptyChecklistLabel?: string;
  emptyCompletedLabel?: string;
}

export function ObjectiveTrail({
  objectiveText,
  checklistItems,
  completedItems,
  objectiveUpdatedAt,
  subtitle,
  className,
  emptyChecklistLabel = "No active objective steps yet.",
  emptyCompletedLabel = "No accomplishments logged yet.",
}: ObjectiveTrailProps) {
  const completedCount =
    completedItems.length + checklistItems.filter((item) => item.done).length;
  const totalCount = checklistItems.length + completedItems.length;
  const completionLabel =
    totalCount > 0 ? `${completedCount}/${totalCount} ticks` : "Nothing tracked yet";

  return (
    <section
      className={`rounded-[28px] border border-[rgba(134,145,154,0.22)] bg-[linear-gradient(180deg,rgba(29,38,44,0.92)_0%,rgba(19,25,30,0.88)_100%)] px-5 py-5 shadow-[0_24px_72px_rgba(0,0,0,0.2)] sm:px-6 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(134,145,154,0.18)] pb-4">
        <div className="space-y-1">
          <div className="text-[0.76rem] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
            Objective Trail
          </div>
          <div className="text-[1.02rem] leading-6 text-[color:var(--text-main)]">
            Rowan&apos;s known objectives and what he has already pulled off.
          </div>
          {subtitle ? (
            <div className="max-w-[72ch] text-[0.88rem] leading-6 text-[color:var(--text-muted)]">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="rounded-full border border-[rgba(205,174,115,0.2)] bg-[rgba(205,174,115,0.08)] px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-[rgba(228,191,123,0.95)]">
          {completionLabel}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-[rgba(205,174,115,0.22)] bg-[rgba(205,174,115,0.07)] px-4 py-4 sm:px-5">
        <div className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(228,191,123,0.92)]">
          Current Objective
        </div>
        <div className="mt-2 text-[1rem] leading-7 font-medium text-[color:var(--text-main)] sm:text-[1.08rem]">
          {objectiveText}
        </div>
        {objectiveUpdatedAt ? (
          <div className="mt-2 text-[0.74rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
            Updated {formatObjectiveTimestamp(objectiveUpdatedAt)}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
        <div className="space-y-3">
          <SectionHeading
            label="Working Plan"
            detail="The live steps Rowan is working through."
          />

          {checklistItems.length > 0 ? (
            <div className="space-y-2.5">
              {checklistItems.map((item) => (
                <TrailRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text={emptyChecklistLabel} />
          )}
        </div>

        <details className="group rounded-[24px] border border-[rgba(134,145,154,0.2)] bg-[rgba(35,44,51,0.8)] px-4 py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <SectionHeading
                label="Accomplishments"
                detail="A short journal of completed objectives and useful turns."
              />
            </div>
            <div className="rounded-full border border-[rgba(134,145,154,0.18)] bg-[rgba(41,50,57,0.7)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)] transition group-open:bg-[rgba(205,174,115,0.1)] group-open:text-[rgba(228,191,123,0.92)]">
              Expand
            </div>
          </summary>

          <div className="mt-4 space-y-2.5">
            {completedItems.length > 0 ? (
              completedItems.map((item) => <TrailRow key={item.id} item={item} completed />)
            ) : (
              <EmptyState text={emptyCompletedLabel} />
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

function SectionHeading({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="text-[0.84rem] leading-6 text-[color:var(--text-muted)]">
        {detail}
      </div>
    </div>
  );
}

function TrailRow({
  item,
  completed = false,
}: {
  item: ObjectiveTrailItem;
  completed?: boolean;
}) {
  const isDone = completed || Boolean(item.done);

  return (
    <div
      className={`rounded-[22px] border px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)] ${
        isDone
          ? "border-[rgba(183,146,89,0.24)] bg-[rgba(183,146,89,0.08)]"
          : "border-[rgba(134,145,154,0.18)] bg-[rgba(24,31,37,0.82)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${
            isDone
              ? "border-[rgba(183,146,89,0.3)] bg-[rgba(183,146,89,0.14)] text-[rgba(228,191,123,0.95)]"
              : "border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.82)] text-[color:var(--text-main)]"
          }`}
        >
          {isDone ? "✓" : "•"}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={`text-[0.96rem] font-medium leading-6 ${
              isDone ? "text-[color:var(--text-main)]" : "text-[color:var(--text-main)]"
            }`}
          >
            {item.title}
          </div>

          {item.detail ? (
            <div className="mt-1 text-[0.84rem] leading-6 text-[color:var(--text-muted)]">
              {item.detail}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.progress ? (
              <span className="rounded-full border border-[rgba(134,145,154,0.16)] bg-[rgba(41,50,57,0.68)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                {item.progress}
              </span>
            ) : null}
            {item.timestamp ? (
              <span className="text-[0.66rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                {formatObjectiveTimestamp(item.timestamp)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[rgba(117,128,137,0.22)] px-4 py-4 text-[0.88rem] leading-6 text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function formatObjectiveTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}
