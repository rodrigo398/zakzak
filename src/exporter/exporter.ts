/*!
 * Copyright 2019, Dynatrace LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable class-methods-use-this */
/* eslint @typescript-eslint/no-unused-vars: 0 */
/* eslint @typescript-eslint/no-empty-function: 0 */
import { EventEmitter } from "events";
import { BenchmarkResult } from "../benchmark";
import { Suite } from "../suite";

/**
 * Possible events that the exporter can listen on
 */
export enum ExporterEvents {
  Hierarchy = "hierarchy",
  Result = "result",
  Finished = "finished",
  Error = "error",
}

/**
 * Exporter Abstraction that can be used for implementing a custom exporter
 */
export abstract class Exporter {
  /**
   * Instantiate a new Exporter
   * @param em EventEmitter that emits events from inside the benchmarking process
   */
  constructor(em: EventEmitter) {
    em.on(ExporterEvents.Hierarchy, this.onHierarchy.bind(this));
    em.on(ExporterEvents.Result, this.onResult.bind(this));
    em.on(ExporterEvents.Finished, this.onFinished.bind(this));
    em.on(ExporterEvents.Error, this.onError.bind(this));
  }

  /**
   * Gets triggered when the suite manager has finished looking for benchmarks.
   * Returns the found structure
   * @param root The root suites of the hierarchy. Usually these suites are the files themself
   */
  public onHierarchy(root: Suite[]): void {}

  /**
   * Gets triggered when a single benchmark has finished and returned a result
   * @param result The result of the finished benchmark
   */
  public onResult(result: BenchmarkResult): void {}

  /**
   * Gets triggered when all of the benchmarks have finished and the benchmarkmanager is done.
   * @param results All the benchmark results
   */
  public onFinished(results: BenchmarkResult[]): void {}

  /**
   * Gets triggered an error is thrown in the benchmarking process
   * @param error The error object that got thrown
   */
  public onError(error: Error, benchmarkId: string): void {}
}
