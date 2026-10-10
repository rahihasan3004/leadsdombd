export class LatestRequest {
  private current: AbortController | null = null;
  start(): AbortController {
    this.cancel();
    this.current = new AbortController();
    return this.current;
  }
  isCurrent(controller: AbortController): boolean {
    return this.current === controller && !controller.signal.aborted;
  }
  cancel(): void {
    this.current?.abort();
    this.current = null;
  }
}
