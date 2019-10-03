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

import { table } from "table";
import { Exporter } from "../exporter";
import { BenchmarkResult } from "../../benchmark";
import TimeUnit from "../../time";

/**
 * Exports results to the console once all benchmarks are done
 */
export default class ConsoleExporter extends Exporter {
  public onFinished(results: BenchmarkResult[]): void {
    const header = [
      "Name",
      "Measurements",
      "Cycles",
      "Mean",
      "Median",
      "Mode",
      "StdDev",
      "StdErr",
      "MoE",
      "Min",
      "Max",
    ];
    const data = results.map(r => [
      r.name,
      r.times.length,
      r.count,
      ConsoleExporter.nsToPrettyString(r.stats.mean),
      ConsoleExporter.nsToPrettyString(r.stats.median),
      ConsoleExporter.nsToPrettyString(r.stats.mode),
      ConsoleExporter.nsToPrettyString(r.stats.standardDeviation),
      ConsoleExporter.nsToPrettyString(r.stats.standardError),
      ConsoleExporter.nsToPrettyString(r.stats.marginOfError),
      ConsoleExporter.nsToPrettyString(r.stats.min),
      ConsoleExporter.nsToPrettyString(r.stats.max),
    ]);

    const output = table([header, ...data]);

    console.log(output);
  }

  private static nsToPrettyString(time: number) {
    let unit = "ns";
    let convertedTime = time;
    if (time >= TimeUnit.Second) {
      unit = "s";
      convertedTime = time / TimeUnit.Second;
    } else if (time >= TimeUnit.Millisecond) {
      unit = "ms";
      convertedTime = time / TimeUnit.Millisecond;
    } else if (time >= TimeUnit.Microsecond) {
      unit = "µs";
      convertedTime = time / TimeUnit.Microsecond;
    }

    const maxLength = 3;
    const timeString = convertedTime.toString();
    const parts = timeString.split(".");
    const beforeComma = parts[0];
    const afterComma = parts[1] !== undefined ? parts[1] : "";
    const availableLength = Math.max(0, maxLength - beforeComma.length);
    return `${beforeComma}${availableLength === 0 ? "" : "."}${afterComma.substring(
      0,
      availableLength,
    )}${unit}`;
  }
}
