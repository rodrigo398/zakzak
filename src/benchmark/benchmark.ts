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

import { mergeWith, sum } from "lodash";
import Timer from "./timer";
import { Analytics, FullAnalysis } from "./analytics";
import { BenchmarkOptions, DefaultBenchmarkOptions } from "../config";

/**
 * Benchmark is responsible for the actual benchmarking.
 * It measures the times, warms the function up, saves and interpretes results
 */
export class Benchmark {
  /**
   * Options for the benchmark
   */
  private options: BenchmarkOptions;

  /**
   * Creates a new benchmark
   * @param id Uniquely identifiable id of the benchmark.
   * Composed of Filename, parent suites and benchmarkname, separated by colons
   * @param name Name of the benchmark
   * @param fn Function that will be benchmarked
   * @param filepath Path of the file, where the benchmark resides
   * @param options Options for the benchmark
   */
  public constructor(
    public id: string,
    public name: string,
    public fn: Function,
    public filepath: string,
    options: BenchmarkOptions,
  ) {
    this.options = DefaultBenchmarkOptions;
    if (options == null) {
      return;
    }

    let minSamples;
    if (options.minSamples != null) {
      minSamples =
        options.minSamples >= 1 ? options.minSamples : DefaultBenchmarkOptions.minSamples;
    }

    this.options = mergeWith({}, this.options, options, { minSamples }, (a, b) =>
      b === null ? a : undefined,
    );
  }

  public getOptions() {
    return this.options;
  }

  /**
   * Start the benchmark
   */
  public start(): BenchmarkResult {
    for (let i = 0, l = this.setups.length; i < l; i++) {
      this.setups[i]();
    }

    // Get tiniest possible measurement
    const timerResolution = Timer.getResolution();

    // Calculate size of target measurement using the resolution
    let minTime = Analytics.reduceUncertainty(timerResolution, 0.01);
    minTime = Math.max(minTime, this.options.minTime); // take biggest minTime

    // Get optimal cycle count possible in minTime and then collect samples
    const optimalCount = this.getMaxCycles(minTime);
    const samples = this.getSamples(optimalCount).map(sample => sample / optimalCount);

    const stats = Analytics.getFullAnalysis(samples);

    for (let i = 0, l = this.teardowns.length; i < l; i++) {
      this.teardowns[i]();
    }

    return {
      id: this.id,
      name: this.name,
      filename: this.filepath,
      stats,
      count: optimalCount,
      times: samples,
      options: this.options,
    };
  }

  public applySetupAndTeardown(setups: Function[] = [], teardowns: Function[] = []) {
    this.prependSetup(...setups);
    this.addTeardown(...teardowns);
  }

  /**
   * Add setup functions
   * @param fn Setup functions
   */
  public addSetup(...fn: Function[]) {
    this.setups.push(...fn);
  }

  /**
   * Add setup functions at the beginning
   * @param fn Setup functions
   */
  public prependSetup(...fn: Function[]) {
    this.setups.unshift(...fn);
  }

  /**
   * Add teardown functions
   * @param fn Teardown functions
   */
  public addTeardown(...fn: Function[]) {
    this.teardowns.push(...fn);
  }

  private teardowns: Function[] = [];

  private setups: Function[] = [];

  /**
   * Estimates max amount of cycles that is possible before minTime is reached
   * @param minTime Minimum time that one complete sample can take
   */
  private getMaxCycles(minTime: number): number {
    let result = { count: 1, finished: false }; // Start values

    // Save result and repeat until finished == true
    while (result.finished === false) {
      result = this.cycle(result.count, minTime);
    }

    return result.count;
  }

  /**
   * Execute function for specified amount of times,
   * then estimate how many more times would be possible until minTime is reached.
   * Sets `finished=true` when minTime is reached.
   * @param count Amount of times the function should be repeated
   * @param minTime The minTime which should be reached
   */
  private cycle(count: number, minTime: number) {
    const time = this.execute(count); // Time spent executing the function for count times
    const period = time / count; // Average time for a single execution
    const timeLeft = minTime - time; // Time left until minTime is reached

    // Calculate nextCount based on how often period fits into timeLeft
    const nextCount = count + (time <= 0 ? count * 100 : Math.ceil(timeLeft / period));

    if (time <= minTime) {
      return { count: nextCount, finished: false };
    } // If minTime is reached
    return { count, finished: true };
  }

  /**
   * Executes function for specified amount of times, amounting to a single sample.
   * Repeats the process until maxTime or maxSamples is reached.
   * @param count Amount of times the function should be repeated
   */
  private getSamples(count: number): number[] {
    const samples: number[] = [];
    const { maxTime } = this.options;
    const { maxSamples } = this.options;
    let cycles = this.options.minSamples;

    // Collect the minimum amount of samples
    while (cycles--) {
      const time = this.execute(count);
      samples.push(time);
    }

    // Collect more samples until maxTime or maxSamples is reached
    while (sum(samples) < maxTime && samples.length < maxSamples) {
      const time = this.execute(count);
      samples.push(time);
    }

    return samples;
  }

  /**
   * Execute function for specified amount of times
   * @param count Amount of times the function should be repeated
   */
  private execute(count: number): number {
    const { fn } = this;
    const start = Timer.getTime();
    for (let l = count, i = 0; i < l; i++) {
      fn();
    }
    const end = Timer.getTime();

    return end - start;
  }
}

/**
 * The result of a successful benchmark
 */
interface BenchmarkResult {
  id: string;
  name: string;
  filename: string;
  stats: FullAnalysis;
  times: number[];
  count: number;
  options: BenchmarkOptions;
}

export { BenchmarkResult };
