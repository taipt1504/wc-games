import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@wc/db';
import { enrichAllLineups, isJobEnabled, recordJobRun } from '@wc/pipeline';
import { LlmGateway } from '../llm/llm-gateway';

/** LineupEnrichWorker — bulk LLM lineup enrichment for all teams, triggered on-demand by admin
 *  (ControlWorker → 'enrich_lineups'). Sequential LLM calls; runs in the background (not a request). */
@Injectable()
export class LineupEnrichWorker {
  private readonly log = new Logger(LineupEnrichWorker.name);
  private running = false;

  constructor(private readonly llm: LlmGateway) {}

  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'enrich_lineups'))) {
        await recordJobRun(prisma, 'enrich_lineups', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      const res = await enrichAllLineups(prisma, this.llm);
      const ok = res.filter((r) => r.status === 'ok').length;
      const note = `enriched ${ok}/${res.length} teams`;
      await recordJobRun(prisma, 'enrich_lineups', 'OK', note);
      this.log.log(`enrich_lineups: ${note}`);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'enrich_lineups', 'ERROR', (err as Error).message);
      this.log.warn(`enrich_lineups failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }
}
