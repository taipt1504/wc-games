CREATE TABLE "ScheduleJob" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunNote" TEXT,
    "updatedBy" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleJob_pkey" PRIMARY KEY ("key")
);

INSERT INTO "ScheduleJob" ("key","label","enabled","config","updatedAt") VALUES
    ('lock_betting',   'Lock betting',    true, '{"leadMinutes":0}',                                              now()),
    ('lineup',         'Lineup crawl',    true, '{"leadMinutes":15}',                                            now()),
    ('result_check',   'Result check',    true, '{"firstDelayMinutes":135,"recheckMinutes":30,"maxAttempts":8}', now()),
    ('livescore',      'Live score poll', true, '{"intervalSeconds":45}',                                        now()),
    ('scheduler_scan', 'Scheduler scan',  true, '{"rescanMinutes":60,"scanAheadHours":36,"scanBehindHours":6}',  now()),
    ('news',           'News publish',    true, '{"publishIntervalSeconds":60}',                                 now())
ON CONFLICT ("key") DO NOTHING;
